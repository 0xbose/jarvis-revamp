import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";

export const getOriginalPayload = async (
	workflowId: string,
	skyBrowser: SkyMainBrowser,
	web3Context: Web3Context
): Promise<any> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL || "",
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
	},
	skyBrowser?: SkyMainBrowser,
	web3Context?: Web3Context
): Promise<any> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL || "",
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get("/requests", {
		params: params || {},
	});
	return response.data;
};

export const getChatMessages = async (
	workflowId: string,
	skyBrowser?: SkyMainBrowser,
	web3Context?: Web3Context
): Promise<any> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL || "",
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get(
		`/requests/${workflowId}/messages`
	);
	return response.data;
};
