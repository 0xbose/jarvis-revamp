import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import SkyBrowserSigner from "@decloudlabs/skynet/lib/services/SkyBrowserSigner";
import SkyEtherContractService from "@decloudlabs/skynet/lib/services/SkyEtherContractService";
import { SkyEnvConfigBrowser } from "@decloudlabs/skynet/lib/types/types";
import { Eip1193Provider, ethers } from "ethers";
import axios, { AxiosError } from "axios";
import { API_CONFIG } from "@/config/constants";
import { NFT__factory } from "@decloudlabs/skynet/lib/types/contracts";
import { KNOWLEDGE_PROMPTS } from "@/constants/knowledge";
import type {
	Web3Context,
	AgentData,
	Web3Auth,
	NFTResult,
	AgentNFTResult,
	APIPayload,
	KnowledgeBasePayload,
	VerificationResult,
	RegistrationCheck,
	BalanceCheckResult,
	AuthResponse,
} from "@/types/skynet";

/**
 * Constants for knowledge base operations
 */
export const KNOWLEDGE_TYPES = {
	AGENT: "agent",
	SWARM: "swarm",
} as const;

/**
 * HTTP content types
 */
export const CONTENT_TYPES = {
	JSON: "application/json",
} as const;

/**
 * Configuration constants
 */
const SKYNET_CHAIN_ID = 619;
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const MAX_RETRIES = 3;
const BATCH_SIZE = 20;

/**
 * Fetches all NFTs owned by a user address with batch processing
 * @param address - User's wallet address
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<string[]> - Array of NFT IDs owned by the user
 */
export const fetchNfts = async (
	address: string,
	skyBrowser: SkyMainBrowser
): Promise<string[]> => {
	if (!address || !skyBrowser?.contractService?.AgentNFT) {
		console.error("Invalid parameters for fetchNfts");
		return [];
	}

	try {
		// Get cached NFTs from localStorage
		const cachedNfts = getCachedNfts(address);
		let storedNfts = [...cachedNfts];
		let selectedNftId = localStorage.getItem(`selectedNftId-${address}`);

		// Get total NFT count
		const nftCount = await skyBrowser.contractService.AgentNFT.balanceOf(
			address
		);
		if (!nftCount || nftCount === BigInt(0)) {
			return [];
		}

		const totalCount = Number(nftCount);
		let currentIndex = storedNfts.length;

		// Fetch NFTs in batches
		while (currentIndex < totalCount) {
			const batchResults = await fetchNftBatch(
				skyBrowser,
				address,
				currentIndex,
				Math.min(currentIndex + BATCH_SIZE, totalCount)
			);

			if (batchResults.length > 0) {
				storedNfts = [...storedNfts, ...batchResults].sort(
					(a, b) => Number(b) - Number(a)
				);
				updateCachedNfts(address, storedNfts);
			}

			currentIndex += BATCH_SIZE;
		}

		// Validate and update selected NFT
		await validateAndUpdateSelectedNft(
			address,
			selectedNftId,
			storedNfts,
			skyBrowser
		);

		return storedNfts;
	} catch (error) {
		console.error("Error fetching NFTs:", error);
		return [];
	}
};

/**
 * Helper function to fetch a batch of NFTs
 */
const fetchNftBatch = async (
	skyBrowser: SkyMainBrowser,
	address: string,
	startIndex: number,
	endIndex: number
): Promise<string[]> => {
	const batchPromises = [];

	for (let i = startIndex; i < endIndex; i++) {
		batchPromises.push(
			skyBrowser.contractService.AgentNFT.tokenOfOwnerByIndex(address, i)
		);
	}

	const batchResults = await Promise.all(batchPromises);
	return batchResults.filter((nft) => nft).map((nft) => nft.toString());
};

/**
 * Helper function to get cached NFTs from localStorage
 */
const getCachedNfts = (address: string): string[] => {
	try {
		const cached = localStorage.getItem(`nfts-${address}`);
		return cached ? JSON.parse(cached) : [];
	} catch {
		return [];
	}
};

/**
 * Helper function to update cached NFTs in localStorage
 */
const updateCachedNfts = (address: string, nfts: string[]): void => {
	try {
		localStorage.setItem(`nfts-${address}`, JSON.stringify(nfts));
	} catch (error) {
		console.warn("Failed to update cached NFTs:", error);
	}
};

/**
 * Helper function to validate and update selected NFT
 */
const validateAndUpdateSelectedNft = async (
	address: string,
	selectedNftId: string | null,
	storedNfts: string[],
	skyBrowser: SkyMainBrowser
): Promise<void> => {
	if (
		!selectedNftId ||
		!(await isValidOwner(selectedNftId, address, skyBrowser))
	) {
		const newSelectedNftId = storedNfts[0];
		if (newSelectedNftId) {
			localStorage.setItem(`selectedNftId-${address}`, newSelectedNftId);
		}
	}
};

/**
 * Mints a new NFT for the user
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<boolean> - True if minting was successful, false otherwise
 */
export const mintNft = async (skyBrowser: SkyMainBrowser): Promise<boolean> => {
	if (
		!skyBrowser?.contractService?.NFTMinter ||
		!skyBrowser?.contractService?.AgentNFT
	) {
		console.error("SkyBrowser or required contracts not initialized");
		return false;
	}

	try {
		// Get registered NFT information
		const registeredNFT =
			await skyBrowser.contractService.NFTMinter.getRegisteredNFTs(
				skyBrowser.contractService.AgentNFT
			);

		if (!isValidRegisteredNFT(registeredNFT)) {
			console.error("NFT registration validation failed");
			return false;
		}

		// Execute mint transaction
		const response = await skyBrowser.contractService.callContractWrite(
			skyBrowser.contractService.NFTMinter.mint(
				skyBrowser.contractService.selectedAccount,
				skyBrowser.contractService.AgentNFT,
				{
					value: registeredNFT.mintPrice,
				}
			)
		);

		if (response.success) {
			// Refresh user's NFT list after successful minting
			await fetchNfts(
				skyBrowser.contractService.selectedAccount,
				skyBrowser
			);
			return true;
		}

		console.error("Mint transaction failed:", response);
		return false;
	} catch (error) {
		console.error("Error minting NFT:", error);
		return false;
	}
};

/**
 * Validates if a registered NFT is valid for minting
 */
const isValidRegisteredNFT = (registeredNFT: any): boolean => {
	return (
		registeredNFT &&
		registeredNFT.isRegistered === true &&
		registeredNFT.mintPrice !== undefined &&
		registeredNFT.mintPrice !== null
	);
};

/**
 * Mints a Skynet NFT and returns the result with NFT ID
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @param address - User's wallet address
 * @param web3Auth - Web3 authentication object (unused but kept for compatibility)
 * @returns Promise<NFTResult> - Result object with success status and NFT ID
 */
