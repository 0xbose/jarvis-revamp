import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";
import axios from "axios";
import { CollectionAgentsResponse, CollectionDetailResponse } from "@/types/collection";

export const getCollections = async (
	params?: {
		search?: string;
		limit?: number;
		offset?: number;
	}
): Promise<CollectionAgentsResponse> => {
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

export const getUserCollections = async (
	params: {
		search?: string;
		limit?: number;
		offset?: number;
		address: string;
	}
): Promise<CollectionAgentsResponse> => {
	
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

export const getCollectionsByAddress = async (
	agentAddress: string,
	skyBrowser?: SkyMainBrowser,
	web3Context?: Web3Context
): Promise<CollectionDetailResponse> => {
	const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/collections/${agentAddress}`, {
		headers: {
			"x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
		},
	});
	return response.data;
};
