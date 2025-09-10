// Agent Types
export interface Agent {
	id: string;
	name: string;
	description: string;
	agent_address: string;
	is_deployed: boolean;
	created_at: string;
	updated_at: string;
}

export interface SubnetItem {
	unique_id: string;
	itemID: number;
	inputItemID: number[];
	systemPrompt: string;
	id: string;
	hints: string[];
	input: string;
	doubts: string[];
	output: string;
	prompt: string;
	subnetID: string;
	reasoning: string;
	subnetURL: string;
	fileUpload: boolean;
	subnetName: string;
	description: string;
	fileDownload: boolean;
	expectedInput: string;
	promptExample: string;
	expectedOutput: string;
	supports_rabbitmq?: boolean;
	agentCollection?: {
		agentAddress: string;
		agentID: string;
	};
	feedback?: boolean; // Optional feedback property for workflow execution
}

export interface AgentDetail extends Agent {
	id: string;
	subnet_list: SubnetItem[];
	user_address: string;
	layout: AgentLayout;
	is_deployed: boolean;
	ipfs_hash: string;
	collection_id: string;
	nft_address: string;
	agentNFTId?: string;
	image?: string;
	nft_id?: string;
	agent_uuid?: string;
}

export interface AgentLayout {
	startPosition: { x: number; y: number };
	endPosition: { x: number; y: number };
	subnetPositions: { [key: string]: { x: number; y: number } };
}

// Workflow Execution Types
export interface WorkflowExecutionPayload {
	agentId?: string;
	prompt: string;
	workflow: WorkflowItem[];
	userAuthPayload?: {
		userAddress: string;
		signature: string;
		message: string;
	};
	accountNFT?: {
		collectionID: string;
		nftID: string;
	};
	activeNodeId?: string;
}

export interface WorkflowItem {
	itemID: string;
	agentCollection: {
		agentAddress: string;
		agentID: string;
	};
	feedback?: boolean;
}

export interface WorkflowExecutionResponse {
	requestId: string;
	status:
		| "pending"
		| "processing"
		| "in_progress"
		| "waiting"
		| "completed"
		| "error";
	message?: string;
	data?: Record<string, unknown>;
	workflowStatus?: string;
	currentSubnet?: string;
	// Additional fields from the actual API response
	userAddress?: string;
	percentage?: number;
	totalSubnets?: number;
	completedSubnets?: number;
	authUrl?: string | null;
	authRequiredSubnet?: string | null;
	createdAt?: string;
	updatedAt?: string;
	lastActivity?: string;
	subnets?: Array<{
		itemID: number;
		toolName: string;
		status:
			| "pending"
			| "in_progress"
			| "completed"
			| "failed"
			| "awaiting_response";
		data: any;
		prompt: string | null;
		question?: {
			type: string;
			text: string;
			itemID: number;
			expiresAt: string;
		};
	}>;
}

// Web3 Types
export enum CONNECT_STATES {
	INITIALIZING = "INITIALIZING",
	IDLE = "IDLE",
	CONNECTING = "CONNECTING",
	CONNECTED = "CONNECTED",
	ERROR = "ERROR",
	DISCONNECTING = "DISCONNECTING",
}

export interface IWeb3State {
	address: string;
	isAuthenticated: boolean;
}

export type WalletType = "metamask" | "phantom";

// API Response Types
export interface AgentResponse {
	success: boolean;
	data: {
		agents: Agent[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
			hasNext: boolean;
			hasPrev: boolean;
		};
	};
	message: string;
}

export interface AgentDetailResponse {
	success: boolean;
	data: AgentDetail;
	message: string;
}

// Agent Generation Types
export interface AgentGenerationRequest {
	prompt: string;
	userAuthPayload?: {
		userAddress: string;
		signature: string;
		message: string;
	};
	accountNFT?: {
		collectionID: string;
		nftID: string;
	};
}

export interface AgentGenerationResponse {
	status: "pending" | "processing" | "completed" | "error";
	progress?: number;
	message?: string;
	agentData?: Partial<AgentDetail>;
	error?: string;
	requestId?: string;
}

export interface AgentGenerationProgress {
	stage: string;
	progress: number;
	message: string;
	timestamp: string;
}

// API Key Types
export interface ApiKeyData {
	apiKey: string;
	userAddress: string;
	nftId: string;
	timestamp: number;
}

// Execution Status Types - Now consolidated in workflow-execution-store
// export interface ExecutionStatus {
// 	isRunning: boolean;
// 	responseId?: string;
// 	currentSubnet?: string;
// }

// UI State Types
export interface TestStatus {
	isRunning: boolean;
	status: string;
}

// History Types
export interface HistoryItem {
	id: string;
	requestId: string;
	agentId?: string;
	agentAddress?: string;
	agentName?: string;
	userPrompt?: string;
	status:
		| "in_progress"
		| "completed"
		| "pending"
		| "failed"
		| "stopped"
		| "awaiting_response";
	createdAt: string;
	updatedAt: string;
	percentage?: number;
	totalSubnets?: number;
	completedSubnets?: number;
	userAddress?: string;
	agentIDFromCollection?: string;
}

export interface HistoryResponse {
	success: boolean;
	data: {
		requests: HistoryItem[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
			hasNext: boolean;
			hasPrev: boolean;
		};
	};
	message: string;
}

// New workflow response format
export interface WorkflowResponse {
	workflows: HistoryItem[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
	timestamp: string;
}

export interface UIState {
	testStatus: TestStatus;
}

// Global Window Types
declare global {
	interface Window {
		solana?: Record<string, unknown>;
	}
}
