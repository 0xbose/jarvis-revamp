export const RPC_CONFIG = {
	HELIUS_RPC_URL:
		"https://mainnet.helius-rpc.com/?api-key=c73b793a-38da-4141-ad57-97d71c264a76",
	ARBITRUM_RPC_URL:
		"https://arb-mainnet.g.alchemy.com/v2/2Xl0kiqyNVT5An-x05eclIgbpBMYVjAD",
	BSC_RPC_URL: "https://bsc-dataseed.binance.org",
	ETH_RPC_URL: "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
	OPTIMISM_RPC_URL: "https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
	BASE_RPC_URL: "https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
} as const;

export const CHAIN_CONFIG = {
	SOLANA: {
		id: "SOL",
		name: "Solana",
		logoURI:
			"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/solana.svg",
	},
} as const;

export const LIQUIDITY_CONFIG = {
	DEFAULT_SLIPPAGE: 0.03,
	MIN_AMOUNT: 0.001,
} as const;
