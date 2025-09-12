/**
 * Type definitions for Skynet helper functions and utilities
 */

/**
 * Web3 context containing user address
 */
export interface Web3Context {
	address: string;
}

/**
 * Agent data structure for NFT operations
 */
export interface AgentData {
	nft_address?: string;
	collection_id?: string;
	originalId?: string;
}

/**
 * Web3 authentication provider
 */
export interface Web3Auth {
	provider?: unknown;
}

/**
 * Result of NFT operations
 */
export interface NFTResult {
	success: boolean;
	nftId?: string;
	action?:
		| "existing"
		| "minted"
		| "error"
		| "registration_error"
		| "insufficient_funds"
		| "mint_failed"
		| "mint_verification_failed";
	message?: string;
	mintPrice?: string;
	userBalance?: string;
	error?: string;
}

/**
 * Result of agent NFT operations
 */
export interface AgentNFTResult {
	success: boolean;
	agentId?: string;
	action?:
		| "existing"
		| "minted"
		| "error"
		| "not_registered"
		| "insufficient_funds"
		| "mint_verification_failed";
	message?: string;
	mintPrice?: string;
	userBalance?: string;
}

/**
 * API request payload structure
 */
export interface APIPayload {
	prompt: string;
	userAuthPayload: {
		userAddress: string;
		signature: string;
		message: string;
	};
	nftId: string;
}

/**
 * Knowledge base request payload
 */
export interface KnowledgeBasePayload {
	prompt: string;
	userAuthPayload: {
		userAddress: string;
		signature: string;
		message: string;
	};
	accountNFT: {
		collectionID: string;
		nftID: string;
	};
	agentCollection: {
		agentAddress: string;
		agentID?: string;
	};
}

/**
 * NFT ownership verification result
 */
export interface VerificationResult {
	success: boolean;
	balance: string;
	tokenIds: string[];
	message: string;
}

/**
 * NFT registration check result
 */
export interface RegistrationCheck {
	isRegistered: boolean;
	registeredData?: unknown;
	mintPrice?: string;
	isActive?: boolean;
	error?: string;
}

/**
 * Balance check result
 */
export interface BalanceCheckResult {
	hasBalance: boolean;
	mintPrice: string;
	userBalance?: string;
	error?: string;
}

/**
 * Authentication response structure
 */
export interface AuthResponse {
	success: boolean;
	data: {
		userAddress: string;
		signature: string;
		message: string;
	};
}

/**
 * Contract service configuration
 */
export interface ContractServiceConfig {
	provider: unknown;
	signer: any;
	address: string;
	chainId: number;
}

/**
 * SkyBrowser environment configuration
 */
export interface SkyBrowserConfig {
	storageApi: string;
	cache: {
		type: string;
	};
}
