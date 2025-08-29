import axios from "@/lib/axios";
import { AgentResponse } from "@/types";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";

export const getCollection = async (
	params?: {
		search?: string;
		limit?: number;
		offset?: number;
	},
): Promise<any> => {
	
	const response = await axios.get("/collection", {
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