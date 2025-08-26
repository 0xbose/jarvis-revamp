import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

// Simplified chat store - only for transient UI state
// Persistent data now handled by TanStack Query + IndexDB
interface ChatStore {
	// Current UI State Only
	workflowStatus:
		| "idle"
		| "running"
		| "completed"
		| "failed"
		| "auth_required";
	percentage: number;
	currentSubnet?: string;
	
	// Transient UI State
	isLoading: boolean;
	error: string | null;

	// Actions - Workflow Management (transient only)
	setWorkflowStatus: (status: ChatStore["workflowStatus"]) => void;
	setPercentage: (percentage: number) => void;
	setCurrentSubnet: (subnet: string) => void;

	// Actions - UI State
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	clearError: () => void;

	// Reset
	reset: () => void;
}

export const useChatStore = create<ChatStore>()(
	subscribeWithSelector((set) => ({
		// Initial State - No persistence needed
		workflowStatus: "idle",
		percentage: 0,
		currentSubnet: undefined,
		isLoading: false,
		error: null,

		// Workflow Management Actions (UI state only)
		setWorkflowStatus: (status) => set({ workflowStatus: status }),
		setPercentage: (percentage) => set({ percentage }),
		setCurrentSubnet: (subnet) => set({ currentSubnet: subnet }),

		// UI State Actions
		setLoading: (loading) => set({ isLoading: loading }),
		setError: (error) => set({ error }),
		clearError: () => set({ error: null }),

		// Reset
		reset: () =>
			set({
				workflowStatus: "idle",
				percentage: 0,
				currentSubnet: undefined,
				isLoading: false,
				error: null,
			}),
	}))
);
