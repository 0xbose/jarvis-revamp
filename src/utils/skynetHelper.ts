import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import SkyBrowserSigner from "@decloudlabs/skynet/lib/services/SkyBrowserSigner";
import SkyEtherContractService from "@decloudlabs/skynet/lib/services/SkyEtherContractService";
import { SkyEnvConfigBrowser } from "@decloudlabs/skynet/lib/types/types";
import { Eip1193Provider, ethers } from "ethers";
import axios, { AxiosError } from "axios";
import { API_CONFIG } from "@/config/constants";
import { NFT__factory } from "@decloudlabs/skynet/lib/types/contracts";
import { KNOWLEDGE_PROMPTS } from "@/constants/knowledge";

// Define constants locally since the import path doesn't exist
export const KNOWLEDGE_TYPES = {
	AGENT: "agent",
	SWARM: "swarm",
} as const;

export const CONTENT_TYPES = {
	JSON: "application/json",
} as const;

// Type definitions
interface Web3Context {
	address: string;
}

interface AgentData {
	nft_address?: string;
	collection_id?: string;
	originalId?: string;
}

interface Web3Auth {
	provider?: unknown;
}

interface NFTResult {
	success: boolean;
	nftId?: string;
	action?: "existing" | "minted" | "error";
	message?: string;
	mintPrice?: string;
	userBalance?: string;
}

interface AgentNFTResult {
	success: boolean;
	agentId?: string;
	action?: "existing" | "minted" | "error";
	message?: string;
	mintPrice?: string;
	userBalance?: string;
}

interface APIPayload {
	prompt: string;
	userAuthPayload: {
		userAddress: string;
		signature: string;
		message: string;
	};
	nftId: string;
}

