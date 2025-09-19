import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";
import { API_CONFIG } from "@/config/constants";

export const getAvailableModels = async ({
	skyBrowser,
	web3Context,
}: {
	skyBrowser?: SkyMainBrowser;
	web3Context?: Web3Context;
}): Promise<any[]> => {
	const url = API_CONFIG.CHAT_ACCESSPOINT_URL;
	const axiosInstance = await getAxiosInstanceWithApiKey(
		url || "",
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get(`${url}/models`);
	return response?.data || [];
};
