import axios from "axios";
import { getAuthWithRetry } from "@/utils/skynetHelper";
import { KNOWLEDGE_PROMPTS } from "@/constants/knowledge";

export interface KnowledgeOperationParams {
	skyBrowser: any;
	userAddress: string;
	agentData: any;
	selectedNftId: string;
	agentId?: string;
	knowledgeType?: "swarm" | "agent";
}

export interface SaveKnowledgeParams extends KnowledgeOperationParams {
	content: string;
	recordId?: string; // For updates
}

export interface DeleteKnowledgeParams extends KnowledgeOperationParams {
	recordId: string;
}

const KNOWLEDGE_API_URL =
	"https://knowledgebase-c0n499.stackos.io/natural-request";

export const saveKnowledgeRecord = async (
	params: SaveKnowledgeParams
): Promise<void> => {
	const {
		skyBrowser,
		userAddress,
		agentData,
		selectedNftId,
		agentId,
		knowledgeType = "swarm",
		content,
		recordId,
	} = params;

	console.log("saveKnowledgeRecord called with params:", {
		userAddress,
		selectedNftId,
		agentId,
		knowledgeType,
		content: content.substring(0, 50) + "...",
		recordId,
		agentData,
	});

	if (!content.trim()) {
		throw new Error("Content is required");
	}

	if (!skyBrowser || !selectedNftId) {
		throw new Error("Missing required data for saving");
	}

	const auth = await getAuthWithRetry(skyBrowser);
	const agentAddress =
		agentData?.nft_address || agentData?.collection_id || "";

	// Get account NFT ID
	let accountNftId: string;
	try {
		const userNftBalance =
			await skyBrowser.contractService.AgentNFT.balanceOf(userAddress);
		if (userNftBalance && userNftBalance > 0) {
			const firstNftId =
				await skyBrowser.contractService.AgentNFT.tokenOfOwnerByIndex(
					userAddress,
					0
				);
			accountNftId = firstNftId.toString();
		} else {
			accountNftId = selectedNftId;
		}
	} catch (error) {
		accountNftId = selectedNftId;
	}

	// Build the prompt differently, not using makeApiRequest
	let prompt: string;
	if (recordId) {
		prompt = `Update the Record ${recordId}: ${content.trim()}`;
	} else if (knowledgeType === "swarm") {
		prompt = `${
			KNOWLEDGE_PROMPTS.SWARM_PREFIX
		}Save this data to the collection knowledge base: ${content.trim()}`;
	} else {
		prompt = `Save this data to the knowledge base: ${content.trim()}`;
	}

	const payload = {
		prompt,
		userAuthPayload: {
			userAddress: auth.data.userAddress,
			signature: auth.data.signature,
			message: auth.data.message,
		},
		accountNFT: {
			collectionID: "0",
			nftID: accountNftId,
		},
		agentCollection: {
			agentAddress: agentAddress,
			...(knowledgeType === "agent" ||
			(knowledgeType === "swarm" && recordId)
				? { agentID: agentId }
				: {}),
		},
	};

	console.log("Making direct API request to save knowledge record:", {
		url: KNOWLEDGE_API_URL,
		payload: {
			...payload,
			userAuthPayload: {
				...payload.userAuthPayload,
				signature:
					payload.userAuthPayload.signature.substring(0, 20) + "...",
			},
		},
	});

	try {
		const response = await axios.post(KNOWLEDGE_API_URL, payload, {
			headers: {
				"Content-Type": "application/json",
			},
			timeout: 60000,
		});

		const result = response.data;

		// Check if the result is HTML (error page) instead of JSON
		if (typeof result === "string" && result.includes("<!DOCTYPE html>")) {
			throw new Error(
				"API returned HTML instead of JSON - possible server error or CORS issue"
			);
		}

		console.log("Knowledge record saved successfully:", result);

		// Check if the API response indicates success
		if (result && typeof result === "object" && "success" in result) {
			if (!result.success) {
				throw new Error(
					`API returned error: ${result.message || "Unknown error"}`
				);
			}
		}
	} catch (error) {
		console.error("Error saving knowledge record:", error);
		throw error;
	}
};

export const deleteKnowledgeRecord = async (
	params: DeleteKnowledgeParams
): Promise<void> => {
	const {
		skyBrowser,
		userAddress,
		agentData,
		selectedNftId,
		agentId,
		knowledgeType = "swarm",
		recordId,
	} = params;

	if (!skyBrowser || !selectedNftId) {
		throw new Error("Missing required data for deletion");
	}

	const auth = await getAuthWithRetry(skyBrowser);
	const agentAddress =
		agentData?.nft_address || agentData?.collection_id || "";

	// Get account NFT ID
	let accountNftId: string;
	try {
		const userNftBalance =
			await skyBrowser.contractService.AgentNFT.balanceOf(userAddress);
		if (userNftBalance && userNftBalance > 0) {
			const firstNftId =
				await skyBrowser.contractService.AgentNFT.tokenOfOwnerByIndex(
					userAddress,
					0
				);
			accountNftId = firstNftId.toString();
		} else {
			accountNftId = selectedNftId;
		}
	} catch (error) {
		accountNftId = selectedNftId;
	}

	// Build the prompt differently, not using makeApiRequest
	let prompt: string;
	if (knowledgeType === "swarm") {
		prompt = `Remove from collection knowledge base: Record ${recordId}`;
	} else {
		prompt = `Remove from knowledge base: Record ${recordId}`;
	}

	const payload = {
		prompt,
		userAuthPayload: {
			userAddress: auth.data.userAddress,
			signature: auth.data.signature,
			message: auth.data.message,
		},
		accountNFT: {
			collectionID: "0",
			nftID: accountNftId,
		},
		agentCollection: {
			agentAddress: agentAddress,
			...(knowledgeType === "agent" ||
			(knowledgeType === "swarm" && recordId)
				? { agentID: agentId }
				: {}),
		},
	};

	try {
		const response = await axios.post(KNOWLEDGE_API_URL, payload, {
			headers: {
				"Content-Type": "application/json",
			},
			timeout: 60000,
		});
		const result = response.data;

		if (typeof result === "string" && result.includes("<!DOCTYPE html>")) {
			throw new Error(
				"API returned HTML instead of JSON - possible server error or CORS issue"
			);
		}

		if (result && typeof result === "object" && "success" in result) {
			if (!result.success) {
				throw new Error(
					`API returned error: ${result.message || "Unknown error"}`
				);
			}
		}
	} catch (error) {
		console.error("Error deleting knowledge record:", error);
		throw error;
	}
};
