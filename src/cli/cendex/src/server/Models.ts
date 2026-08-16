import axios from "axios";
import { Cencori } from "cencori";

const apiKey = Bun.env.CENCORI_API_KEY || null;
const baseURL = Bun.env.CENCORI_BASE_URL || null;

export type Model = {
	id: string;
	object: string;
	created?: number;
	owned_by: string;
	name?: string;
	type?: string[];
	context_window?: number;
	description?: string;
};

interface ModelsResponse {
	object: string;
	data: Model[];
}

const cencori = new Cencori({
	apiKey: apiKey as string,
});

export const fetchSupportedModels = async (): Promise<Model[]> => {
	if (!apiKey) {
		throw new Error(
			"API key missing. Make sure CENCORI_API_KEY is set in .env.local",
		);
	}

	try {
		const response = await axios.get<ModelsResponse>(`${baseURL}/models`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		return response.data.data;
	} catch (error) {
		console.error("Error fetching Cencori models:", error);
		throw error;
	}
};

export type ChatRole = "user" | "assistant" | "system" | "tool";

export type ChatMessage = {
	role: ChatRole;
	content: string;
};

export const queryModel = async (data: {
	model_id: string;
	session_messages: ChatMessage[];
	temp: number;
	maxTokens: number;
}) => {
	const response = await cencori.ai.chat({
		model: data.model_id,
		messages: data.session_messages,
		temperature: data.temp,
		maxTokens: data.maxTokens,
	});
	return response;
};
