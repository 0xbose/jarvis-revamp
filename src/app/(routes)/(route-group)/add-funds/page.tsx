"use client";

import React from "react";
import BalanceCard from "@/components/settings/add-funds/balance-card";
import { ethers } from "ethers";
import { useContext, useEffect, useState } from "react";
import { useWeb3AuthSafe } from "@/providers/Web3AuthProvider";
import { isConnectedState, Web3Context } from "@/providers/Web3ContextProvider";

import { web3AuthConfig } from "@/config/web3AuthConfig";

export default function page() {
	// Use the safe hook that handles SSR gracefully
	const { provider } = useWeb3AuthSafe();
	
	const web3Context = useContext(Web3Context);
	const [studioBalance, setStudioBalance] = useState("0");

	// Load studio balance using mainnet provider
	useEffect(() => {
		const loadStudioBalance = async () => {
			if (!provider || !isConnectedState(web3Context)) return;
			try {
				const mainnetProvider = new ethers.JsonRpcProvider(
					web3AuthConfig.chainConfig.rpcTarget
				);
				const mainnetBalanceInWei = await mainnetProvider.getBalance(
					web3Context.address as string
				);
				const mainnetBalanceInEth =
					ethers.formatEther(mainnetBalanceInWei);
				const formattedBalance =
					parseFloat(mainnetBalanceInEth).toFixed(4);
				setStudioBalance(formattedBalance);
			} catch (error) {
				console.error("Error fetching Studio balance:", error);
				setStudioBalance("0");
			}
		};
		loadStudioBalance();
	}, [provider, web3Context]);
	return (
		<div className="p-6">

		<div className="max-w-7xl mx-auto flex flex-col gap-4 w-10/12">
			<div className="px-4 flex flex-col gap-4 w-fit">
				<h3 className="text-lg font-medium">Credit Balance</h3>
				<div className="">
					<BalanceCard
						title="Agent Studio Balance"
						amount={parseFloat(studioBalance)}
						patternImgUrl="/images/dot_pattern.png"
						/>
				</div>
				<p className="text-sm text-muted-foreground">
					Your credit balance will be consumed with agent usage. You
					can add funds to your crypto wallet and then transfer those
					funds to Jarvis balance.
				</p>
			</div>
						</div>
		</div>
	);
}
