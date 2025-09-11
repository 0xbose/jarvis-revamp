import axios from "axios";
import { NodeContext } from "../../types/memory";
import { apiKeyManager } from "@/utils/api-key-manager";

export const getNodeContextMemory = async ({
	agentID,
	skyBrowser,
	address,
}: {
	agentID: string;
	skyBrowser: any;
	address: string;
}): Promise<NodeContext[]> => {
	const apiKey = await apiKeyManager.getApiKey(skyBrowser, {
		address: address,
	});
	if (!apiKey) {
		throw new Error("apiKey is required");
	}
	const response = await axios.get(
		`${process.env.NEXT_PUBLIC_API_BASE_URL}/collections/node-context`,
		{
			params: {
				apiKey: apiKey,
				agentID,
			},
			headers: {
				"x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
			},
		}
	);

	// Handle the nested structure where memories are under response.data.data.memories
	const responseData = response.data.data;

	if (responseData && Array.isArray(responseData.memories)) {
		return responseData.memories;
	} else if (Array.isArray(responseData)) {
		return responseData;
	} else if (responseData) {
		return [responseData];
	} else {
		return [];
	}
};

export const getMemoryRecall = async ({
	agentID,
	skyBrowser,
	address,
}: {
	agentID: string;
	skyBrowser: any;
	address: string;
}): Promise<any> => {
	const apiKey = await apiKeyManager.getApiKey(skyBrowser, {
		address: address,
	});
	if (!apiKey) {
		throw new Error("apiKey is required");
	}

	const response = await axios.get(
		`${process.env.NEXT_PUBLIC_API_BASE_URL}/collections/memory-recall`,
		{
			params: {
				apiKey: apiKey,
				agentID,
			},
			headers: {
				"x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
			},
		}
	);

	// The API returns { success, data, message }
	// Handle both single object and array responses
	const responseData = response.data.data;

	if (Array.isArray(responseData)) {
		return responseData;
	} else if (responseData) {
		// If it's a single object, wrap it in an array
		return [responseData];
	} else {
		return [];
	}
};
