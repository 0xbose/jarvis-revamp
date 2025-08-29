import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import { AgentResponse, AgentDetailResponse } from "@/types";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";

export const getAgents = async (
	params?: {
		search?: string;
		limit?: number;
		offset?: number;
	},
	skyBrowser?: SkyMainBrowser,
	web3Context?: Web3Context
): Promise<AgentResponse> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		process.env.NEXT_PUBLIC_API_BASE_URL || "",
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get("/agents", {
		params: {
			search: params?.search,
			limit: params?.limit || 10,
			offset: params?.offset || 0,
		},
	});
	return response.data;
};

export const getUserAgents = async (
	params: {
		search?: string;
		limit?: number;
		offset?: number;
		address: string;
	},
	skyBrowser?: SkyMainBrowser,
	web3Context?: Web3Context
): Promise<AgentResponse> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL || "",
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}agents`, {
		params: {
			search: params?.search,
			limit: params?.limit || 10,
			offset: params?.offset || 0,
			user_address: params?.address,
		},
	});
	return response.data;
};

export const getAgentById = async (
	id: string,
	skyBrowser?: SkyMainBrowser,
	web3Context?: Web3Context
): Promise<AgentDetailResponse> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL || "",
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get(`/agents/${id}`);
	return response.data;
};