export const mintSkynetNFT = async (
	skyBrowser: SkyMainBrowser,
	address: string,
	web3Auth: Web3Auth
): Promise<NFTResult> => {
	if (!skyBrowser || !address) {
		return {
			success: false,
			action: "error",
			message: "Invalid parameters provided",
		};
	}

	try {
		const success = await mintNft(skyBrowser);
		if (!success) {
			return {
				success: false,
				action: "error",
				message: "Failed to mint NFT",
			};
		}

		// Fetch updated NFTs after minting
		const nfts = await fetchNfts(address, skyBrowser);
		const newNftId = nfts[0]; // Get the newest NFT

		if (!newNftId) {
			return {
				success: false,
				action: "error",
				message: "NFT was minted but not found in wallet",
			};
		}

		return {
			success: true,
			nftId: newNftId,
			action: "minted",
		};
	} catch (error) {
		console.error("Error in mintSkynetNFT:", error);
		return {
			success: false,
			action: "error",
			message:
				error instanceof Error
					? error.message
					: "Unknown error occurred",
		};
	}
};

/**
 * Fetches user NFTs (alias for fetchNfts for backward compatibility)
 * @param address - User's wallet address
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<string[]> - Array of NFT IDs owned by the user
 */
export const fetchUserNfts = async (
	address: string,
	skyBrowser: SkyMainBrowser
): Promise<string[]> => {
	return fetchNfts(address, skyBrowser);
};

export const getNftId = async (
	fetchUserNfts: (
		address: string,
		skyBrowser: SkyMainBrowser
	) => Promise<string[]>,
	web3Context: Web3Context,
	nfts: string[],
	skyBrowser: SkyMainBrowser
) => {
	// Fetch user's NFTs first and get the updated list
	const freshNfts = await fetchUserNfts(web3Context.address, skyBrowser);

	// If user has no NFTs, try to mint one
	if (!freshNfts || freshNfts.length === 0) {
		const mintSuccess = await mintNft(skyBrowser);
		if (!mintSuccess) {
			return false;
		}
		// Fetch NFTs again after minting
		const updatedNfts = await fetchUserNfts(
			web3Context.address,
			skyBrowser
		);
		if (!updatedNfts || updatedNfts.length === 0) {
			return false;
		}
	}

	// Get the latest NFTs after potential minting
	const currentNfts = await fetchUserNfts(web3Context.address, skyBrowser);

	if (!currentNfts || currentNfts.length === 0) {
		return false;
	}

	// Find the first NFT that the user owns with retry logic
	let selectedNft = null;
	let retryCount = 0;
	const maxRetries = 3; // Reduced from 10 to 3 for better UX
	const retryDelay = 2000; // Reduced from 5 seconds to 2 seconds

	while (!selectedNft && retryCount < maxRetries) {
		// Check each NFT in the current list
		for (const nftId of currentNfts) {
			try {
				const nftOwner =
					await skyBrowser.contractService.AgentNFT.ownerOf(
						nftId.toString() // Ensure nftId is a string
					);
				if (
					nftOwner.toLowerCase() === web3Context.address.toLowerCase()
				) {
					selectedNft = nftId.toString(); // Ensure we return a string
					break;
				}
			} catch (error) {
				console.warn(`[EXECUTE] Error checking NFT ${nftId}:`, error);
				continue;
			}
		}

		if (!selectedNft) {
			retryCount++;
			if (retryCount < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, retryDelay));
				// Refresh the NFT list before retrying
				const refreshedNfts = await fetchUserNfts(
					web3Context.address,
					skyBrowser
				);
				if (refreshedNfts && refreshedNfts.length > 0) {
					// Update the current NFTs list
					currentNfts.length = 0;
					currentNfts.push(...refreshedNfts);
				}
			}
		}
	}

	if (!selectedNft) {
		return false;
	}

	// Save the selected NFT to localStorage
	localStorage.setItem(`selectedNftId-${web3Context.address}`, selectedNft);

	return selectedNft;
};

/**
 * Validates if a user owns a specific NFT token
 * @param tokenId - The NFT token ID to check
 * @param address - User's wallet address
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<boolean> - True if user owns the token, false otherwise
 */
const isValidOwner = async (
	tokenId: string,
	address: string,
	skyBrowser: SkyMainBrowser
): Promise<boolean> => {
	if (!tokenId || !address || !skyBrowser?.contractService?.AgentNFT) {
		return false;
	}

	try {
		const owner = await skyBrowser.contractService.AgentNFT.ownerOf(
			tokenId
		);
		return owner?.toLowerCase() === address.toLowerCase();
	} catch (error) {
		console.warn(`Error validating ownership for token ${tokenId}:`, error);
		return false;
	}
};

/**
 * Enhanced authentication with retry logic
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise<AuthResponse> - Authentication response object
 * @throws Error if authentication fails after all retries
 */
export const getAuthWithRetry = async (
	skyBrowser: SkyMainBrowser,
	maxRetries: number = MAX_RETRIES
): Promise<AuthResponse> => {
	if (!skyBrowser?.appManager) {
		throw new Error("SkyBrowser appManager not initialized");
	}

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const signatureResp = await skyBrowser.appManager.getUrsulaAuth();

			if (isValidAuthResponse(signatureResp)) {
				return signatureResp;
			}

			console.warn(`Auth attempt ${attempt + 1} failed:`, signatureResp);

			// Wait before retry with exponential backoff
			if (attempt < maxRetries - 1) {
				await delay(DEFAULT_RETRY_DELAY * (attempt + 1));
			}
		} catch (error) {
			console.error(`Auth attempt ${attempt + 1} error:`, error);
			if (attempt === maxRetries - 1) {
				throw error;
			}
		}
	}

	throw new Error("Failed to get authentication after retries");
};

/**
 * Validates if an authentication response is valid
 */
const isValidAuthResponse = (response: any): response is AuthResponse => {
	return (
		response?.success === true &&
		response.data?.userAddress &&
		response.data?.signature &&
		response.data?.message
	);
};

/**
 * Utility function to create a delay
 */
const delay = (ms: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Enhanced API request wrapper with retry logic using axios
 * @param url - API endpoint URL
 * @param payload - Request payload data
 * @param retries - Number of retry attempts (default: 2)
 * @returns Promise<any> - API response data
 * @throws Error if all retry attempts fail
 */
export const makeApiRequest = async (
	url: string,
	payload: unknown,
	retries: number = 2
): Promise<any> => {
	if (!url) {
		throw new Error("URL is required for API request");
	}

	console.log("makeApiRequest called:", { url, payload, retries });

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			console.log(`Making API request attempt ${attempt + 1} to:`, url);

			const response = await axios.post(url, payload, {
				headers: {
					"Content-Type": CONTENT_TYPES.JSON,
				},
				timeout: DEFAULT_TIMEOUT,
			});

			console.log("API request successful:", {
				status: response.status,
				headers: response.headers,
				dataType: typeof response.data,
				data: response.data,
			});

			// Validate response is not HTML error page
			if (isHtmlResponse(response.data)) {
				throw new Error(
					"API returned HTML instead of JSON - possible server error"
				);
			}

			return response.data;
		} catch (error) {
			const axiosError = error as AxiosError;
			console.error(`Request attempt ${attempt + 1} failed:`, axiosError);

			const shouldRetry = await handleApiError(
				axiosError,
				attempt,
				retries
			);
			if (!shouldRetry) {
				throw createApiError(axiosError);
			}

			// Wait before retry with exponential backoff
			if (attempt < retries) {
				await delay(DEFAULT_RETRY_DELAY * (attempt + 1));
			}
		}
	}
};

/**
 * Checks if response data is HTML
 */
