"use client";
import { useState, useEffect } from "react";
import { useWallet } from "./use-wallet";
import { fetchUserNfts, mintNft } from "@/utils/skynetHelper";
import { NFTResult } from "@/types/wallet";

export const useNft = () => {
	const { skyBrowser, address, isConnected } = useWallet();
	const [nfts, setNfts] = useState<string[]>([]);
	const [selectedNftId, setSelectedNftId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [minting, setMinting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	
	useEffect(() => {
		const loadNfts = async () => {
			if (!skyBrowser || !address || !isConnected) {
				setNfts([]);
				setSelectedNftId(null);
				return;
			}

			try {
				setLoading(true);
				setError(null);

				const userNfts = await fetchUserNfts(address, skyBrowser);
				setNfts(userNfts);

				
				if (userNfts.length > 0 && !selectedNftId) {
					setSelectedNftId(userNfts[0]);
				}
			} catch (err) {
				console.error("Failed to fetch NFTs:", err);
				setError(
					err instanceof Error ? err.message : "Failed to fetch NFTs"
				);
			} finally {
				setLoading(false);
			}
		};

		loadNfts();
	}, [skyBrowser, address, isConnected, selectedNftId]);

	const mintNewNft = async (): Promise<NFTResult> => {
		if (!skyBrowser) {
			return {
				success: false,
				action: "error",
				message: "Wallet not connected",
			};
		}

		try {
			setMinting(true);
			setError(null);

			const success = await mintNft(skyBrowser);

			if (success) {
				
				const updatedNfts = await fetchUserNfts(address!, skyBrowser);
				setNfts(updatedNfts);

				
				if (updatedNfts.length > 0) {
					setSelectedNftId(updatedNfts[0]);
				}

				return {
					success: true,
					nftId: updatedNfts[0],
					action: "minted",
				};
			}

			return {
				success: false,
				action: "error",
				message: "Failed to mint NFT",
			};
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Minting failed";
			setError(errorMessage);
			return {
				success: false,
				action: "error",
				message: errorMessage,
			};
		} finally {
			setMinting(false);
		}
	};

	const selectNft = (nftId: string) => {
		setSelectedNftId(nftId);
		if (address) {
			localStorage.setItem(`selectedNftId-${address}`, nftId);
		}
	};

	return {
		
		nfts,
		selectedNftId,
		loading,
		minting,
		error,
		hasNfts: nfts.length > 0,

			
		mintNft: mintNewNft,
		selectNft,
		refreshNfts: () => {
			if (skyBrowser && address) {
				fetchUserNfts(address, skyBrowser).then(setNfts);
			}
		},
	};
};
