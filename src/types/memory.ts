export interface NodeContextAgentCollection {
  agentAddress: string;
  agentID: string;
}

export interface NodeContext {
  id: string;
  agent_id: string;
  api_key: string;
  item_id: string;
  agent_collection: NodeContextAgentCollection;
  created_at: string;
  updated_at: string;
}

export interface NodeContextResponse {
  success: boolean;
  data: NodeContext;
  message: string;
}

