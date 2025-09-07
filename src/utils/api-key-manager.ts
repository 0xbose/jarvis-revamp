import axios from "axios";
import { getAuthWithRetry, ensureUserHasNFT } from "./skynetHelper";
import { API_KEY_CONFIG } from "@/config/constants";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context, ApiKeyData } from "@/types/wallet";

export class ApiKeyManager {
	private static instance: ApiKeyManager;
	private cachedApiKey: string | null = null;
	private cachedAddress: string | null = null;

	public static getInstance(): ApiKeyManager {
		if (!ApiKeyManager.instance) {
			ApiKeyManager.instance = new ApiKeyManager();
		}
		return ApiKeyManager.instance;
	}

	public async getApiKey(
		skyBrowser: SkyMainBrowser,
		web3Context: Web3Context
	): Promise<string> {
		const currentAddress = web3Context.address?.toLowerCase();

		if (!currentAddress) {
			throw new Error("No wallet address available");
		}

		// Check if cached API key matches current address
		if (this.cachedApiKey && this.cachedAddress === currentAddress) {
			console.log("🔑 Using cached API key for address:", currentAddress);
			return this.cachedApiKey;
		}

		// Check localStorage for valid API key for this address
		const storedApiKeyData = this.getStoredApiKeyData(currentAddress);
		if (
			storedApiKeyData &&
			this.isApiKeyValid(storedApiKeyData, currentAddress)
		) {
			console.log(
				"🔑 Found valid API key in localStorage for address:",
				currentAddress
			);
			this.cachedApiKey = storedApiKeyData.apiKey;
			this.cachedAddress = currentAddress;
			return storedApiKeyData.apiKey;
		}

		// Generate new API key if not found or invalid
		console.log("🔑 Generating new API key for address:", currentAddress);
		const newApiKey = await this.generateNewApiKey(skyBrowser, web3Context);
		this.cachedApiKey = newApiKey;
		this.cachedAddress = currentAddress;
		return newApiKey;
	}

	private async generateNewApiKey(
		skyBrowser: SkyMainBrowser,
		web3Context: Web3Context
	): Promise<string> {
		try {
			const auth = await getAuthWithRetry(skyBrowser);
			const nftResult = await ensureUserHasNFT(skyBrowser, web3Context);

			if (!nftResult.success) {
				throw new Error(
					nftResult.message ||
						"Failed to get NFT for API key generation"
				);
			}

			const response = await axios.post(API_KEY_CONFIG.GENERATION_URL, {
				userAuthPayload: JSON.stringify(auth.data),
				accountNFT: JSON.stringify({
					collectionID: "0",
					nftID: nftResult.nftId,
				}),
			});

			const apiKey = response.data.data.apiKey;
			const userAddress = (
				auth.data.userAddress ||
				web3Context.address ||
				""
			).toLowerCase();

			// Store API key with address
			this.storeApiKeyData({
				apiKey,
				userAddress,
				nftId: nftResult.nftId,
				timestamp: Date.now(),
				expiresAt: Date.now() + API_KEY_CONFIG.VALIDITY_DURATION,
			});

			return apiKey;
		} catch (error) {
			console.error("Error generating API key:", error);
			throw new Error("Failed to generate API key");
		}
	}

	private getStoredApiKeyData(address: string): ApiKeyData | null {
		try {
			// Create storage key specific to the address
			const storageKey = `${
				API_KEY_CONFIG.STORAGE_KEY
			}_${address.toLowerCase()}`;
			const stored = localStorage.getItem(storageKey);

			if (!stored) {
				// Also check legacy storage without address for backward compatibility
				const legacyStored = localStorage.getItem(
					API_KEY_CONFIG.STORAGE_KEY
				);
				if (legacyStored) {
					const legacyData = JSON.parse(legacyStored);
					// Migrate legacy data if it matches the current address
					if (
						legacyData.userAddress?.toLowerCase() ===
						address.toLowerCase()
					) {
						// Store in new format
						this.storeApiKeyData({
							...legacyData,
							userAddress: address.toLowerCase(),
							expiresAt:
								legacyData.expiresAt ||
								legacyData.timestamp +
									API_KEY_CONFIG.VALIDITY_DURATION,
						});
						// Remove legacy storage
						localStorage.removeItem(API_KEY_CONFIG.STORAGE_KEY);
						return legacyData;
					}
				}
				return null;
			}

			return JSON.parse(stored);
		} catch (error) {
			console.error("Error reading stored API key data:", error);
			return null;
		}
	}

	private isApiKeyValid(data: ApiKeyData, address: string): boolean {
		// Check if address matches
		if (data.userAddress?.toLowerCase() !== address.toLowerCase()) {
			console.log(
				"🔑 API key address mismatch:",
				data.userAddress,
				"vs",
				address
			);
			return false;
		}

		// Check expiration (3 months)
		const now = Date.now();
		const expiresAt =
			data.expiresAt || data.timestamp + API_KEY_CONFIG.VALIDITY_DURATION;

		if (now >= expiresAt) {
			console.log("🔑 API key expired for address:", address);
			return false;
		}

		return true;
	}

	private storeApiKeyData(data: ApiKeyData): void {
		try {
			const address = data.userAddress?.toLowerCase();
			if (!address) {
				console.error("Cannot store API key without address");
				return;
			}

			// Create storage key specific to the address
			const storageKey = `${API_KEY_CONFIG.STORAGE_KEY}_${address}`;

			// Ensure we have expiration time
			const dataWithExpiration = {
				...data,
				userAddress: address,
				expiresAt:
					data.expiresAt ||
					data.timestamp + API_KEY_CONFIG.VALIDITY_DURATION,
			};

			localStorage.setItem(
				storageKey,
				JSON.stringify(dataWithExpiration)
			);

			console.log(
				"🔑 Stored API key for address:",
				address,
				"expires at:",
				new Date(dataWithExpiration.expiresAt).toLocaleString()
			);

			// Trigger auth sync event
			if (typeof window !== "undefined") {
				window.dispatchEvent(new CustomEvent("api-key-updated"));
			}
		} catch (error) {
			console.error("Failed to store API key data:", error);
		}
	}

	public clearCache(address?: string): void {
		if (address) {
			// Clear cache for specific address
			const normalizedAddress = address.toLowerCase();
			if (this.cachedAddress === normalizedAddress) {
				this.cachedApiKey = null;
				this.cachedAddress = null;
			}
			const storageKey = `${API_KEY_CONFIG.STORAGE_KEY}_${normalizedAddress}`;
			localStorage.removeItem(storageKey);
			console.log("🔑 Cleared API key for address:", normalizedAddress);

			// Trigger auth sync event
			if (typeof window !== "undefined") {
				window.dispatchEvent(new CustomEvent("api-key-updated"));
			}
		} else {
			// Clear all cache
			this.cachedApiKey = null;
			this.cachedAddress = null;

			// Clear all API keys from localStorage
			const keysToRemove: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && key.startsWith(API_KEY_CONFIG.STORAGE_KEY)) {
					keysToRemove.push(key);
				}
			}

			keysToRemove.forEach((key) => localStorage.removeItem(key));
			console.log("🔑 Cleared all API keys");

			// Trigger auth sync event
			if (typeof window !== "undefined") {
				window.dispatchEvent(new CustomEvent("api-key-updated"));
			}
		}
	}
}

export const apiKeyManager = ApiKeyManager.getInstance();
