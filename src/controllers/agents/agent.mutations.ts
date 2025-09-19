import { API_CONFIG } from "@/config/constants";
import axios from "axios";

export const createUserAgent = async (
  userAddress: string,
  payload: {
    collection_address: string;
    nft_id: string;
    name: string;
    description: string;
    image: string;
  }
): Promise<any> => {
  if (!userAddress) {
    throw new Error("User address is required");
  }
  if (
    !payload.collection_address ||
    !payload.nft_id ||
    !payload.name ||
    !payload.description ||
    !payload.image
  ) {
    throw new Error("All payload fields are required");
  }

  const response = await axios.post(
    `${API_CONFIG.API_BASE_URL}/agents/user/${userAddress}`,
    payload,
    {
      headers: {
        "x-api-key": `${API_CONFIG.X_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};

export const updateUserAgent = async (
  userAddress: string,
  payload: {
    collection_address: string;
    nft_id: string;
    name: string;
    description: string;
    image: string;
  }
): Promise<any> => {
  if (!userAddress) {
    throw new Error("User address is required");
  }

  const response = await axios.put(
    `${API_CONFIG.API_BASE_URL}/agents/user/${userAddress}`,
    payload,
    {
      headers: {
        "x-api-key": `${API_CONFIG.X_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};
