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
		authUrl?: string;
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

// Consolidated execution status interface
export interface ExecutionStatus {
	isRunning: boolean;
	responseId?: string;
	currentSubnet?: string;
}

interface WorkflowExecutionStoreState {
	// Basic execution status (consolidated from execution-status-store)
	executionStatus: ExecutionStatus;
	
	// Detailed workflow execution state
	currentExecution: WorkflowExecutionStatus | null;
	executionHistory: WorkflowExecutionStatus[];
	
	// Polling and UI state
	isPolling: boolean;
	isPollingTimedOut: boolean;
	shouldShowRefreshUI: boolean;
	pollingDuration: number;
	timeSinceStatusChange: number;

	// Actions for basic execution status
	updateExecutionStatus: (status: Partial<ExecutionStatus>) => void;
	resetExecutionStatus: () => void;
	
	// Actions for workflow execution
	setCurrentExecution: (execution: WorkflowExecutionStatus | null) => void;
	updateWorkflowExecutionStatus: (execution: WorkflowExecutionStatus) => void;
	addToExecutionHistory: (execution: WorkflowExecutionStatus) => void;
	setPollingStatus: (isPolling: boolean) => void;
	setPollingTimeoutStatus: (isTimedOut: boolean) => void;
	setRefreshUIStatus: (shouldShow: boolean) => void;
	setPollingTimers: (duration: number, timeSinceChange: number) => void;
	clearCurrentExecution: () => void;
	clearExecutionHistory: () => void;
	stopCurrentExecution: () => void;
	
	// Consolidated reset
	reset: () => void;
}

export const useWorkflowExecutionStore = create<WorkflowExecutionStoreState>()(
	subscribeWithSelector((set) => ({
		// Basic execution status
		executionStatus: {
			isRunning: false,
			responseId: undefined,
			currentSubnet: undefined,
		},
		
		// Detailed workflow execution state
		currentExecution: null,
		executionHistory: [],
		
		// Polling and UI state
		isPolling: false,
		isPollingTimedOut: false,
		shouldShowRefreshUI: false,
		pollingDuration: 0,
		timeSinceStatusChange: 0,

		// Actions for basic execution status
		updateExecutionStatus: (status) =>
			set((state) => ({
				...state,
				executionStatus: {
					...state.executionStatus,
					...status,
				},
			})),
			
		resetExecutionStatus: () =>
			set((state) => ({
				...state,
				executionStatus: {
					isRunning: false,
					responseId: undefined,
					currentSubnet: undefined,
				},
			})),

		// Actions for workflow execution
		setCurrentExecution: (execution) =>
			set({ currentExecution: execution }),

		updateWorkflowExecutionStatus: (execution) =>
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

		setPollingTimeoutStatus: (isTimedOut) => set({ isPollingTimedOut: isTimedOut }),

		setRefreshUIStatus: (shouldShow) => set({ shouldShowRefreshUI: shouldShow }),

		setPollingTimers: (duration, timeSinceChange) =>
			set({ pollingDuration: duration, timeSinceStatusChange: timeSinceChange }),

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

		// Consolidated reset
		reset: () =>
			set({
				executionStatus: {
					isRunning: false,
					responseId: undefined,
					currentSubnet: undefined,
				},
				currentExecution: null,
				executionHistory: [],
				isPolling: false,
				isPollingTimedOut: false,
				shouldShowRefreshUI: false,
				pollingDuration: 0,
				timeSinceStatusChange: 0,
			}),
	}))
);

// Export the old store name for backward compatibility
export const useExecutionStatusStore = useWorkflowExecutionStore;
