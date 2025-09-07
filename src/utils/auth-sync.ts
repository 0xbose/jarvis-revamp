"use client";

import { API_KEY_CONFIG } from "@/config/constants";

/**
 * Utility to sync authentication state from localStorage to cookies
 * This allows the middleware to access authentication state
 */
export class AuthSync {
	private static instance: AuthSync;

	public static getInstance(): AuthSync {
		if (!AuthSync.instance) {
			AuthSync.instance = new AuthSync();
		}
		return AuthSync.instance;
	}

	/**
	 * Sync API key and wallet address from localStorage to cookies
	 */
	public syncAuthToCookies(): void {
		if (typeof window === "undefined") return;

		try {
			// Get wallet address from Web3Auth or other sources
			const walletAddress = this.getWalletAddress();

			// Get API key from localStorage
			const apiKey = this.getApiKeyFromStorage(walletAddress);

			// Set cookies
			this.setCookie("wallet_address", walletAddress || "");
			this.setCookie("skynet_api_key", apiKey || "");

			console.log("🔄 AuthSync: Synced auth state to cookies", {
				hasWalletAddress: !!walletAddress,
				hasApiKey: !!apiKey,
			});
		} catch (error) {
			console.error("❌ AuthSync: Failed to sync auth state:", error);
			// Clear cookies on error
			this.clearAuthCookies();
		}
	}

	/**
	 * Clear authentication cookies
	 */
	public clearAuthCookies(): void {
		this.setCookie("wallet_address", "", -1);
		this.setCookie("skynet_api_key", "", -1);
		console.log("🧹 AuthSync: Cleared auth cookies");
	}

	/**
	 * Get wallet address from various sources
	 */
	private getWalletAddress(): string | null {
		// Try to get from Web3Auth localStorage
		try {
			const web3AuthData = localStorage.getItem("web3auth");
			if (web3AuthData) {
				const parsed = JSON.parse(web3AuthData);
				return parsed?.userInfo?.address || parsed?.address || null;
			}
		} catch (error) {
			console.warn("Failed to parse Web3Auth data:", error);
		}

		// Try to get from other wallet providers
		try {
			const phantomData = localStorage.getItem("phantom");
			if (phantomData) {
				const parsed = JSON.parse(phantomData);
				return parsed?.publicKey || parsed?.address || null;
			}
		} catch (error) {
			console.warn("Failed to parse Phantom data:", error);
		}

		return null;
	}

	/**
	 * Get API key from localStorage for the given address
	 */
	private getApiKeyFromStorage(address: string | null): string | null {
		if (!address) return null;

		try {
			const storageKey = `${
				API_KEY_CONFIG.STORAGE_KEY
			}_${address.toLowerCase()}`;
			const stored = localStorage.getItem(storageKey);

			if (!stored) {
				// Check legacy storage
				const legacyStored = localStorage.getItem(
					API_KEY_CONFIG.STORAGE_KEY
				);
				if (legacyStored) {
					const legacyData = JSON.parse(legacyStored);
					if (
						legacyData.userAddress?.toLowerCase() ===
						address.toLowerCase()
					) {
						return legacyData.apiKey || null;
					}
				}
				return null;
			}

			const data = JSON.parse(stored);

			// Check if API key is still valid (not expired)
			const now = Date.now();
			const expiresAt =
				data.expiresAt ||
				data.timestamp + API_KEY_CONFIG.VALIDITY_DURATION;

			if (now >= expiresAt) {
				console.log(
					"🔑 AuthSync: API key expired, clearing from storage"
				);
				localStorage.removeItem(storageKey);
				return null;
			}

			return data.apiKey || null;
		} catch (error) {
			console.error("Failed to get API key from storage:", error);
			return null;
		}
	}

	/**
	 * Set a cookie with the given name, value, and expiration days
	 */
	private setCookie(name: string, value: string, days: number = 7): void {
		const expires = new Date();
		expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

		document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
	}

	/**
	 * Listen for storage changes and sync accordingly
	 */
	public startListening(): void {
		if (typeof window === "undefined") return;

		// Listen for localStorage changes
		window.addEventListener("storage", (e) => {
			if (
				e.key?.startsWith(API_KEY_CONFIG.STORAGE_KEY) ||
				e.key === "web3auth" ||
				e.key === "phantom"
			) {
				console.log(
					"🔄 AuthSync: Storage change detected, syncing auth state"
				);
				this.syncAuthToCookies();
			}
		});

		// Also listen for custom events from the app
		window.addEventListener("wallet-connected", () => {
			console.log(
				"🔄 AuthSync: Wallet connected event, syncing auth state"
			);
			this.syncAuthToCookies();
		});

		window.addEventListener("wallet-disconnected", () => {
			console.log(
				"🔄 AuthSync: Wallet disconnected event, clearing auth state"
			);
			this.clearAuthCookies();
		});

		window.addEventListener("api-key-updated", () => {
			console.log(
				"🔄 AuthSync: API key updated event, syncing auth state"
			);
			this.syncAuthToCookies();
		});
	}
}

export const authSync = AuthSync.getInstance();