const isHtmlResponse = (data: any): boolean => {
	return typeof data === "string" && data.includes("<!DOCTYPE html>");
};

/**
 * Handles API errors and determines if retry should be attempted
 */
const handleApiError = async (
	axiosError: AxiosError,
	attempt: number,
	maxRetries: number
): Promise<boolean> => {
	if (axiosError.response) {
		const status = axiosError.response.status;
		const errorData = axiosError.response.data;

		console.error(`Error response ${attempt + 1}:`, {
			status,
			data: errorData,
			headers: axiosError.response.headers,
		});

		// Don't retry on 4xx client errors
		if (status >= 400 && status < 500) {
			return false;
		}

		// Retry on 5xx server errors
		return attempt < maxRetries && status >= 500;
	} else if (axiosError.request) {
		// Network error - retry if we have attempts left
		console.error(
			`Network error attempt ${attempt + 1}:`,
			axiosError.message
		);
		return attempt < maxRetries;
	} else {
		// Other error
		console.error(
			`Request setup error attempt ${attempt + 1}:`,
			axiosError.message
		);
		return false;
	}
};

/**
 * Creates a standardized error message from Axios error
 */
const createApiError = (axiosError: AxiosError): Error => {
	if (axiosError.response) {
		const status = axiosError.response.status;
		const errorData = axiosError.response.data;
		const errorMessage =
			typeof errorData === "string"
				? errorData
				: (errorData as { message?: string })?.message ||
				  JSON.stringify(errorData);

		return new Error(`HTTP ${status}: ${errorMessage}`);
	} else if (axiosError.request) {
		return new Error(`Network Error: ${axiosError.message}`);
	} else {
		return new Error(`Request Error: ${axiosError.message}`);
	}
};

/**
 * Validates API payload structure and required fields
 * @param payload - API payload to validate
 * @throws Error if payload is invalid or missing required fields
 */
export const validateAPIPayload = (payload: APIPayload): void => {
	if (!payload) {
		throw new Error("Payload is required");
	}

	const requiredFields: (keyof APIPayload)[] = [
		"prompt",
		"userAuthPayload",
		"nftId",
	];
	const missingFields = requiredFields.filter((field) => !payload[field]);

	if (missingFields.length > 0) {
		throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
	}

	// Validate userAuthPayload structure
	if (!payload.userAuthPayload) {
		throw new Error("userAuthPayload is required");
	}

	const authFields = ["userAddress", "signature", "message"];
	const missingAuthFields = authFields.filter(
		(field) =>
			!payload.userAuthPayload[
				field as keyof typeof payload.userAuthPayload
			]
	);

	if (missingAuthFields.length > 0) {
		throw new Error(
			`Missing required auth fields: ${missingAuthFields.join(", ")}`
		);
	}

	// Validate prompt is not empty
	if (!payload.prompt.trim()) {
		throw new Error("Prompt cannot be empty");
	}

	// Validate NFT ID format
	if (!payload.nftId.trim()) {
		throw new Error("NFT ID cannot be empty");
	}
};

/**
 * Generates an agent with comprehensive validation
 * @param prompt - User prompt for agent generation
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @param web3Context - Web3 context containing user address
 * @returns Promise<any> - Agent generation response
 * @throws Error if validation fails or generation is unsuccessful
 */
export const generateAgentWithValidation = async (
	prompt: string,
	skyBrowser: SkyMainBrowser | null,
	web3Context: Web3Context
): Promise<any> => {
	// Validate inputs
	if (!prompt?.trim()) {
		throw new Error("Prompt is required");
	}
	if (!skyBrowser) {
		throw new Error("SkyBrowser not initialized");
	}
	if (!web3Context?.address) {
		throw new Error("Web3 context address is required");
	}

	const apiUrl = API_CONFIG.SKYINTEL_API;
	if (!apiUrl) {
		throw new Error("SkyIntel API URL not configured");
	}

	try {
		// Get authentication with validation
		const auth = await getAuthWithRetry(skyBrowser);

		// Get valid NFT ID using the enhanced function
		const nftResult = await ensureUserHasNFT(skyBrowser, web3Context);

		if (!nftResult.success) {
			throw new Error(
				nftResult.message || "Failed to get NFT for agent generation"
			);
		}

		const nftId = nftResult.nftId;
		if (!nftId) {
			throw new Error("NFT ID is required for agent generation");
		}

		// Prepare and validate payload
		const payload: APIPayload = {
			prompt: prompt.trim(),
			userAuthPayload: auth.data,
			nftId,
		};

		validateAPIPayload(payload);

		// Make request with proper error handling
		return await makeApiRequest(apiUrl, payload);
	} catch (error) {
		console.error("Error in generateAgentWithValidation:", error);
		throw error;
	}
};

/**
 * Skynet initialization functions
 */

/**
 * Validates if the provider is connected to the Skynet network
 * @param provider - Ethers browser provider
 * @returns Promise<boolean> - True if connected to Skynet network
 */
export const validateNetwork = async (
	provider: ethers.BrowserProvider
): Promise<boolean> => {
	try {
		const network = await provider.getNetwork();
		return network.chainId === BigInt(SKYNET_CHAIN_ID);
	} catch (error) {
		console.error("Error validating network:", error);
		return false;
	}
};

/**
 * Creates a SkyEtherContractService instance
 * @param provider - Web3 provider
 * @param signer - Ethers signer
 * @param address - User's wallet address
 * @returns SkyEtherContractService instance
 */
export const createContractService = (
	provider: unknown,
	signer: ethers.Signer,
	address: string
): SkyEtherContractService => {
	if (!provider || !signer || !address) {
		throw new Error("Provider, signer, and address are required");
	}

	return new SkyEtherContractService(
		provider as never,
		signer,
		address,
		SKYNET_CHAIN_ID
	);
};

/**
 * Creates a SkyMainBrowser instance
 * @param contractService - Initialized contract service
 * @returns SkyMainBrowser instance
 */
export const createSkyBrowser = (
	contractService: SkyEtherContractService
): SkyMainBrowser => {
	const storageApiUrl = API_CONFIG.STORAGE_API;
	if (!storageApiUrl) {
		throw new Error("Storage API URL not configured");
	}

	const envConfig: SkyEnvConfigBrowser = {
		STORAGE_API: storageApiUrl,
		CACHE: {
			TYPE: "CACHE",
		},
	};

	return new SkyMainBrowser(
		contractService,
		contractService.selectedAccount,
		new SkyBrowserSigner(
			contractService.selectedAccount,
			contractService.signer
		),
		envConfig
	);
};

/**
 * Initializes Skynet with comprehensive validation
 * @param provider - Web3 provider
 * @param signer - Ethers signer
 * @returns Promise<SkyMainBrowser> - Initialized SkyMainBrowser instance
 * @throws Error if initialization fails
 */
