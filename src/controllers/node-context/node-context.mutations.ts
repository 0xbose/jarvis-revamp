import axios from "axios";
import {
	NodeContextAgentCollection,
	NodeContextResponse,
} from "../../types/memory";

export const upsertNodeContextMemory = async ({
	agent_id,
	agentCollection,
	item_id,
}: {
	agent_id: string;
	agentCollection: NodeContextAgentCollection;
	item_id: string;
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

	const response = await axios.post<NodeContextResponse>(
		`${process.env.NEXT_PUBLIC_API_BASE_URL}/collections/node-context`,
		{
			agent_id,
			agent_collection: agentCollection,
			item_id,
		},
		{
			headers: {
				"x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
				"Content-Type": "application/json",
			},
		}
	);
	return response.data;
};

export const upsertMemoryRecall = async ({
	agent_id,
	agentCollection,
}: {
	agent_id: string;
	agentCollection: {
		agentAddress: string;
		agentID: string;
	};
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
	if (!`${process.env.NEXT_PUBLIC_X_API_KEY}`) {
		throw new Error("api_key is required");
	}

	const response = await axios.post(
		`${process.env.NEXT_PUBLIC_API_BASE_URL}/collections/memory-recall`,
		{
			agent_id,
			agentCollection,
			api_key: `${process.env.NEXT_PUBLIC_X_API_KEY}`,
		},
		{
			headers: {
				"x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
				"Content-Type": "application/json",
			},
		}
	);
	return response.data;
};

export const deleteNodeContextMemory = async ({
	agent_id,
	itemID,
}: {
	agent_id: string;
	itemID?: string;
}): Promise<any> => {
	if (!agent_id) {
		throw new Error("agent_id is required");
	}
	if (!`${process.env.NEXT_PUBLIC_X_API_KEY}`) {
		throw new Error("api_key is required");
	}

	const params: any = {
		apiKey: `${process.env.NEXT_PUBLIC_X_API_KEY}`,
		agentID: agent_id,
	};

	// Only add itemID if provided
	if (itemID) {
		params.itemID = itemID;
	}

	const response = await axios.delete(
		`${process.env.NEXT_PUBLIC_API_BASE_URL}/collections/node-context`,
		{
			params,
			headers: {
				"x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
				"Content-Type": "application/json",
			},
		}
	);
	return response.data;
};

export const deleteMemoryRecall = async ({
	agent_id,
	itemID,
}: {
	agent_id: string;
	itemID?: string;
}): Promise<any> => {
	if (!agent_id) {
		throw new Error("agent_id is required");
	}
	if (!`${process.env.NEXT_PUBLIC_X_API_KEY}`) {
		throw new Error("api_key is required");
	}

	const params: any = {
		apiKey: `${process.env.NEXT_PUBLIC_X_API_KEY}`,
		agentID: agent_id,
	};

	// Only add itemID if provided
	if (itemID) {
		params.itemID = itemID;
	}

	const response = await axios.delete(
		`${process.env.NEXT_PUBLIC_API_BASE_URL}/collections/memory-recall`,
		{
			params,
			headers: {
				"x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
				"Content-Type": "application/json",
			},
		}
	);
	return response.data;
};
