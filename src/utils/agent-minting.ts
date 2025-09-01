import { toast } from "sonner";
import { mintAgentNft, getAgentIdByAgentAddress } from "./skynetHelper";
import { Agent } from "@/types";

// Types for the minting helper
export interface MintingState {
  [agentAddress: string]: boolean;
}

export interface MintingResult {
  success: boolean;
  agentId?: string;
  error?: string;
}

export interface MintingOptions {
  onSuccess?: (agentId: string) => void;
  onError?: (error: string) => void;
  onMintingStateChange?: (minting: MintingState) => void;
}

export interface AgentWithOwnership extends Agent {
  // Extends the base Agent type with ownership information
}

/**
 * Comprehensive helper function for minting agent NFTs
 * Handles validation, minting process, and state management
 */
export const mintAgentNFTWithHelper = async (
  agent: AgentWithOwnership,
  skyBrowser: any, // SkyMainBrowser type
  userAddress: string,
  options: MintingOptions = {},
  nftContractAddress?: string
): Promise<MintingResult> => {
  const { onSuccess, onError, onMintingStateChange } = options;

  // Validation checks
  if (!agent || !skyBrowser) {
    const errorMsg = "Please select a deployed agent and ensure wallet is connected";
    toast.error(errorMsg);
    onError?.(errorMsg);
    return { success: false, error: errorMsg };
  }

  if (!agent.is_deployed) {
    const errorMsg = "Only deployed agents can have NFTs minted";
    toast.error(errorMsg);
    onError?.(errorMsg);
    return { success: false, error: errorMsg };
  }

  // Use the provided NFT contract address or fallback to agent.agent_address
  const nftAddress = nftContractAddress || agent.agent_address;
  
  // Set minting state to true
  const mintingState = { [nftAddress]: true };
  onMintingStateChange?.(mintingState);

  try {
    
    if (!nftAddress) {
      const errorMsg = "NFT contract address not available";
      toast.error(errorMsg);
      onError?.(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Prepare agent data for minting
    const agentData = {
      nft_address: nftAddress,
      collection_id: nftAddress,
      originalId: agent.id,
    };

    // Attempt to mint the NFT
    const result = await mintAgentNft(skyBrowser, agentData);

    if (result) {
      toast.success("Agent NFT minted successfully!");

      // Wait for transaction to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get the newly minted agent NFT ID
      if (nftAddress) {
        const newAgentId = await getAgentIdByAgentAddress(
          nftAddress,
          userAddress,
          skyBrowser
        );

        if (newAgentId) {
          onSuccess?.(newAgentId);
          return { success: true, agentId: newAgentId };
        } else {
          const errorMsg = "NFT minted but agent ID not found";
          toast.error(errorMsg);
          onError?.(errorMsg);
          return { success: false, error: errorMsg };
        }
      }
    } else {
      const errorMsg = "Failed to mint agent NFT";
      toast.error(errorMsg);
      onError?.(errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to mint agent NFT";
    console.error("Error minting agent NFT:", error);
    toast.error(errorMsg);
    onError?.(errorMsg);
    return { success: false, error: errorMsg };
  } finally {
    // Set minting state to false
    const mintingState = { [nftAddress]: false };
    onMintingStateChange?.(mintingState);
  }

  return { success: false, error: "Unknown error occurred" };
};

/**
 * Hook-like function for managing minting state
 * Returns a function that can be used to mint NFTs with proper state management
 */
export const createMintingHandler = (
  skyBrowser: any,
  userAddress: string,
  setMinting: (updater: (prev: MintingState) => MintingState) => void,
  setSelectedAgentNFTId?: (id: string) => void,
  nftContractAddress?: string
) => {
  return async (agent: AgentWithOwnership): Promise<MintingResult> => {
    return mintAgentNFTWithHelper(agent, skyBrowser, userAddress, {
      onSuccess: (agentId) => {
        setSelectedAgentNFTId?.(agentId);
      },
      onError: (error) => {
        console.error("Minting error:", error);
      },
      onMintingStateChange: (minting) => {
        setMinting(() => minting);
      },
    }, nftContractAddress);
  };
};

/**
 * Utility function to check if an agent can be minted
 */
export const canMintAgent = (agent: AgentWithOwnership, skyBrowser: any): boolean => {
  return !!(agent && skyBrowser && agent.is_deployed);
};

/**
 * Utility function to get minting status for an agent
 */
export const getMintingStatus = (agentAddress: string, mintingState: MintingState): boolean => {
  return mintingState[agentAddress] || false;
};
