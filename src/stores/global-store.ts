import { AgentDetailResponse, UserAgentCollection } from "@/types/agents";
import { Agent } from "@/types";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

// Global Store State
interface GlobalStore {
	// User and Wallet Management
	userAddress: string | null;
	accountNFTId: string | null;

	// Mode and Agent Management
	mode: "chat" | "agent";
	prompt: string;
	selectedAgent: AgentDetailResponse | UserAgentCollection | null;

	// Model selection for chat
	selectedModel: { id: string; name: string } | null;

	// Auto Mode
	autoMode: boolean;

	// Actions - Wallet & NFT Management
	setUserAddress: (address: string | null) => void;
	setAccountNFTId: (nftId: string | null) => void;

	setMode: (mode: "chat" | "agent") => void;
	setPrompt: (prompt: string) => void;
	setSelectedAgent: (
		agent: AgentDetailResponse | UserAgentCollection | null
	) => void;
	setSelectedModel: (model: { id: string; name: string } | null) => void;

	reset: () => void;
}

export const useGlobalStore = create<GlobalStore>()(
	subscribeWithSelector((set) => ({
		// Initial State
		userAddress: null,
		accountNFTId: null,
		mode: "agent",
		prompt: "",
		selectedAgent: null,
		selectedModel: null,
		autoMode: false,

		// Wallet & NFT Management Actions
		setUserAddress: (address) => set({ userAddress: address }),
		setAccountNFTId: (nftId) => set({ accountNFTId: nftId }),

		// Mode Management Actions
		setMode: (mode) => {
			console.log("🔧 Global Store: Setting mode to:", mode);
			set({ mode });
		},
		setPrompt: (prompt) => {
			console.log("🔧 Global Store: Setting prompt to:", `"${prompt}"`);
			set({ prompt });
		},
		setSelectedAgent: (agent) => {
			console.log(
				"🔧 Global Store: Setting selected agent to:",
				agent?.name,
				agent
			);
			set({ selectedAgent: agent });
		},
		setSelectedModel: (model) => {
			console.log(
				"🔧 Global Store: Setting selected model to:",
				model?.name,
				model
			);
			set({ selectedModel: model });
		},

		// Reset
		reset: () =>
			set({
				userAddress: null,
				accountNFTId: null,
				mode: "agent",
				prompt: "",
				selectedAgent: null,
				selectedModel: null,
			}),
	}))
);
