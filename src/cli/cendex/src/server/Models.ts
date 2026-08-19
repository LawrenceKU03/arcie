import { Cencori } from "cencori";
const apiKey = Bun.env.CENCORI_API_KEY || null;
if (!apiKey) {
	throw new Error(
		"API key missing. Make sure CENCORI_API_KEY is set in .env.local",
	);
}
export const cencori = new Cencori({
	apiKey: apiKey,
});
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
export const fetchSupportedModels = async (): Promise<Model[]> => {
	const baseURL = Bun.env.CENCORI_BASE_URL || "https://api.cencori.com/v1";
	const response = await fetch(`${baseURL}/models`, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	});
	if (!response.ok) {
		throw new Error("Failed to fetch Cencori models");
	}
	const data = (await response.json()) as { data: Model[] };
	return data.data;
};
export type ChatRole = "user" | "assistant" | "system" | "tool";
export type ChatMessage = {
	role: ChatRole;
	content: string;
};
export const queryModelStream = async (data: {
	model_id: string;
	session_messages: ChatMessage[];
	temp: number;
	maxTokens: number;
}) => {
	const messages = data.session_messages.map((m) => ({
		role: m.role,
		content: m.content,
	}));

	if (messages.length <= 0) {
		messages.push({
			role: "system",
			content: `You are [fill with your model info] running in the basecode agent harness built by Cencori, an AI infrastructure company.`,
		});
	}

	const result = cencori.ai.chatStream({
		model: data.model_id,
		messages: messages,
		temperature: data.temp,
		maxTokens: data.maxTokens,
	});
	return result;
};
