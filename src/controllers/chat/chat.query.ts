import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/skynet";
import { API_CONFIG } from "@/config/constants";

export const getChatMessages = async ({
	chatId,
	skyBrowser,
	web3Context,
}: {
	chatId: string;
	skyBrowser?: SkyMainBrowser;
	web3Context?: Web3Context;
}): Promise<any> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		API_CONFIG.NFT_USER_AGENT_URL || "",
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get(
		`${API_CONFIG.CHAT_ACCESSPOINT_URL}/chat-messages`,
		{
			params: { chatId },
		}
	);
	return response.data;
};