export const initializeSkynet = async (
	provider: unknown,
	signer: ethers.Signer
): Promise<SkyMainBrowser> => {
	if (!provider || !signer) {
		throw new Error(
			"Provider and signer are required for Skynet initialization"
		);
	}

	try {
		const ethersProvider = new ethers.BrowserProvider(
			provider as unknown as Eip1193Provider
		);
		const address = await signer.getAddress();

		// Validate network
		const isValidNetwork = await validateNetwork(ethersProvider);
		if (!isValidNetwork) {
			throw new Error(
				`Please switch to Skynet network (Chain ID: ${SKYNET_CHAIN_ID})`
			);
		}

		// Create contract service
		const contractService = createContractService(
			provider,
			signer,
			address
		);

		// Create and initialize SkyBrowser
		const skyBrowser = createSkyBrowser(contractService);
		await skyBrowser.init(true);

		return skyBrowser;
	} catch (error) {
		console.error("Error initializing Skynet:", error);
		throw error;
	}
};

/**
 * Checks user's balance for NFT minting
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<BalanceCheckResult> - Balance check result with mint price and user balance
 */
export const checkUserBalance = async (
	skyBrowser: SkyMainBrowser | null
): Promise<BalanceCheckResult> => {
	try {
		if (!skyBrowser) {
			return {
				hasBalance: false,
				mintPrice: "0",
				error: "SkyBrowser not initialized",
			};
		}

		const registeredNFT =
			await skyBrowser.contractService.NFTMinter.getRegisteredNFTs(
				skyBrowser.contractService.AgentNFT
			);

		// Based on the provided code, registeredNFT should have properties like isRegistered and mintPrice
		const isRegistered = registeredNFT.isRegistered;
		const mintPrice = registeredNFT.mintPrice;

		if (!registeredNFT || !isRegistered || mintPrice === undefined) {
			console.error("No registered NFT found or mint price is undefined");
			return { hasBalance: false, mintPrice: "0" };
		}

		// Use the signer's provider to get balance instead of contract service provider
		const signerProvider = skyBrowser.contractService.signer.provider;
		if (!signerProvider) {
			console.error("Signer provider is null");
			return {
				hasBalance: false,
				mintPrice: "0",
				error: "Signer provider not available",
			};
		}

		const balance = await signerProvider.getBalance(
			skyBrowser.contractService.selectedAccount
		);

		// If mint price is 0, NFT is free - user always has sufficient balance
		const hasBalance = mintPrice === BigInt(0) || balance >= mintPrice;

		return {
			hasBalance,
			mintPrice: ethers.formatEther(mintPrice),
			userBalance: ethers.formatEther(balance),
		};
	} catch (error) {
		console.error("Error checking user balance:", error);
		return {
			hasBalance: false,
			mintPrice: "0",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
};

/**
 * Enhanced NFT checking and minting function
 * This function ensures the user has at least one NFT for all operations (running workflows, generating agents, etc.)
 * Only one NFT is needed - it can be reused for all operations
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @param web3Context - Web3 context containing user address
 * @returns Promise<NFTResult> - Result object with success status and NFT ID
 */
export const ensureUserHasNFT = async (
	skyBrowser: SkyMainBrowser | null,
	web3Context: Web3Context
): Promise<NFTResult> => {
	try {
		if (!skyBrowser) {
			return {
				success: false,
				action: "error",
				message:
					"SkyBrowser not initialized. Please connect your wallet.",
			};
		}

		// First, check if AgentNFT is properly registered
		const registrationCheck = await checkNFTRegistration(skyBrowser);

		if (!registrationCheck.isRegistered) {
			return {
				success: false,
				action: "registration_error",
				message:
					"AgentNFT is not properly registered with NFTMinter. Please contact support.",
				error: registrationCheck.error,
			};
		}

		// First, check if user has any NFTs (we only need one)
		const userNfts = await fetchNfts(web3Context.address, skyBrowser);

		if (userNfts && userNfts.length > 0) {
			// User has NFTs, return the first one (any NFT can be used for all operations)
			return {
				success: true,
				nftId: userNfts[0],
				action: "existing",
			};
		}

		// User has no NFTs, check balance for minting one NFT
		const balanceCheck = await checkUserBalance(skyBrowser);

		if (!balanceCheck.hasBalance) {
			const message =
				balanceCheck.mintPrice === "0"
					? "Unable to mint free NFT. Please try again."
					: `Insufficient balance. You need ${balanceCheck.mintPrice} sUSD to mint NFT. Your current balance: ${balanceCheck.userBalance} sUSD`;

			return {
				success: false,
				action: "insufficient_funds",
				message,
				mintPrice: balanceCheck.mintPrice,
				userBalance: balanceCheck.userBalance,
			};
		}

		// User has balance, attempt to mint one NFT
		const mintSuccess = await mintNft(skyBrowser);

		if (!mintSuccess) {
			return {
				success: false,
				action: "mint_failed",
				message: "Failed to mint NFT. Please try again.",
			};
		}

		// Fetch NFTs again after minting
		const updatedNfts = await fetchNfts(web3Context.address, skyBrowser);

		if (!updatedNfts || updatedNfts.length === 0) {
			return {
				success: false,
				action: "mint_verification_failed",
				message:
					"NFT was minted but not found in wallet. Please refresh and try again.",
			};
		}

		// Return the newly minted NFT (this single NFT can be used for all future operations)
		return {
			success: true,
			nftId: updatedNfts[0],
			action: "minted",
		};
	} catch (error) {
		console.error("Error in ensureUserHasNFT:", error);
		return {
			success: false,
			action: "error",
			message:
				error instanceof Error
					? error.message
					: "Unknown error occurred",
		};
	}
};

/**
 * Check if AgentNFT is registered with NFTMinter
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<RegistrationCheck> - Registration check result
 */
export const checkNFTRegistration = async (
	skyBrowser: SkyMainBrowser | null
): Promise<RegistrationCheck> => {
	try {
		if (!skyBrowser) {
			return { isRegistered: false, error: "SkyBrowser not initialized" };
		}

		const registeredNFT =
			await skyBrowser.contractService.NFTMinter.getRegisteredNFTs(
				skyBrowser.contractService.AgentNFT
			);

		// Based on the provided code, registeredNFT should have properties like isRegistered and mintPrice
		const isRegistered = registeredNFT.isRegistered;
		const mintPrice = registeredNFT.mintPrice;

		return {
			isRegistered: !!registeredNFT && isRegistered,
			registeredData: registeredNFT,
			mintPrice:
				mintPrice && mintPrice > BigInt(0)
					? ethers.formatEther(mintPrice)
					: "0",
			isActive: isRegistered,
		};
	} catch (error) {
		console.error("Error checking NFT registration:", error);
		return {
			isRegistered: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
};

/**
 * Agent-specific NFT minting function
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @param agent - Agent data containing NFT address
 * @returns Promise<boolean> - True if minting was successful, false otherwise
 */
export const mintAgentNft = async (
	skyBrowser: SkyMainBrowser,
	agent: AgentData
): Promise<boolean> => {
	try {
		const contractService = skyBrowser.contractService;

		const registeredNFT =
			await skyBrowser.contractService.NFTMinter.getRegisteredNFTs(
				agent.nft_address as string
			);

		if (!registeredNFT.isRegistered) {
			console.error("Agent NFT is not registered");
			return false;
		}

		const tx = await contractService.callContractWrite(
			skyBrowser.contractService.NFTMinter.mint(
				skyBrowser.contractService.selectedAccount,
				agent.nft_address as string, // agent collection address
				{
					value: registeredNFT.mintPrice,
				}
			)
		);

		if (tx.success) {
			return true;
		}
		return false;
	} catch (error) {
		console.error("Error minting agent NFT:", error);
		return false;
	}
};

/**
 * Get agent-specific NFTs owned by the user
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @param agent - Agent data containing NFT address
 * @returns Promise<string[]> - Array of NFT IDs owned by the user for this agent
 */
export const getAgentNft = async (
	skyBrowser: SkyMainBrowser,
	agent: AgentData
): Promise<string[]> => {
	try {
		const contractService = skyBrowser.contractService;
		const signer = contractService.signer;

		const NFTContract = NFT__factory.connect(
			agent.nft_address as string,
			signer
		);
		const nftIds: string[] = [];

		const balance = await NFTContract.balanceOf(
			skyBrowser.contractService.selectedAccount
		);

		for (let i = 0; i < balance; i++) {
			const nftId = await NFTContract.tokenOfOwnerByIndex(
				skyBrowser.contractService.selectedAccount,
				i
			);
			nftIds.push(nftId.toString());
		}

		return nftIds;
	} catch (error) {
		console.error("Error getting agent NFTs:", error);
		return [];
	}
};

/**
 * Fetch knowledge base records using Natural Request API
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @param userAddress - User's wallet address
 * @param agentData - Agent data containing NFT address
 * @param selectedNftId - Optional selected NFT ID
 * @param agentId - Optional agent ID
 * @param knowledgeType - Type of knowledge base (swarm or agent)
 * @returns Promise<any> - Knowledge base records response
 * @throws Error if operation fails
 */
export const fetchKnowledgeBaseRecords = async (
	skyBrowser: SkyMainBrowser,
	userAddress: string,
	agentData: AgentData,
	selectedNftId?: string,
	agentId?: string,
	knowledgeType?: "swarm" | "agent"
): Promise<any> => {
	try {
		const auth = await getAuthWithRetry(skyBrowser);

		let nftId: string;
		let finalAgentId: string;
		const agentAddress = agentData?.nft_address || agentData?.collection_id;

		// First, ensure the user owns an NFT from the specific agent collection
		let agentNftId: string | null = null;

		if (selectedNftId) {
			// Verify that the selected NFT ID belongs to the user and the agent collection
			try {
				const NFTContract = NFT__factory.connect(
					agentAddress as string,
					skyBrowser.contractService.signer
				);
				const owner = await NFTContract.ownerOf(selectedNftId);
				if (owner.toLowerCase() === userAddress.toLowerCase()) {
					agentNftId = selectedNftId;
				} else {
					console.warn(
						"Selected NFT ID does not belong to user, will find another"
					);
				}
			} catch (error) {
				console.warn("Error verifying selected NFT ID:", error);
			}
		}

		// If no valid selectedNftId, try to find an NFT the user owns from this agent collection
		if (!agentNftId) {
			try {
				const agentNftIds = await getAllAgentTokenIds(
					agentAddress as string,
					userAddress,
					skyBrowser
				);
				if (agentNftIds && agentNftIds.length > 0) {
					agentNftId = agentNftIds[0]; // Use the first (lowest) token ID
				} else {
					console.warn(
						"User does not own any NFTs from this agent collection"
					);
				}
			} catch (error) {
				console.warn("Error getting agent NFT IDs:", error);
			}
		}

		// If still no agent NFT found, the user needs to mint one
		if (!agentNftId) {
			console.log("No agent NFT found, attempting to mint one...");

			// Double-check ownership before attempting to mint
			try {
				const verificationResult = await verifyAgentNFTOwnership(
					agentAddress as string,
					userAddress,
					skyBrowser
				);

				if (
					verificationResult.success &&
					verificationResult.tokenIds.length > 0
				) {
					console.log(
						"NFT ownership verified during double-check, using existing NFT"
					);
					agentNftId = verificationResult.tokenIds[0];
				} else {
					// Proceed with minting only if we're sure user doesn't own any
					const mintResult = await ensureAgentNFT(
						skyBrowser,
						{ address: userAddress },
						agentData
					);

					if (mintResult.success) {
						// Try to get the newly minted NFT ID
						const newAgentNftIds = await getAllAgentTokenIds(
							agentAddress as string,
							userAddress,
							skyBrowser
						);
						if (newAgentNftIds && newAgentNftIds.length > 0) {
							agentNftId = newAgentNftIds[0];
						}
					} else {
						// Enhanced error handling for minting failures
						let errorMessage =
							"Failed to ensure agent NFT ownership";

						if (mintResult.action === "insufficient_funds") {
							errorMessage = `Insufficient balance to mint agent NFT. You need ${mintResult.mintPrice} sUSD. Your current balance: ${mintResult.userBalance} sUSD`;
						} else if (mintResult.action === "not_registered") {
							errorMessage =
								"This agent's NFT is not registered for minting. Please contact the agent creator.";
						} else if (
							mintResult.action === "mint_verification_failed"
						) {
							errorMessage =
								"Agent NFT was minted but not found in wallet. Please refresh and try again.";
						} else if (mintResult.message) {
							errorMessage = mintResult.message;
						}

						throw new Error(errorMessage);
					}
				}
			} catch (verificationError) {
				console.warn(
					"Double-check verification failed, proceeding with original logic:",
					verificationError
				);

				// Fallback to original minting logic
				const mintResult = await ensureAgentNFT(
					skyBrowser,
					{ address: userAddress },
					agentData
				);

				if (mintResult.success) {
					// Try to get the newly minted NFT ID
					const newAgentNftIds = await getAllAgentTokenIds(
						agentAddress as string,
						userAddress,
						skyBrowser
					);
					if (newAgentNftIds && newAgentNftIds.length > 0) {
						agentNftId = newAgentNftIds[0];
					}
				} else {
					// Enhanced error handling for minting failures
					let errorMessage = "Failed to ensure agent NFT ownership";

					if (mintResult.action === "insufficient_funds") {
						errorMessage = `Insufficient balance to mint agent NFT. You need ${mintResult.mintPrice} sUSD. Your current balance: ${mintResult.userBalance} sUSD`;
					} else if (mintResult.action === "not_registered") {
						errorMessage =
							"This agent's NFT is not registered for minting. Please contact the agent creator.";
					} else if (
						mintResult.action === "mint_verification_failed"
					) {
						errorMessage =
							"Agent NFT was minted but not found in wallet. Please refresh and try again.";
					} else if (mintResult.message) {
						errorMessage = mintResult.message;
					}

					throw new Error(errorMessage);
				}
			}
		}

		// If we still don't have an agent NFT ID, we can't proceed
		if (!agentNftId) {
			throw new Error(
				"Unable to obtain agent NFT ID. User must own an NFT from this agent collection to access knowledge base."
			);
		}

		// Use provided agentId or fetch it if not provided
		if (agentId) {
			finalAgentId = agentId;
		} else {
			try {
				const fetchedAgentId = await getAgentIdByAgentAddress(
					agentAddress as string,
					userAddress,
					skyBrowser
				);
				finalAgentId = fetchedAgentId || agentNftId; // Use the NFT ID as fallback
			} catch (error) {
				console.warn(
					"Failed to fetch agentId, using NFT ID as fallback:",
					error
				);
				finalAgentId = agentNftId;
			}
		}

		// Get a valid account NFT that the user owns for authentication
		let accountNftId: string;
		try {
			// Try to get the first NFT the user owns from the main collection
			const userNftBalance =
				await skyBrowser.contractService.AgentNFT.balanceOf(
					userAddress
				);
			if (userNftBalance && userNftBalance > 0) {
				const firstNftId =
					await skyBrowser.contractService.AgentNFT.tokenOfOwnerByIndex(
						userAddress,
						0
					);
				accountNftId = firstNftId.toString();
			} else {
				// Fallback to using the agent's NFT ID
				accountNftId = agentNftId;
			}
		} catch (error) {
			console.warn(
				"Failed to get user's AgentNFT, using agent NFT for authentication:",
				error
			);
			accountNftId = agentNftId;
		}

		const payload = {
			prompt:
				knowledgeType === KNOWLEDGE_TYPES.AGENT
					? KNOWLEDGE_PROMPTS.AGENT_LIST_RECORDS
					: `${KNOWLEDGE_PROMPTS.SWARM_PREFIX}${KNOWLEDGE_PROMPTS.SWARM_LIST_RECORDS}`,
			userAuthPayload: {
				userAddress: auth.data.userAddress,
				signature: auth.data.signature,
				message: auth.data.message,
			},
			accountNFT: {
				collectionID: "0",
				nftID: accountNftId,
			},
			agentCollection: {
				agentAddress: agentAddress as string,
			},
		};
		// Make API request to Natural Request endpoint
		const response = await makeApiRequest(
			`https://knowledgebase-c0n499.stackos.io/natural-request`,
			payload
		);

		return response;
	} catch (error) {
		console.error("Error fetching knowledge base records:", error);

		// Enhanced error handling - re-throw with more context
		if (error instanceof Error) {
			// If it's already a detailed error from our code, just re-throw
			if (
				error.message.includes("Insufficient balance") ||
				error.message.includes("not registered") ||
				error.message.includes("Unable to obtain agent NFT")
			) {
				throw error;
			}

			// If it's an API error, add more context
			if (
				error.message.includes(
					"Agent collection ownership validation failed"
				)
			) {
				throw new Error(
					`Agent collection ownership validation failed for wallet: ${userAddress}. You need to own an NFT from this agent collection to access its knowledge base.`
				);
			}
		}

		throw error;
	}
};

/**
 * Save knowledge base record using Natural Request API
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @param userAddress - User's wallet address
 * @param agentData - Agent data containing NFT address
 * @param selectedNftId - Selected NFT ID
 * @param content - Content to save to knowledge base
 * @param agentId - Optional agent ID
 * @param knowledgeType - Type of knowledge base (swarm or agent)
 * @returns Promise<any> - Save operation response
 * @throws Error if operation fails
 */
export const saveKnowledgeBaseRecord = async (
	skyBrowser: SkyMainBrowser,
	userAddress: string,
	agentData: AgentData,
	selectedNftId: string,
	content: string,
	agentId?: string,
	knowledgeType?: "swarm" | "agent"
): Promise<any> => {
	try {
		const auth = await getAuthWithRetry(skyBrowser);

		let nftId: string;
		const agentAddress = agentData?.nft_address || agentData?.collection_id;

		// First, ensure the user owns an NFT from the specific agent collection
		let agentNftId: string | null = null;

		if (selectedNftId) {
			// Verify that the selected NFT ID belongs to the user and the agent collection
			try {
				const NFTContract = NFT__factory.connect(
					agentAddress as string,
					skyBrowser.contractService.signer
				);
				const owner = await NFTContract.ownerOf(selectedNftId);
				if (owner.toLowerCase() === userAddress.toLowerCase()) {
					agentNftId = selectedNftId;
				} else {
					console.warn(
						"Selected NFT ID does not belong to user, will find another"
					);
				}
			} catch (error) {
				console.warn("Error verifying selected NFT ID:", error);
			}
		}

		// If no valid selectedNftId, try to find an NFT the user owns from this agent collection
		if (!agentNftId) {
			try {
				const agentNftIds = await getAllAgentTokenIds(
					agentAddress as string,
					userAddress,
					skyBrowser
				);
				if (agentNftIds && agentNftIds.length > 0) {
					agentNftId = agentNftIds[0]; // Use the first (lowest) token ID
				} else {
					console.warn(
						"User does not own any NFTs from this agent collection"
					);
				}
			} catch (error) {
				console.warn("Error getting agent NFT IDs:", error);
			}
		}

		// If still no agent NFT found, the user needs to mint one
		if (!agentNftId) {
			console.log("No agent NFT found, attempting to mint one...");
			const mintResult = await ensureAgentNFT(
				skyBrowser,
				{ address: userAddress },
				agentData
			);

			if (mintResult.success) {
				// Try to get the newly minted NFT ID
				const newAgentNftIds = await getAllAgentTokenIds(
					agentAddress as string,
					userAddress,
					skyBrowser
				);
				if (newAgentNftIds && newAgentNftIds.length > 0) {
					agentNftId = newAgentNftIds[0];
					console.log(
						"Successfully minted and found agent NFT ID:",
						agentNftId
					);
				}
			} else {
				throw new Error(
					`Failed to ensure agent NFT ownership: ${mintResult.message}`
				);
			}
		}

		// If we still don't have an agent NFT ID, we can't proceed
		if (!agentNftId) {
			throw new Error(
				"Unable to obtain agent NFT ID. User must own an NFT from this agent collection to save knowledge base records."
			);
		}

		// Use provided agentId or fetch it if not provided
		let finalAgentId: string;
		if (agentId) {
			finalAgentId = agentId;
		} else {
			try {
				const fetchedAgentId = await getAgentIdByAgentAddress(
					agentAddress as string,
					userAddress,
					skyBrowser
				);
				finalAgentId = fetchedAgentId || agentNftId; // Use the NFT ID as fallback
			} catch (error) {
				console.warn(
					"Failed to fetch agentId, using NFT ID as fallback:",
					error
				);
				finalAgentId = agentNftId;
			}
		}

		// Get a valid account NFT that the user owns for authentication
		let accountNftId: string;
		try {
			// Try to get the first NFT the user owns from the main collection
			const userNftBalance =
				await skyBrowser.contractService.AgentNFT.balanceOf(
					userAddress
				);
			if (userNftBalance && userNftBalance > 0) {
				const firstNftId =
					await skyBrowser.contractService.AgentNFT.tokenOfOwnerByIndex(
						userAddress,
						0
					);
				accountNftId = firstNftId.toString();
			} else {
				// Fallback to using the agent's NFT ID
				accountNftId = agentNftId;
			}
		} catch (error) {
			console.warn(
				"Failed to get user's AgentNFT, using agent NFT for authentication:",
				error
			);
			accountNftId = agentNftId;
		}

		const payload = {
			prompt:
				knowledgeType === "swarm"
					? `${KNOWLEDGE_PROMPTS.SWARM_PREFIX}Save this data to the collection knowledge base: ${content}`
					: `Save this data to the knowledge base: ${content}`,
			userAuthPayload: {
				userAddress: auth.data.userAddress,
				signature: auth.data.signature,
				message: auth.data.message,
			},
			accountNFT: {
				collectionID: "0",
				nftID: accountNftId,
			},
			agentCollection: {
				agentAddress: agentAddress as string,
			},
		};

		// Make API request to Natural Request endpoint
		const response = await makeApiRequest(
			`https://knowledgebase-c0n499.stackos.io/natural-request`,
			payload
		);

		return response;
	} catch (error) {
		console.error("Error saving knowledge base record:", error);

		// Enhanced error handling - re-throw with more context
		if (error instanceof Error) {
			// If it's already a detailed error from our code, just re-throw
			if (
				error.message.includes("Insufficient balance") ||
				error.message.includes("not registered") ||
				error.message.includes("Unable to obtain agent NFT")
			) {
				throw error;
			}

			// If it's an API error, add more context
			if (
				error.message.includes(
					"Agent collection ownership validation failed"
				)
			) {
				throw new Error(
					`Agent collection ownership validation failed for wallet: ${userAddress}. You need to own an NFT from this agent collection to save knowledge base records.`
				);
			}
		}

		throw error;
	}
};

/**
 * Get NFT ID by agent address (most recent token)
 * @param agentAddress - Agent's NFT contract address
 * @param userAddress - User's wallet address
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<string | null> - Most recent NFT ID or null if none found
 */
export const getNftIdByAgentAddress = async (
	agentAddress: string,
	userAddress: string,
	skyBrowser: SkyMainBrowser
): Promise<string | null> => {
	try {
		// Use getAllAgentTokenIds to get the most recent (highest) token ID
		const tokenIds = await getAllAgentTokenIds(
			agentAddress,
			userAddress,
			skyBrowser
		);

		if (tokenIds && tokenIds.length > 0) {
			return tokenIds[0]; // This is now the most recent (highest) token ID
		}

		console.log("User does not own any NFTs from this agent collection");
		return null;
	} catch (error) {
		console.error("Error getting NFT ID by agent address:", error);
		return null;
	}
};

/**
 * Get all agent token IDs owned by a user with retry logic
 * @param agentAddress - Agent's NFT contract address
 * @param userAddress - User's wallet address
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<string[]> - Array of token IDs sorted by newest first
 */
export const getAllAgentTokenIds = async (
	agentAddress: string,
	userAddress: string,
	skyBrowser: SkyMainBrowser
): Promise<string[]> => {
	try {
		const signer = skyBrowser.contractService.signer;

		const NFTContract = NFT__factory.connect(
			agentAddress as string,
			signer
		);
		console.log("NFT Contract connected to:", agentAddress);

		// Add retry logic for balance check
		let balance;
		let retryCount = 0;
		const maxRetries = 3;

		while (retryCount < maxRetries) {
			try {
				balance = await NFTContract.balanceOf(userAddress);
				console.log(
					`User's NFT balance in agent collection (attempt ${
						retryCount + 1
					}):`,
					balance.toString()
				);
				break;
			} catch (error) {
				console.warn(
					`Balance check attempt ${retryCount + 1} failed:`,
					error
				);
				retryCount++;
				if (retryCount < maxRetries) {
					await new Promise((resolve) =>
						setTimeout(resolve, 1000 * retryCount)
					);
				}
			}
		}

		if (balance && balance > 0) {
			const tokenIds: string[] = [];

			// Add retry logic for token ID fetching
			for (let i = 0; i < balance; i++) {
				let tokenId;
				retryCount = 0;

				while (retryCount < maxRetries) {
					try {
						tokenId = await NFTContract.tokenOfOwnerByIndex(
							userAddress,
							i
						);

						tokenIds.push(tokenId.toString());
						break;
					} catch (err) {
						console.warn(
							`Could not fetch token at index ${i} (attempt ${
								retryCount + 1
							}):`,
							err
						);
						retryCount++;
						if (retryCount < maxRetries) {
							await new Promise((resolve) =>
								setTimeout(resolve, 1000 * retryCount)
							);
						} else {
							console.error(
								`Failed to fetch token at index ${i} after ${maxRetries} attempts`
							);
						}
					}
				}
			}

			// Sort token IDs numerically
			tokenIds.sort((a, b) =>
				BigInt(a) > BigInt(b) ? -1 : BigInt(a) < BigInt(b) ? 1 : 0
			);

			return tokenIds;
		}

		console.log("No NFTs found for user in this agent collection");
		return [];
	} catch (error) {
		console.error("Error getting all agent token IDs:", error);
		return [];
	}
};

/**
 * Get agent ID by agent address, trying metadata first, then falling back to token ID
 * @param agentAddress - Agent's NFT contract address
 * @param userAddress - User's wallet address
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<string | null> - Agent ID or null if none found
 */
export const getAgentIdByAgentAddress = async (
	agentAddress: string,
	userAddress: string,
	skyBrowser: SkyMainBrowser
): Promise<string | null> => {
	try {
		const signer = skyBrowser.contractService.signer;

		const NFTContract = NFT__factory.connect(
			agentAddress as string,
			signer
		);

		const balance = await NFTContract.balanceOf(userAddress);

		if (balance && balance > 0) {
			const tokenIds: string[] = [];
			for (let i = 0; i < balance; i++) {
				try {
					const tokenId = await NFTContract.tokenOfOwnerByIndex(
						userAddress,
						i
					);
					tokenIds.push(tokenId.toString());
				} catch (err) {
					console.warn(`Could not fetch token at index ${i}:`, err);
				}
			}
			// Optionally, try to extract agentId from metadata for each token, but fallback to lowest tokenId
			let agentIdFromMetadata: string | null = null;
			for (const tokenId of tokenIds) {
				try {
					const tokenURI = await NFTContract.tokenURI(tokenId);
					if (tokenURI) {
						if (
							tokenURI.startsWith("data:application/json;base64,")
						) {
							const jsonData = JSON.parse(
								atob(tokenURI.split(",")[1])
							);
							if (jsonData.agentId || jsonData.agent_id) {
								agentIdFromMetadata = (
									jsonData.agentId || jsonData.agent_id
								).toString();
								break;
							}
						} else if (tokenURI.startsWith("http")) {
							const response = await fetch(tokenURI);
							const metadata = await response.json();
							if (metadata.agentId || metadata.agent_id) {
								agentIdFromMetadata = (
									metadata.agentId || metadata.agent_id
								).toString();
								break;
							}
						}
					}
				} catch (metadataError) {
					console.warn(
						"Could not get agent ID from metadata for token",
						tokenId,
						metadataError
					);
				}
			}
			if (agentIdFromMetadata) {
				return agentIdFromMetadata;
			}
			// Fallback: use the lowest token ID
			tokenIds.sort((a, b) =>
				BigInt(a) > BigInt(b) ? -1 : BigInt(a) < BigInt(b) ? 1 : 0
			);
			return tokenIds[0];
		}

		console.log("No NFT found for this agent address");
		return null;
	} catch (error) {
		console.error("Error getting Agent ID by agent address:", error);
		return null;
	}
};

/**
 * Enhanced agent NFT checking and automatic minting function
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @param web3Context - Web3 context containing user address
 * @param agentData - Agent data containing NFT address
 * @returns Promise<AgentNFTResult> - Result object with success status and agent ID
 */
export const ensureAgentNFT = async (
	skyBrowser: SkyMainBrowser | null,
	web3Context: Web3Context,
	agentData: AgentData
): Promise<AgentNFTResult> => {
	try {
		if (!skyBrowser) {
			return {
				success: false,
				action: "error",
				message:
					"SkyBrowser not initialized. Please connect your wallet.",
			};
		}

		const agentAddress = agentData?.nft_address || agentData?.originalId;
		if (!agentAddress) {
			return {
				success: false,
				action: "error",
				message:
					"Agent address not found. Please ensure the agent is properly loaded.",
			};
		}

		// First, check if user already owns an NFT for this agent
		const existingAgentId = await getAgentIdByAgentAddress(
			agentAddress,
			web3Context.address,
			skyBrowser
		);

		if (existingAgentId) {
			return {
				success: true,
				agentId: existingAgentId,
				action: "existing",
			};
		}

		console.log(
			"User doesn't own agent NFT, checking if agent NFT is registered..."
		);

		// Check if the agent NFT is registered with NFTMinter
		const registeredNFT =
			await skyBrowser.contractService.NFTMinter.getRegisteredNFTs(
				agentAddress as string
			);

		if (!registeredNFT || !registeredNFT.isRegistered) {
			return {
				success: false,
				action: "not_registered",
				message:
					"This agent's NFT is not registered for minting. Please contact the agent creator.",
			};
		}

		const mintPrice = registeredNFT.mintPrice;
		console.log("Agent NFT mint price:", ethers.formatEther(mintPrice));

		// Check user balance for minting the agent NFT
		const signerProvider = skyBrowser.contractService.signer.provider;
		if (!signerProvider) {
			return {
				success: false,
				action: "error",
				message: "Signer provider not available",
			};
		}

		const balance = await signerProvider.getBalance(web3Context.address);
		const hasBalance = mintPrice === BigInt(0) || balance >= mintPrice;

		if (!hasBalance) {
			const message =
				mintPrice === BigInt(0)
					? "Unable to mint free agent NFT. Please try again."
					: `Insufficient balance to mint agent NFT. You need ${ethers.formatEther(
							mintPrice
					  )} sUSD. Your current balance: ${ethers.formatEther(
							balance
					  )} sUSD`;

			return {
				success: false,
				action: "insufficient_funds",
				message,
				mintPrice: ethers.formatEther(mintPrice),
				userBalance: ethers.formatEther(balance),
			};
		}

		// User has balance, attempt to mint the agent NFT

		const mintResult = await mintAgentNft(skyBrowser, {
			nft_address: agentAddress,
		});

		if (!mintResult) {
			console.log("Failed to mint agent NFT");
		}

		// Wait a moment for the transaction to be processed
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Fetch the newly minted agent NFT ID
		const newAgentId = await getAgentIdByAgentAddress(
			agentAddress,
			web3Context.address,
			skyBrowser
		);

		if (!newAgentId) {
			return {
				success: false,
				action: "mint_verification_failed",
				message:
					"Agent NFT was minted but not found in wallet. Please refresh and try again.",
			};
		}

		return {
			success: true,
			agentId: newAgentId,
			action: "minted",
		};
	} catch (error) {
		console.error("Error in ensureAgentNFT:", error);
		return {
			success: false,
			action: "error",
			message:
				error instanceof Error
					? error.message
					: "Unknown error occurred",
		};
	}
};
/**
 * Check if user owns any NFTs from a specific agent collection
 * @param agentAddress - Agent's NFT contract address
 * @param userAddress - User's wallet address
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<boolean> - True if user owns NFTs from this agent collection
 */
export const checkAgentNFTOwnership = async (
	agentAddress: string,
	userAddress: string,
	skyBrowser: SkyMainBrowser
): Promise<boolean> => {
	try {
		const signer = skyBrowser.contractService.signer;
		const NFTContract = NFT__factory.connect(
			agentAddress as string,
			signer
		);

		// Check balance
		const balance = await NFTContract.balanceOf(userAddress);
		return balance > 0;
	} catch (error) {
		console.error("Error checking agent NFT ownership:", error);
		return false;
	}
};

/**
 * Get all NFT IDs that user owns from a specific agent collection
 * @param agentAddress - Agent's NFT contract address
 * @param userAddress - User's wallet address
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<string[]> - Array of NFT IDs sorted by newest first
 */
export const getUserAgentNFTIds = async (
	agentAddress: string,
	userAddress: string,
	skyBrowser: SkyMainBrowser
): Promise<string[]> => {
	try {
		const signer = skyBrowser.contractService.signer;
		const NFTContract = NFT__factory.connect(
			agentAddress as string,
			signer
		);

		// Check balance
		const balance = await NFTContract.balanceOf(userAddress);

		if (balance === BigInt(0)) {
			return [];
		}

		// Get all token IDs
		const tokenIds: string[] = [];
		for (let i = 0; i < balance; i++) {
			try {
				const tokenId = await NFTContract.tokenOfOwnerByIndex(
					userAddress,
					i
				);
				tokenIds.push(tokenId.toString());
			} catch (error) {
				console.warn(`Error getting token at index ${i}:`, error);
			}
		}

		// Sort token IDs numerically
		return tokenIds.sort((a, b) =>
			BigInt(a) > BigInt(b) ? -1 : BigInt(a) < BigInt(b) ? 1 : 0
		);
	} catch (error) {
		console.error("Error getting user agent NFT IDs:", error);
		return [];
	}
};

/**
 * Manual verification function for agent NFT ownership
 * @param agentAddress - Agent's NFT contract address
 * @param userAddress - User's wallet address
 * @param skyBrowser - Initialized SkyMainBrowser instance
 * @returns Promise<VerificationResult> - Verification result with balance and token IDs
 */
export const verifyAgentNFTOwnership = async (
	agentAddress: string,
	userAddress: string,
	skyBrowser: SkyMainBrowser
): Promise<VerificationResult> => {
	try {
		const signer = skyBrowser.contractService.signer;
		const NFTContract = NFT__factory.connect(
			agentAddress as string,
			signer
		);

		// Check balance
		const balance = await NFTContract.balanceOf(userAddress);

		if (balance && balance > 0) {
			// Get all token IDs
			const tokenIds: string[] = [];
			for (let i = 0; i < balance; i++) {
				try {
					const tokenId = await NFTContract.tokenOfOwnerByIndex(
						userAddress,
						i
					);
					tokenIds.push(tokenId.toString());
				} catch (error) {
					console.warn(`Error getting token ${i}:`, error);
				}
			}

			// Verify ownership of each token
			for (const tokenId of tokenIds) {
				try {
					const owner = await NFTContract.ownerOf(tokenId);
					const isOwner =
						owner.toLowerCase() === userAddress.toLowerCase();
					console.log(
						`Token ${tokenId} owner: ${owner}, Is owner: ${isOwner}`
					);
				} catch (error) {
					console.warn(
						`Error verifying ownership of token ${tokenId}:`,
						error
					);
				}
			}

			return {
				success: true,
				balance: balance.toString(),
				tokenIds,
				message: `User owns ${balance.toString()} NFTs from this agent collection`,
			};
		} else {
			return {
				success: false,
				balance: "0",
				tokenIds: [],
				message:
					"User does not own any NFTs from this agent collection",
			};
		}
	} catch (error) {
		console.error("Error in manual verification:", error);
		return {
			success: false,
			balance: "0",
			tokenIds: [],
			message: `Verification failed: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
		};
	}
};
