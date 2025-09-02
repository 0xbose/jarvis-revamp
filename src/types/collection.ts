export interface CollectionAgent {
  id: string;
  name: string;
  description: string;
  is_deployed: boolean;
  created_at: string;
  updated_at: string;
  agent_address: string;
  isVerified: boolean;
  image: string | null;
}

export interface CollectionPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CollectionAgentsResponse {
  success: boolean;
  data: {
    agents: CollectionAgent[];
    pagination: CollectionPagination;
  };
  message: string;
}

export interface SubnetItem {
  itemID: number;
  feedback: boolean;
  unique_id: string;
  inputItemID: number[];
  systemPrompt: string;
}

export interface CollectionLayout {
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

export interface CollectionDetail {
  id: string;
  name: string;
  description: string;
  subnet_list: SubnetItem[];
  user_address: string;
  created_at: string;
  updated_at: string;
  ipfs_hash: string;
  collection_id: string;
  nft_address: string;
  is_deployed: boolean;
  layout: CollectionLayout;
  isVerified: boolean;
  image: string | null;
}

export interface CollectionDetailResponse {
  success: boolean;
  data: CollectionDetail;
  message: string;
}
