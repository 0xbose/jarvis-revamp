import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { Agent, AgentDetail } from "@/types";

// Global Store State
interface GlobalStore {
	// User and Wallet Management
	userAddress: string | null;
	accountNFTId: string | null;

	// Mode and Agent Management
	mode: "chat" | "agent";
	prompt: string;
	selectedAgent: Agent | AgentDetail | null;

	// Auto Mode
	autoMode: boolean;

	// Actions - Wallet & NFT Management
	setUserAddress: (address: string | null) => void;
	setAccountNFTId: (nftId: string | null) => void;

	setMode: (mode: "chat" | "agent") => void;
	setPrompt: (prompt: string) => void;
	setSelectedAgent: (agent: Agent | AgentDetail | null) => void;

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
			console.log(
				"🔧 Global Store: Setting prompt to:",
				`"${prompt}"`
			);
			set({ prompt });
		},
		setSelectedAgent: (agent) => {
			console.log(
				"🔧 Global Store: Setting selected agent to:",
				agent?.name,
				agent?.id
			);
			set({ selectedAgent: agent });
		},

		// Reset
		reset: () =>
			set({
				userAddress: null,
				accountNFTId: null,
				mode: "agent",
				prompt: "",
				selectedAgent: null,
			}),
	}))
);
