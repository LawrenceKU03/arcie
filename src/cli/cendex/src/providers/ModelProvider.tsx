import {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
} from "react";
import { fetchSupportedModels, type Model } from "../server/Models";
import type { MessageType } from "../components/Message";

export type ModelContextValue = {
	models: Model[];
	loading: boolean;
	error: string | null;
	refresh: () => Promise<void>;
	activeModel: Model | null;
	setActiveModel: (model: Model) => void;
	sessionMessages: MessageType[];
	setSessionMessages: (sessionMessages: MessageType[]) => void;
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
		refresh();
	}, [refresh]);

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
			}}
		>
			{children}
		</ModelContext.Provider>
	);
};

export default ModelProvider;
