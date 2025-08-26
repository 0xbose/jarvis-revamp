export type ChatMsg = {
	id: string;
	type:
		| "user"
		| "response"
		| "question"
		| "answer"
		| "workflow_subnet"
		| "pending"
		| "notification";
	content: string;
	timestamp: Date;
	subnetStatus?:
		| "pending"
		| "in_progress"
		| "done"
		| "failed"
		| "awaiting_response";
	toolName?: string;
	subnetIndex?: number;
	imageData?: string;
	isImage?: boolean;
	contentType?: string;
	questionData?: {
		type: string;
		text: string;
		itemID: number;
		expiresAt: string;
		authUrl?: string;
	};
	sourceId?: string;
	isRegenerated?: boolean;
	contentHash?: string;
	question?: string;
	answer?: string;
	prompt?: string;
	isTimeoutMessage?: boolean;
	showRefreshButton?: boolean;
	showLoadingDots?: boolean;
};

export type FeedbackHistoryItem = {
	workflow_id: string;
	item_id: number;
	feedback_question: string;
	response: {
		success: boolean;
		message: string;
		data: any;
		fileData?: string;
		contentType?: string;
	};
	user_answer: string | null;
	continue: boolean;
	created_at: string;
	updated_at: string;
};

export type WorkflowStatus =
	| "running"
	| "stopped"
	| "completed"
	| "failed"
	| "awaiting_response"
	| "in_progress"
	| "waiting"
	| "pending";

export interface AgentResponse {
	content: string | null;
	imageData?: string;
	isImage?: boolean;
	contentType?: string;
}

export interface StatusTransition {
	prev: string | undefined;
	current: string;
	isRegenerating: boolean;
	isShowingQuestion: boolean;
}

export interface FeedbackState {
	preFeedbackContent: Map<number, string>;
	feedbackGivenForSubnet: Set<number>;
	subnetPreviousStatus: Map<number, string>;
	postFeedbackProcessing: Map<number, boolean>;
}
