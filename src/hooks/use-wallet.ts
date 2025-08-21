"use client";
import { useState, useEffect } from "react";
import { useWeb3AuthSafe } from "@/providers/Web3AuthProvider";
import { initializeSkynet } from "@/utils/skynetHelper";
import { ethers } from "ethers";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";

export const useWallet = () => {
	const { provider, isConnected, connect, logout } = useWeb3AuthSafe();
	const [skyBrowser, setSkyBrowser] = useState<SkyMainBrowser | null>(null);
	const [address, setAddress] = useState<string | null>(null);
	const [balance, setBalance] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const initializeSkynetBrowser = async () => {
			if (!provider || !isConnected) {
				setSkyBrowser(null);
				setAddress(null);
				setBalance(null);
				return;
			}

			try {
				setLoading(true);
				setError(null);

				const ethersProvider = new ethers.BrowserProvider(provider);
				const signer = await ethersProvider.getSigner();
				const userAddress = await signer.getAddress();

				const browser = await initializeSkynet(provider, signer);

				const userBalance = await ethersProvider.getBalance(
					userAddress
				);

				setSkyBrowser(browser);
				setAddress(userAddress);
				setBalance(ethers.formatEther(userBalance));
			} catch (err) {
				console.error("Failed to initialize Skynet:", err);
				setError(
					err instanceof Error ? err.message : "Failed to initialize"
				);
			} finally {
				setLoading(false);
			}
		};

		initializeSkynetBrowser();
	}, [provider, isConnected]);

	const connectWallet = async () => {
		try {
			setLoading(true);
			setError(null);
			await connect();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to connect wallet"
			);
		} finally {
			setLoading(false);
		}
	};

	const disconnectWallet = async () => {
		try {
			await logout();
			setSkyBrowser(null);
			setAddress(null);
			setBalance(null);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to disconnect wallet"
			);
		}
	};

	return {
		skyBrowser,
		address,
		balance,
		isConnected,
		loading,
		error,

		connect: connectWallet,
		disconnect: disconnectWallet,
	};
};
