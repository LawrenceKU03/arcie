import {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
	useRef,
} from "react";
import {
	fetchSupportedModels,
	queryModelStream,
	type Model,
} from "../server/Models";
import type { MessageType } from "../components/Message";
import type { ChatMessage } from "cencori";
import { readFromFile } from "../tools/fileHandler";
import { runLocalMemoryAgentWithRepoContext } from "../tools/harness-plugin-core";
import { useToast } from "./ToastProvider";

export type ModelContextValue = {
	models: Model[];
	loading: boolean;
	error: string | null;
	refresh: () => Promise<void>;
	activeModel: Model | null;
	setActiveModel: (model: Model) => void;
	sessionMessages: MessageType[];
	setSessionMessages: (sessionMessages: MessageType[]) => void;
	respLoading: boolean;
	setRespLoading: (state: boolean) => void;
	interruptedStatusRef: React.RefObject<boolean>;
};

const ModelContext = createContext<ModelContextValue | null>(null);
export const useModels = () => useContext(ModelContext);

const MODELS_RETRY_DELAY_MS = 5000;

export const ModelProvider = ({ children }: { children: React.ReactNode }) => {
	const [models, setModels] = useState<Model[]>([]);
	const [activeModel, setActiveModel] = useState<Model | null>(
		models[0] ?? null,
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [sessionMessages, setSessionMessages] = useState<MessageType[]>([]);
	const [sessionThinkingMessages, setSessionThinkingMessages] = useState<
		MessageType[]
	>([]);
	const [isPlanMode, setIsPlanMode] = useState<boolean>(true);

	const toast = useToast();
	const [respLoading, setRespLoading] = useState<boolean>(false);
	const agentResponded = useRef<boolean>(false);

	const interruptedStatusRef = useRef<boolean>(false);

	const mapMessagesToSession = useCallback(
		(messages: MessageType[]): ChatMessage[] => {
			return messages
				.filter((msg) => msg.type !== "error" && Boolean(msg.msg))
				.map((message) => ({
					role:
						message.type === "bot" ? ("assistant" as const) : ("user" as const),
					content: message.msg as string,
				}));
		},
		[],
	);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchSupportedModels();
			setModels(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch models");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (loading || models.length > 0) return;
		const timeoutId = setTimeout(() => {
			refresh();
		}, MODELS_RETRY_DELAY_MS);
		return () => clearTimeout(timeoutId);
	}, [loading, models, refresh]);

	const getModelResp = useCallback(async () => {
		const lastMessage = sessionMessages[sessionMessages.length - 1];
		if (lastMessage?.type !== "user" || typeof lastMessage.msg !== "string")
			return;
		setRespLoading(true);
		const botMessageId = sessionMessages.length + 1;
		setSessionMessages((prev) => [
			...prev,
			{ model: activeModel?.name, type: "bot", msg: "", id: botMessageId },
		]);
		try {
			const userPrompt = lastMessage.msg.trim();
			interruptedStatusRef.current = false;
			if (isPlanMode) {
				const taskDescription = userPrompt.replace(/^\/agent\s*/i, "");
				const stream = await runLocalMemoryAgentWithRepoContext(
					taskDescription,
					activeModel?.id as string,
				);
				let accumulated = "";
				for await (const chunk of stream) {
					if (interruptedStatusRef.current) {
						break;
					}

					accumulated += chunk?.delta ?? "";
					setSessionMessages((prev) =>
						prev.map((m) =>
							m.id === botMessageId ? { ...m, msg: accumulated } : m,
						),
					);
					setSessionThinkingMessages((prev) =>
						prev.map((m) =>
							m.id === botMessageId ? { ...m, msg: accumulated } : m,
						),
					);
				}
				if (accumulated === "" && !interruptedStatusRef.current) {
					setSessionMessages((prev) =>
						prev.map((m) =>
							m.id === botMessageId
								? {
										...m,
										type: "error",
										msg: `Model unavailable please use an open source model ${activeModel?.id}`,
									}
								: m,
						),
					);
				}
			} else {
				const chats = mapMessagesToSession(sessionMessages.slice(0, -1));
				const stream = await queryModelStream({
					model_id: activeModel?.id as string,
					temp: 0.2,
					maxTokens: 10_000,
					session_messages: chats,
				});
				let accumulated = "";
				for await (const chunk of stream) {
					if (interruptedStatusRef.current) {
						setRespLoading(false);
						break;
					}
					accumulated += chunk?.delta ?? "";
					setSessionMessages((prev) =>
						prev.map((m) =>
							m.id === botMessageId ? { ...m, msg: accumulated } : m,
						),
					);
				}
				if (accumulated === "") {
					setSessionMessages((prev) =>
						prev.map((m) =>
							m.id === botMessageId
								? {
										...m,
										type: "error",
										msg: `Request To Model ${activeModel?.name} Timedout,Please Try Again Later!`,
									}
								: m,
						),
					);
				}
			}
		} catch (err: any) {
			setSessionMessages((prev) =>
				prev.map((m) =>
					m.id === botMessageId ? { ...m, type: "error", msg: err.message } : m,
				),
			);
		} finally {
			setRespLoading(false);
		}
	}, [
		sessionMessages,
		activeModel,
		mapMessagesToSession,
		interruptedStatusRef,
		isPlanMode,
		respLoading,
	]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	useEffect(() => {
		if (activeModel && sessionMessages.length > 0 && !agentResponded.current) {
			getModelResp();
			agentResponded.current = true;
			setTimeout(() => {
				agentResponded.current = false;
			}, 2000);
		}
	}, [sessionMessages, activeModel, getModelResp]);

	const fetchCurrentSavedActiveAgent = async () => {
		try {
			const agent = await readFromFile(Bun.env?.ACTIVE_MODEL as string);
			setActiveModel(JSON.parse(agent));
		} catch (e) {
			toast?.show("Please select a model", "notification");
		}
	};

	useEffect(() => {
		fetchCurrentSavedActiveAgent();
	}, []);

	return (
		<ModelContext.Provider
			value={{
				models,
				loading,
				error,
				refresh,
				activeModel,
				setActiveModel,
				sessionMessages,
				setSessionMessages,
				respLoading,
				setRespLoading,
				interruptedStatusRef,
			}}
		>
			{children}
		</ModelContext.Provider>
	);
};

export default ModelProvider;
