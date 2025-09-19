// API Configuration
export const API_CONFIG = {
	API_BASE_URL: "https://skynetagent-c0n525.stackos.io/api",
	X_API_KEY:
		"sky_9b158f1e696bdc687e101a65c69335282630c2c134512b0d0276f64f45c2364b",

	NFT_USER_AGENT_URL: "https://useragent-c0n639.stackos.io",
	REDIS_USER_AGENT_URL: "https://redisagent-c0n639.stackos.io",

	STORAGE_API: "https://lighthouseservice-c0n1.stackos.io",
	SKYINTEL_API: "https://skyintel-c0n1.stackos.io/",

	CHAT_ACCESSPOINT_URL: "https://jarvischat-c0n648.stackos.io",
	TASK_SCHEDULER_ACCESSPOINT_URL: "https://taskschedular-c0n648.stackos.io",

	WEB3AUTH_CLIENT_ID:
		"BFMHaURTzER--ksK8FwGk3Dv242l-YmrkErFJwnsjl4i4-NiHOqNow8WgjnZQi4QegSt7u9pURyRs9ptwImZqy0",

	BATCH_SIZE: 20,
	MAX_RETRIES: 3,
	RETRY_DELAY: 2000,
} as const;

// Socket Configuration ONLY for Agent Generation
export const NATURAL_REQUEST_SOCKET_CONFIG = {
	URL: API_CONFIG.SKYINTEL_API,
	TRANSPORTS: ["websocket"] as const,
	TIMEOUT: 600000,
	RECONNECTION: true,
	RECONNECTION_ATTEMPTS: 3,
	RECONNECTION_DELAY: 2000,
} as const;

// Workflow Execution URLs
export const WORKFLOW_ENDPOINTS = {
	// Full workflow execution
	FULL_WORKFLOW: `${API_CONFIG.NFT_USER_AGENT_URL}/natural-request`,
	FULL_WORKFLOW_STATUS: `${API_CONFIG.REDIS_USER_AGENT_URL}/api/workflows`,
	// Emergency stop and resume endpoints
	EMERGENCY_STOP: `${API_CONFIG.NFT_USER_AGENT_URL}/natural-request`,
	RESUME_WORKFLOW: `${API_CONFIG.NFT_USER_AGENT_URL}/natural-request`,
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
		RPC_URL: "https://rpc.skynet.io",
		EXPLORER_URL: "https://explorer.skynet.io",
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
