import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface SubnetStatus {
	itemID: number;
	toolName: string;
	status:
		| "pending"
		| "in_progress"
		| "waiting"
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
}

export interface WorkflowExecutionStatus {
	requestId: string;
	userAddress: string;
	workflowStatus:
		| "pending"
		| "in_progress"
		| "waiting"
		| "completed"
		| "failed"
		| "stopped"
		| "awaiting_response";
	percentage: number;
	totalSubnets: number;
	completedSubnets: number;
	authUrl: string | null;
	authRequiredSubnet: string | null;
	createdAt: string;
	updatedAt: string;
	lastActivity: string;
	subnets: SubnetStatus[];
}

interface WorkflowExecutionStoreState {
	currentExecution: WorkflowExecutionStatus | null;
	executionHistory: WorkflowExecutionStatus[];
	isPolling: boolean;

	// Actions
	setCurrentExecution: (execution: WorkflowExecutionStatus | null) => void;
	updateExecutionStatus: (execution: WorkflowExecutionStatus) => void;
	addToExecutionHistory: (execution: WorkflowExecutionStatus) => void;
	setPollingStatus: (isPolling: boolean) => void;
	clearCurrentExecution: () => void;
	clearExecutionHistory: () => void;
	stopCurrentExecution: () => void;
	reset: () => void;
}

export const useWorkflowExecutionStore = create<WorkflowExecutionStoreState>()(
	subscribeWithSelector((set) => ({
		currentExecution: null,
		executionHistory: [],
		isPolling: false,

		setCurrentExecution: (execution) =>
			set({ currentExecution: execution }),

		updateExecutionStatus: (execution) =>
			set((state) => ({
				...state,
				currentExecution: execution,
				executionHistory: state.executionHistory.map((item) =>
					item.requestId === execution.requestId ? execution : item
				),
			})),

		addToExecutionHistory: (execution) =>
			set((state) => ({
				executionHistory: [...state.executionHistory, execution],
			})),

		setPollingStatus: (isPolling) => set({ isPolling }),

		clearCurrentExecution: () => set({ currentExecution: null }),

		clearExecutionHistory: () => set({ executionHistory: [] }),

		stopCurrentExecution: () =>
			set((state) => ({
				...state,
				isPolling: false,
				currentExecution: state.currentExecution
					? {
							...state.currentExecution,
							workflowStatus: "stopped" as const,
							updatedAt: new Date().toISOString(),
							lastActivity: new Date().toISOString(),
					  }
					: null,
			})),

		reset: () =>
			set({
				currentExecution: null,
				executionHistory: [],
				isPolling: false,
			}),
	}))
);
