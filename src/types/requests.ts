export type WorkflowRequestStatus =
  | "in_progress"
  | "waiting"
  | "completed"
  | "pending"
  | "failed"
  | "stopped"
  | "awaiting_response";

export interface WorkflowRequest {
  requestId: string;
  status: WorkflowRequestStatus;
  agentId: string;
  agentAddress: string;
  agentIDFromCollection: string;
  userPrompt: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  totalSubnets: number;
  completedSubnets: number;
  questionType: string | null;
}

export interface WorkflowRequestsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface WorkflowRequestsResponse {
  workflows: WorkflowRequest[];
  pagination: WorkflowRequestsPagination;
  timestamp: string; // ISO date string
}
