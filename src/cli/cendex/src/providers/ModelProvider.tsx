import {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
	useRef,
} from "react";
import { fetchSupportedModels, queryModel, type Model } from "../server/Models";
import type { MessageType } from "../components/Message";
import type { ChatMessage } from "cencori";

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
};

const ModelContext = createContext<ModelContextValue | null>(null);

export const useModels = () => useContext(ModelContext);

export const ModelProvider = ({ children }: { children: React.ReactNode }) => {
	const [models, setModels] = useState<Model[]>([]);
	const [activeModel, setActiveModel] = useState<Model | null>(
		models[0] ?? null,
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [sessionMessages, setSessionMessages] = useState<MessageType[]>([]);

	const [respLoading, setRespLoading] = useState<boolean>(false);
	const agentResponded = useRef<boolean>(false);

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

	const getModelResp = useCallback(async () => {
		if (sessionMessages[sessionMessages.length - 1]?.type !== "user") return;

		setRespLoading(true);
		const chats = mapMessagesToSession(sessionMessages); // snapshot BEFORE placeholder
		const botMessageId = sessionMessages.length + 1;

		// 1. push an empty placeholder so the UI has something to render into
		setSessionMessages((prev) => [
			...prev,
			{ model: activeModel?.name, type: "bot", msg: "", id: botMessageId },
		]);

		try {
			const stream = await queryModel({
				model_id: activeModel?.id as string,
				temp: 0.2,
				maxTokens: 10_000,
				session_messages: chats,
			});

			let accumulated = "";

			for await (const chunk of stream) {
				accumulated += chunk.delta ?? "";
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
								msg: "Model unavailable please use an open soure model",
							}
							: m,
					),
				);
			}
		} catch (err) {
			setSessionMessages((prev) =>
				prev.map((m) =>
					m.id === botMessageId
						? { ...m, type: "error", msg: "Stream failed" }
						: m,
				),
			);
		} finally {
			setRespLoading(false);
		}
	}, [sessionMessages, activeModel, mapMessagesToSession]);

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
			}}
		>
			{children}
		</ModelContext.Provider>
	);
};

export default ModelProvider;
