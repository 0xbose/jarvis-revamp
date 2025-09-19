import axios from "axios";
import {
	NodeContextAgentCollection,
	NodeContextResponse,
} from "../../types/memory";
import { apiKeyManager } from "@/utils/api-key-manager";
import { API_CONFIG } from "@/config/constants";

/**
 * Upsert (save or update) collection node memory for a given (agent_id, api_key, item_id) combination.
 * POST /api/collections/node-context
 */
export const upsertNodeContextMemory = async ({
	agent_id,
	agentCollection,
	item_id,
	skyBrowser,
	address,
}: {
	agent_id: string;
	agentCollection: NodeContextAgentCollection;
	item_id: string;
	skyBrowser: any;
	address: string;
}): Promise<NodeContextResponse> => {
	if (!agent_id) {
		throw new Error("agent_id is required");
	}
	if (
		!agentCollection ||
		!agentCollection.agentAddress ||
		!agentCollection.agentID
	) {
		throw new Error(
			"agentCollection with agentAddress and agentID is required"
		);
	}
	if (!item_id) {
		throw new Error("item_id is required");
	}
	const apiKey = await apiKeyManager.getApiKey(skyBrowser, {
		address: address,
	});
	if (!apiKey) {
		throw new Error("api_key is required");
	}

	const response = await axios.post<NodeContextResponse>(
		`${API_CONFIG.API_BASE_URL}/collections/node-context`,
		{
			agent_id,
			agentCollection,
			item_id,
			api_key: apiKey,
		},
		{
			headers: {
				"x-api-key": `${API_CONFIG.X_API_KEY}`,
				"Content-Type": "application/json",
			},
		}
	);
	return response.data;
};

/**
 * Upsert (save or update) collection memory for a given (agent_id, api_key) pair.
 * POST /api/collections/memory-recall
 */
export const upsertMemoryRecall = async ({
	agent_id,
	agentCollection,
	skyBrowser,
	address,
}: {
	agent_id: string;
	agentCollection: {
		agentAddress: string;
		agentID: string;
	};
	skyBrowser: any;
	address: string;
}): Promise<any> => {
	if (!agent_id) {
		throw new Error("agent_id is required");
	}
	if (
		!agentCollection ||
		!agentCollection.agentAddress ||
		!agentCollection.agentID
	) {
		throw new Error(
			"agentCollection with agentAddress and agentID is required"
		);
	}

	const apiKey = await apiKeyManager.getApiKey(skyBrowser, {
		address: address,
	});
	if (!apiKey) {
		throw new Error("api_key is required");
	}

	const response = await axios.post(
		`${API_CONFIG.API_BASE_URL}/collections/memory-recall`,
		{
			agent_id,
			agentCollection,
			api_key: apiKey,
		},
		{
			headers: {
				"x-api-key": `${API_CONFIG.X_API_KEY}`,
				"Content-Type": "application/json",
			},
		}
	);
	return response.data;
};

/**
 * Delete collection node memory for a given (agent_id, api_key, item_id) combination.
 */
export const deleteNodeContextMemory = async ({
	agent_id,
	itemID,
	skyBrowser,
	address,
}: {
	agent_id: string;
	itemID?: string;
	skyBrowser: any;
	address: string;
}): Promise<any> => {
	if (!agent_id) {
		throw new Error("agent_id is required");
	}

	const apiKey = await apiKeyManager.getApiKey(skyBrowser, {
		address: address,
	});
	if (!apiKey) {
		throw new Error("api_key is required");
	}

	const params: any = {
		apiKey: apiKey,
		agentID: agent_id,
	};

	// Only add itemID if provided
	if (itemID) {
		params.itemID = itemID;
	}

	const response = await axios.delete(
		`${API_CONFIG.API_BASE_URL}/collections/node-context`,
		{
			params,
			headers: {
				"x-api-key": `${API_CONFIG.X_API_KEY}`,
				"Content-Type": "application/json",
			},
		}
	);
	return response.data;
};

/**
 * Delete collection memory recall for a given (agent_id, api_key, item_id) combination.
 */
export const deleteMemoryRecall = async ({
	agent_id,
	itemID,
	skyBrowser,
	address,
}: {
	agent_id: string;
	itemID?: string;
	skyBrowser: any;
	address: string;
}): Promise<any> => {
	if (!agent_id) {
		throw new Error("agent_id is required");
	}

	const apiKey = await apiKeyManager.getApiKey(skyBrowser, {
		address: address,
	});
	if (!apiKey) {
		throw new Error("api_key is required");
	}

	const params: any = {
		apiKey: apiKey,
		agentID: agent_id,
	};

	// Only add itemID if provided
	if (itemID) {
		params.itemID = itemID;
	}

	const response = await axios.delete(
		`${API_CONFIG.API_BASE_URL}/collections/memory-recall`,
		{
			params,
			headers: {
				"x-api-key": `${API_CONFIG.X_API_KEY}`,
				"Content-Type": "application/json",
			},
		}
	);
	return response.data;
};
