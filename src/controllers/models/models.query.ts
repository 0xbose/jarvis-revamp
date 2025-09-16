import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";

export const getAvailableModels = async ({
	skyBrowser,
	web3Context,
}: {
	skyBrowser?: SkyMainBrowser;
	web3Context?: Web3Context;
}): Promise<any[]> => {
	const url = process.env.NEXT_PUBLIC_CHAT_ACCESSPOINT_URL;
	const axiosInstance = await getAxiosInstanceWithApiKey(
		url || "",
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get(`${url}/models`);
	return response?.data || [];
};
