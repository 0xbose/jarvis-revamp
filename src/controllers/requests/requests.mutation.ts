import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";

/**
 * Deletes a workflow request by its ID.
 * @param workflowId - The ID of the workflow to delete.
 * @param skyBrowser - The SkyMainBrowser instance.
 * @param web3Context - The Web3Context instance.
 * @returns The response data from the delete operation.
 */
export const deleteWorkflowRequest = async (
  workflowId: string,
  skyBrowser: SkyMainBrowser,
  web3Context: Web3Context
): Promise<any> => {
  const axiosInstance = await getAxiosInstanceWithApiKey(
    process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL || "",
    skyBrowser,
    web3Context
  );
  const response = await axiosInstance.delete(`/requests/${workflowId}`);
  return response.data;
};
