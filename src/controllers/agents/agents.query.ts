import { AgentDetailResponse, UserAgentCollectionsResponse } from "@/types/agents";
import axios from "axios";


export const getUserMintedAgents = async (
  params: {
    address: string;
    limit?: number;
    offset?: number;
  }
): Promise<UserAgentCollectionsResponse> => {
  if (!params.address) {
    throw new Error("User address is required");
  }
  const response = await axios.get(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/agents/user/${params.address}`,
    {
      params: {
        limit: params.limit ?? 10,
        offset: params.offset ?? 0,
      },
      headers: {
        "x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
      },
    }
  );
  return response.data.data;
};

export const getAgentDetailByCollectionAndNftId = async (
  collectionAddress: string,
  nftId: string
): Promise<AgentDetailResponse> => {
  if (!collectionAddress || !nftId) {
    throw new Error("Both collectionAddress and nftId are required");
  }
  const response = await axios.get(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/agents/${collectionAddress}/${nftId}`,
    {
      headers: {
        "x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
      },
    }
  );
  return response.data.data;
};
