import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/skynet";

export const deleteChatSession = async ({
  chatId,
  skyBrowser,
  web3Context,
}: {
  chatId: string;
  skyBrowser?: SkyMainBrowser;
  web3Context?: Web3Context;
}): Promise<any> => {
  const axiosInstance = await getAxiosInstanceWithApiKey(
    process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL || "",
    skyBrowser,
    web3Context
  );
  const response = await axiosInstance.delete(
    `${process.env.NEXT_PUBLIC_CHAT_ACCESSPOINT_URL}/chat-session`,
    {
      params: { chatId },
    }
  );
  return response.data;
};