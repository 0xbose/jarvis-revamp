import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";
import { WorkflowRequestsResponse } from "@/types/requests";
import { API_CONFIG } from "@/config/constants";

export const getOriginalPayload = async (
	workflowId: string,
	skyBrowser: SkyMainBrowser,
	web3Context: Web3Context
): Promise<any> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		API_CONFIG.NFT_USER_AGENT_URL || "",
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get(
		`/requests/${workflowId}/original-payload`
	);
	return response.data;
};

export const getHistory = async (
	params?: {
		page?: number;
		limit?: number;
		agentId?: string;
		status?:
			| "in_progress"
			| "waiting"
			| "completed"
			| "pending"
			| "failed"
			| "stopped"
			| "awaiting_response";
		nextPageUrl?: string;
		pageUrl?: string; // generic cursor page url (previous or next)
	},
	skyBrowser?: SkyMainBrowser,
	web3Context?: Web3Context
): Promise<WorkflowRequestsResponse> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		API_CONFIG.NFT_USER_AGENT_URL || "",
		skyBrowser,
		web3Context
	);

	// If API provides a fully-qualified cursor pageUrl (prev/next), use it directly
	const directUrl = params?.pageUrl || params?.nextPageUrl;
	if (directUrl) {
		const response = await axiosInstance.get(directUrl);
		return response.data;
	}

	const response = await axiosInstance.get("/requests", {
		params: {
			page: params?.page,
			limit: params?.limit,
			agentId: params?.agentId,
			status: params?.status,
			includeChatSessions: true,
		},
	});
	return response.data;
};

export const getHistoryByAgent = async (
	params?: {
		page?: number;
		limit?: number;
		agentAddress?: string;
		agentID?: string;
		status?:
			| "in_progress"
			| "waiting"
			| "completed"
			| "pending"
			| "failed"
			| "stopped"
			| "awaiting_response";
	},
	skyBrowser?: SkyMainBrowser,
	web3Context?: Web3Context
): Promise<WorkflowRequestsResponse> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		API_CONFIG.NFT_USER_AGENT_URL || "",
		skyBrowser,
		web3Context
	);

	const response = await axiosInstance.get("/requests", {
		params: {
			agentAddress: params?.agentAddress,
			agentID: params?.agentID,
			page: params?.page,
			limit: params?.limit,
			status: params?.status,
		},
	});

	console.log("✅ getHistoryByAgent - Response received", {
		status: response.status,
		dataKeys: Object.keys(response.data || {}),
	});

	return response.data;
};

export const getChatMessages = async (
	workflowId: string,
	skyBrowser?: SkyMainBrowser,
	web3Context?: Web3Context
): Promise<any> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		API_CONFIG.NFT_USER_AGENT_URL || "",
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get(
		`/requests/${workflowId}/messages`
	);
	return response.data;
};
