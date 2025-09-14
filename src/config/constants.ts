// API Configuration
export const API_CONFIG = {
	STORAGE_API: process.env.NEXT_PUBLIC_STORAGE_API_URL,
	SKYINTEL_API: process.env.NEXT_PUBLIC_SKYINTEL_API_URL,
	NFT_USER_AGENT_URL: process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL,
	REDIS_USER_AGENT_URL: process.env.NEXT_PUBLIC_REDIS_USER_AGENT_URL,
	CHAT_ACCESSPOINT_URL: process.env.NEXT_PUBLIC_CHAT_ACCESSPOINT_URL,
	BATCH_SIZE: 20,
	MAX_RETRIES: 3,
	RETRY_DELAY: 2000,
} as const;

// Socket Configuration ONLY for Agent Generation
export const NATURAL_REQUEST_SOCKET_CONFIG = {
	URL: process.env.NEXT_PUBLIC_SKYINTEL_API_URL,
	TRANSPORTS: ["websocket"] as const,
	TIMEOUT: 600000,
	RECONNECTION: true,
	RECONNECTION_ATTEMPTS: 3,
	RECONNECTION_DELAY: 2000,
} as const;

// Workflow Execution URLs
export const WORKFLOW_ENDPOINTS = {
	// Full workflow execution
	FULL_WORKFLOW: `${process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL}/natural-request`,
	FULL_WORKFLOW_STATUS: `${process.env.NEXT_PUBLIC_REDIS_USER_AGENT_URL}/api/workflows`,
	// Emergency stop and resume endpoints
	EMERGENCY_STOP: `${process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL}/natural-request`,
	RESUME_WORKFLOW: `${process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL}/natural-request`,
} as const;

// API Key Generation
export const API_KEY_CONFIG = {
	GENERATION_URL:
		"https://lighthouseservice-c0n1.stackos.io/generate-api-key",
	STORAGE_KEY: "skynet_api_key",
	VALIDITY_DURATION: 90 * 24 * 60 * 60 * 1000, // 3 months (90 days)
} as const;

// Network Configuration
export const NETWORK_CONFIG = {
	SKYNET: {
		CHAIN_ID: 619,
		CHAIN_ID_HEX: "0x26B",
		RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.skynet.io",
		EXPLORER_URL:
			process.env.NEXT_PUBLIC_EXPLORER_URL ||
			"https://explorer.skynet.io",
		TICKER: "sUSD",
		TICKER_NAME: "sUSD",
		DISPLAY_NAME: "Skynet",
	},
} as const;

// App Configuration
export const APP_CONFIG = {
	NAME: "Jarvis AI",
	DESCRIPTION: "Jarvis AI - The Everything AI",
	VERSION: "2.0.0",
	SUPPORTED_NETWORKS: ["SKYNET"],
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
	SELECTED_HISTORIES_COUNT: "jarvis_selected_histories_count",
	IS_PINNED: "jarvis_sidebar_is_pinned",
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
	ENABLE_NFT_MINTING: true,
	ENABLE_AGENT_MANAGEMENT: true,
	ENABLE_WALLET_CONNECTION: true,
	ENABLE_REAL_TIME_UPDATES: true,
} as const;

// Status Constants
export const STATUS = {
	IDLE: "idle",
	PROCESSING: "processing",
	TEST_COMPLETED: "test_completed",
	FAILED: "failed",
} as const;

