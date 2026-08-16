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

const response = await cencori.ai.chat({
	model: "gpt-4o",
	messages: [
		{ role: "system", content: "You are a helpful assistant." },
		{ role: "user", content: "What is the capital of France?" },
	],
	temperature: 0.2,
	maxTokens: 300,
});

export const fetchSupportedModels = async (): Promise<Model[]> => {
	if (!apiKey) {
		throw new Error(
			"API key missing. Make sure CENCORI_API_KEY is set in .env.local",
		);
	}

	try {
		const response = await axios.get<ModelsResponse>(`${baseURL}`, {
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

type sessionMessages = {
	role: string;
	content: string;
};

export const queryModel = async (data: {
	model_id: string;
	session_messages: sessionMessages[];
	temp: number;
	maxTokens: number;
}) => {
	const response = await cencori.ai.chat({
		model: data.model_id,
		messages: data.session_messages,
		temperature: data.temp,
		maxTokens: data.maxTokens,
	});
};
