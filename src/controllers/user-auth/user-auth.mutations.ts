import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import { Web3Context } from "@/types/wallet";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";

/**
 * Requests an authentication link for a user agent on a given subnet.
 * 
 * @param params
 *   subnetUrl: string - The base URL of the subnet.
 *   agentCollection: any - The agent's collection identifier or object.
 *   skyBrowser: SkyMainBrowser - The SkyMainBrowser instance.
 *   web3Context: Web3Context - The user's web3 context.
 * @returns Promise<any> - The response from the subnet's /auth-link endpoint.
 */
export const getAgentUserAuthLink = async ({
  subnetUrl,
  agentCollection,
  skyBrowser,
  web3Context,
}: {
  subnetUrl: string;
  agentCollection: any;
  skyBrowser: SkyMainBrowser;
  web3Context: Web3Context;
}): Promise<any> => {
  const axiosInstance = await getAxiosInstanceWithApiKey(
    subnetUrl,
    skyBrowser,
    web3Context
  );

  const response = await axiosInstance.post(
    `${subnetUrl}/auth-link`,
    {
      agentCollection: agentCollection,
    }
  );
  return response.data;
};
