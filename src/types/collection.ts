export interface AgentCollection {
  id: number;
  agent_collection_address: string;
  agent_id: string;
  verified_flag: boolean;
  verification_type: string;
  created_at: string;œ
  updated_at: string; 
}

export interface AgentCollectionsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface GetAgentCollectionsResponse {
  success: boolean;
  data: {
    agent_collections: AgentCollection[];
    pagination: AgentCollectionsPagination;
  };
  message: string;
}
