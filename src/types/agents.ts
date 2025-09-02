export interface UserAgentCollection {
  id: string;
  collection_address: string;
  name: string;
  description: string;
  user_address: string;
  image: string | null;
  created_at: string;
  updated_at: string;
  agent_uuid: string;
  nft_id: string;
  agent_name: string;
  agent_description: string;
  agent_image: string | null;
  agent_isverified: boolean;
}

export interface UserAgentCollectionsResponse {
  user_collections: UserAgentCollection[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  message?: string;
}

export interface AgentSubnet {
  itemID: number;
  unique_id: string;
  inputItemID: number[];
  systemPrompt: string;
}

export interface AgentLayout {
  endPosition: {
    x: number;
    y: number;
  };
  startPosition: {
    x: number;
    y: number;
  };
  subnetPositions: {
    [key: string]: {
      x: number;
      y: number;
    };
  };
}

export interface AgentDetailResponse {
  id: string;
  name: string;
  description: string;
  subnet_list: AgentSubnet[];
  user_address: string;
  created_at: string;
  updated_at: string;
  ipfs_hash: string;
  collection_id: string;
  nft_address: string;
  is_deployed: boolean;
  layout: AgentLayout;
  isVerified: boolean;
  image: string | null;
  // Optionally, add more fields as needed
}
