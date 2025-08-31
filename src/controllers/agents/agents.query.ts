import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import { AgentResponse, AgentDetailResponse } from "@/types";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";
import axios from "axios";

export const getAgents = async (
	params?: {
		search?: string;
		limit?: number;
		offset?: number;
	},
	skyBrowser?: SkyMainBrowser,
	web3Context?: Web3Context
): Promise<AgentResponse> => {
	const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/collections`, {
		params: {
			search: params?.search,
			limit: params?.limit || 10,
			offset: params?.offset || 0,
		},
		headers: {
			"x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
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
	
	const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/collections`, {
		params: {
			search: params?.search,
			limit: params?.limit || 10,
			offset: params?.offset || 0,
			user_address: params?.address,
		},
		headers: {
			"x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
		},
	});
	return response.data;
};

export const getAgentById = async (
	agentAddress: string,
	skyBrowser?: SkyMainBrowser,
	web3Context?: Web3Context
): Promise<AgentDetailResponse> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL || "",
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get(`/collections/${agentAddress}`);
	return response.data;
};
