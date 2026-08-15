import axios from "axios";

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

		// Axios automatically parses the JSON body into response.data
		return response.data.data;
	} catch (error) {
		console.error("Error fetching Cencori models:", error);
		throw error;
	}
};
