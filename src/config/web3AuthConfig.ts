import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { Web3AuthOptions } from "@web3auth/modal";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { API_CONFIG, NETWORK_CONFIG } from "./constants";

export type ChainType = "mainnet";

interface ChainConfig {
	chainId: string;
	rpcTarget: string;
	displayName: string;
	blockExplorerUrl: string;
	ticker: string;
	tickerName: string;
}

// Chain configuration for Skynet
const CHAIN_CONFIG: ChainConfig = {
	chainId: NETWORK_CONFIG.SKYNET.CHAIN_ID_HEX,
	rpcTarget: NETWORK_CONFIG.SKYNET.RPC_URL || "",
	displayName: NETWORK_CONFIG.SKYNET.DISPLAY_NAME,
	blockExplorerUrl: NETWORK_CONFIG.SKYNET.EXPLORER_URL || "",
	ticker: NETWORK_CONFIG.SKYNET.TICKER,
	tickerName: NETWORK_CONFIG.SKYNET.TICKER_NAME,
};

const clientId = API_CONFIG.WEB3AUTH_CLIENT_ID;

// EVM Chain Config
const chainConfig = {
	chainNamespace: CHAIN_NAMESPACES.EIP155,
	...CHAIN_CONFIG,
};

// Web3Auth Options
const web3AuthOptions: Web3AuthOptions = {
	clientId: clientId || "", // Fallback client ID
	web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
	chainConfig,
	privateKeyProvider: new EthereumPrivateKeyProvider({
		config: { chainConfig },
	}),
	// UI Configuration (simplified for base plan)
	uiConfig: {
		loginMethodsOrder: [
			"google",
			"facebook",
			"twitter",
			"reddit",
			"discord",
			"twitch",
			"apple",
			"line",
			"github",
			"kakao",
			"linkedin",
			"weibo",
			"wechat",
			"email_passwordless",
		],
		defaultLanguage: "en",
		loginGridCol: 3,
		primaryButton: "externalLogin",
	},
	// Session Management
	sessionTime: 86400, // 24 hours
	// Additional Configuration for better error handling
	enableLogging: true,
};

export const web3AuthConfig = {
	web3AuthOptions,
	clientId,
	chainConfig,
};