interface KnowledgeBasePayload {
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

interface VerificationResult {
	success: boolean;
	balance: string;
	tokenIds: string[];
	message: string;
}

interface RegistrationCheck {
	isRegistered: boolean;
	registeredData?: unknown;
	mintPrice?: string;
	isActive?: boolean;
	error?: string;
}

export const fetchNfts = async (
	address: string,
	skyBrowser: SkyMainBrowser
) => {
	let storedNfts = JSON.parse(
		localStorage.getItem(`nfts-${address}`) || "[]"
	);
	let selectedNftId = localStorage.getItem(`selectedNftId-${address}`);

	const BATCH_SIZE = 20; // Number of NFTs to fetch in each batch

	try {
		const nftCount = await skyBrowser?.contractService.AgentNFT.balanceOf(
			address
		);
		if (nftCount) {
			const totalCount = parseInt(nftCount.toString());
			let currentIndex = storedNfts.length;

			while (currentIndex < totalCount) {
				const batchPromises = [];
				const endIndex = Math.min(
					currentIndex + BATCH_SIZE,
					totalCount
				);

				// Create batch of promises
				for (let i = currentIndex; i < endIndex; i++) {
					batchPromises.push(
						skyBrowser?.contractService.AgentNFT.tokenOfOwnerByIndex(
							address,
							i
						)
					);
				}

				// Execute batch
				const batchResults = await Promise.all(batchPromises);
				const newNftIds = batchResults
					.filter((nft) => nft)
					.map((nft) => nft.toString());

				// Update state and localStorage with new batch
				const updatedNfts = [...storedNfts, ...newNftIds].sort(
					(a, b) => parseInt(b) - parseInt(a)
				);
				storedNfts = updatedNfts;
				localStorage.setItem(
					`nfts-${address}`,
					JSON.stringify(updatedNfts)
				);

				currentIndex += BATCH_SIZE;
			}

			// Handle selected NFT after all NFTs are loaded
			if (
				!selectedNftId ||
				!(await isValidOwner(selectedNftId, address, skyBrowser))
			) {
				selectedNftId = storedNfts[0];
				localStorage.setItem(
					`selectedNftId-${address}`,
					selectedNftId!
				);
			}

			return storedNfts; // Return the NFTs array
		}
		return []; // Return empty array if no NFTs found
	} catch (error) {
		console.error("Error fetching NFTs:", error);
		return []; // Return empty array on error
	}
};

export const mintNft = async (skyBrowser: SkyMainBrowser) => {
	try {
		const registeredNFT =
			await skyBrowser.contractService.NFTMinter.getRegisteredNFTs(
				skyBrowser.contractService.AgentNFT
			);

		// Based on the provided code, registeredNFT should have properties like isRegistered and mintPrice
		const isRegistered = registeredNFT.isRegistered;
		const mintPrice = registeredNFT.mintPrice;

		if (!registeredNFT || !isRegistered || mintPrice === undefined) {
			console.error(
				"Minting failed: No registered NFT or mint price undefined"
			);
			return false;
		}

		const response = await skyBrowser.contractService.callContractWrite(
			skyBrowser.contractService.NFTMinter.mint(
				skyBrowser.contractService.selectedAccount,
				skyBrowser.contractService.AgentNFT,
				{
					value: mintPrice,
				}
			)
		);

		if (response.success) {
			await fetchNfts(
				skyBrowser.contractService.selectedAccount,
				skyBrowser
			);
			return true;
		}
		return false;
	} catch (error) {
		console.error("Error minting NFT:", error);
		return false;
	}
};

export const mintSkynetNFT = async (
	skyBrowser: SkyMainBrowser,
	address: string,
	web3Auth: Web3Auth
) => {
	try {
		const success = await mintNft(skyBrowser);
		if (success) {
			// Fetch updated NFTs after minting
			const nfts = await fetchNfts(address, skyBrowser);
			const newNftId = nfts[0]; // Get the newest NFT
			return {
				success: true,
				nftId: newNftId,
			};
		}
		return {
			success: false,
			error: "Failed to mint NFT",
		};
	} catch (error) {
		console.error("Error in mintSkynetNFT:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
};

export const fetchUserNfts = async (
	address: string,
	skyBrowser: SkyMainBrowser
) => {
	return await fetchNfts(address, skyBrowser);
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

const isValidOwner = async (
	tokenId: string,
	address: string,
	skyBrowser: SkyMainBrowser
) => {
	try {
		const owner = await skyBrowser?.contractService.AgentNFT.ownerOf(
			tokenId
		);
		return owner?.toLowerCase() === address.toLowerCase();
	} catch {
		return false;
	}
};

// Enhanced authentication with retry logic
export const getAuthWithRetry = async (
	skyBrowser: SkyMainBrowser,
	maxRetries = 3
) => {
	for (let i = 0; i < maxRetries; i++) {
		try {
			const signatureResp = await skyBrowser?.appManager?.getUrsulaAuth();

			if (
				signatureResp?.success &&
				signatureResp.data?.userAddress &&
				signatureResp.data?.signature &&
				signatureResp.data?.message
			) {
				return signatureResp;
			}

			console.warn(`Auth attempt ${i + 1} failed:`, signatureResp);

			// Wait before retry
			if (i < maxRetries - 1) {
				await new Promise((resolve) =>
					setTimeout(resolve, 1000 * (i + 1))
				);
			}
		} catch (error) {
			console.error(`Auth attempt ${i + 1} error:`, error);
			if (i === maxRetries - 1) throw error;
		}
	}

	throw new Error("Failed to get authentication after retries");
};

// Enhanced API request wrapper with retry logic using axios
export const makeApiRequest = async (
	url: string,
	payload: unknown,
	retries = 2
) => {
	console.log("makeApiRequest called:", { url, payload, retries });

	for (let i = 0; i <= retries; i++) {
		try {
			console.log(`Making API request attempt ${i + 1} to:`, url);
			const response = await axios.post(url, payload, {
				headers: {
					"Content-Type": CONTENT_TYPES.JSON,
				},
				timeout: 60000, // 60 second timeout
			});

			console.log("API request successful:", {
				status: response.status,
				headers: response.headers,
				dataType: typeof response.data,
				data: response.data,
			});

			// Check if response is HTML (error page)
			if (
				typeof response.data === "string" &&
				response.data.includes("<!DOCTYPE html>")
			) {
				console.warn(
					"API returned HTML instead of JSON - possible server error"
				);
				// Treat HTML response as an error and retry
				throw new Error("API returned HTML instead of JSON");
			}

			return response.data;
		} catch (error) {
			const axiosError = error as AxiosError;
			console.error(`Request attempt ${i + 1} failed:`, axiosError);

			if (axiosError.response) {
				// Server responded with error status
				const status = axiosError.response.status;
				const errorData = axiosError.response.data;

				console.error(`Error response ${i + 1}:`, {
					status,
					data: errorData,
					headers: axiosError.response.headers,
				});

				// Don't retry on 4xx client errors
				if (status >= 400 && status < 500) {
					const errorMessage =
						typeof errorData === "string"
							? errorData
							: (errorData as { message?: string })?.message ||
							  JSON.stringify(errorData);
					throw new Error(`Client Error ${status}: ${errorMessage}`);
				}

				// Retry on 5xx server errors
				if (i < retries && status >= 500) {
					await new Promise((resolve) =>
						setTimeout(resolve, 1000 * (i + 1))
					);
					continue;
				}

				const errorMessage =
					typeof errorData === "string"
						? errorData
						: (errorData as { message?: string })?.message ||
						  JSON.stringify(errorData);
				throw new Error(`Server Error ${status}: ${errorMessage}`);
			} else if (axiosError.request) {
				// Network error - retry if we have attempts left
				console.error(
					`Network error attempt ${i + 1}:`,
					axiosError.message
				);

				if (i < retries) {
					await new Promise((resolve) =>
						setTimeout(resolve, 1000 * (i + 1))
					);
					continue;
				}

				throw new Error(`Network Error: ${axiosError.message}`);
			} else {
				// Other error
				console.error(
					`Request setup error attempt ${i + 1}:`,
					axiosError.message
				);
				throw new Error(`Request Error: ${axiosError.message}`);
			}
		}
	}
};

// API payload validation
export const validateAPIPayload = (payload: APIPayload) => {
	const required = ["prompt", "userAuthPayload", "nftId"] as const;
	const missing = required.filter(
		(field) => !payload[field as keyof APIPayload]
	);

	if (missing.length > 0) {
		throw new Error(`Missing required fields: ${missing.join(", ")}`);
	}

	if (
		!payload.userAuthPayload.userAddress ||
		!payload.userAuthPayload.signature ||
		!payload.userAuthPayload.message
	) {
		throw new Error("Invalid userAuthPayload structure");
	}

	return true;
};

// Generate agent with enhanced validation
export const generateAgentWithValidation = async (
	prompt: string,
	skyBrowser: SkyMainBrowser | null,
	web3Context: Web3Context
) => {
	// Validate inputs
	if (!prompt?.trim()) throw new Error("Prompt is required");
	if (!skyBrowser) throw new Error("SkyBrowser not initialized");

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

	// Prepare and validate payload
	const payload = {
		prompt: prompt.trim(),
		userAuthPayload: auth.data,
		nftId,
	};

	validateAPIPayload(payload);

	// Make request with proper error handling
	return await makeApiRequest(
		process.env.NEXT_PUBLIC_SKYINTEL_API_URL || "",
		payload
	);
};

// Skynet initialization functions
export const validateNetwork = async (
	provider: ethers.BrowserProvider
): Promise<boolean> => {
	const network = await provider.getNetwork();
	return network.chainId === BigInt(619); // Skynet chain ID
};

export const createContractService = (
	provider: unknown,
	signer: ethers.Signer,
	address: string
): SkyEtherContractService => {
	return new SkyEtherContractService(
		provider as never,
		signer,
		address,
		619 // Skynet chain ID
	);
};

export const createSkyBrowser = (
	contractService: SkyEtherContractService
): SkyMainBrowser => {
	const envConfig: SkyEnvConfigBrowser = {
		STORAGE_API: process.env.NEXT_PUBLIC_STORAGE_API_URL || "",
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

export const initializeSkynet = async (
	provider: unknown,
	signer: ethers.Signer
): Promise<SkyMainBrowser> => {
	const ethersProvider = new ethers.BrowserProvider(
		provider as unknown as Eip1193Provider
	);
	const address = await signer.getAddress();

	// Validate network
	const isValidNetwork = await validateNetwork(ethersProvider);
	if (!isValidNetwork) {
		throw new Error(`Please switch to Skynet network (Chain ID: 619)`);
	}

	// Create contract service
	const contractService = createContractService(provider, signer, address);

	// Create and initialize SkyBrowser
	const skyBrowser = createSkyBrowser(contractService);
	await skyBrowser.init(true);

	return skyBrowser;
};

export const checkUserBalance = async (skyBrowser: SkyMainBrowser | null) => {
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

// Enhanced NFT checking and minting function
// This function ensures the user has at least one NFT for all operations (running workflows, generating agents, etc.)
// Only one NFT is needed - it can be reused for all operations
export const ensureUserHasNFT = async (
	skyBrowser: SkyMainBrowser | null,
	web3Context: Web3Context
) => {
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

// Check if AgentNFT is registered with NFTMinter
export const checkNFTRegistration = async (
	skyBrowser: SkyMainBrowser | null
) => {
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

// Agent-specific NFT minting function
export const mintAgentNft = async (
	skyBrowser: SkyMainBrowser,
	agent: AgentData
) => {
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

// Get agent-specific NFTs
export const getAgentNft = async (
	skyBrowser: SkyMainBrowser,
	agent: AgentData
) => {
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

// Fetch knowledge base records using Natural Request API
export const fetchKnowledgeBaseRecords = async (
	skyBrowser: SkyMainBrowser,
	userAddress: string,
	agentData: AgentData,
	selectedNftId?: string,
	agentId?: string,
	knowledgeType?: "swarm" | "agent"
) => {
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

// Save knowledge base record using Natural Request API
export const saveKnowledgeBaseRecord = async (
	skyBrowser: SkyMainBrowser,
	userAddress: string,
	agentData: AgentData,
	selectedNftId: string,
	content: string,
	agentId?: string,
	knowledgeType?: "swarm" | "agent"
) => {
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

export const getNftIdByAgentAddress = async (
	agentAddress: string,
	userAddress: string,
	skyBrowser: SkyMainBrowser
) => {
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

export const getAgentIdByAgentAddress = async (
	agentAddress: string,
	userAddress: string,
	skyBrowser: SkyMainBrowser
) => {
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

// Enhanced agent NFT checking and automatic minting function
export const ensureAgentNFT = async (
	skyBrowser: SkyMainBrowser | null,
	web3Context: Web3Context,
	agentData: AgentData
) => {
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
// Check if user owns any NFTs from a specific agent collection
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

// Get all NFT IDs that user owns from a specific agent collection
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

// Manual verification function for agent NFT ownership
export const verifyAgentNFTOwnership = async (
	agentAddress: string,
	userAddress: string,
	skyBrowser: SkyMainBrowser
) => {
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
