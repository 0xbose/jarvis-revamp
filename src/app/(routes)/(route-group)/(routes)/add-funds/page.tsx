"use client";

import React from "react";
import BalanceCard from "@/components/settings/add-funds/balance-card";
import { ethers } from "ethers";
import { useContext, useEffect, useState } from "react";
import { useWeb3AuthSafe } from "@/providers/Web3AuthProvider";
import { isConnectedState, Web3Context } from "@/providers/Web3ContextProvider";

import { web3AuthConfig } from "@/config/web3AuthConfig";
import { useWallet } from "@/hooks/use-wallet";
import { Copy, User } from "lucide-react";
import {
	TooltipProvider,
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@/components/ui/tooltip";

export default function page() {
	// Use the safe hook that handles SSR gracefully
	const { provider } = useWeb3AuthSafe();
	const { address } = useWallet();
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
		<div className="md:p-6">
			<div className="flex flex-col gap-4 md:w-10/12">
				<div className="md:px-4 flex flex-col gap-4 w-fit">
					<h3 className="text-xl font-medium">Credit Balance</h3>
					{address && (
						<TooltipProvider delayDuration={150}>
							<div className="flex items-center gap-2">
								<Tooltip>
									<TooltipTrigger asChild>
										<span
											className="font-mono text-sm text-muted-foreground bg-muted px-2 py-1 rounded"
											aria-label="Wallet address"
											title={address}
										>
											{address.slice(0, 6)}...
											{address.slice(-4)}
										</span>
									</TooltipTrigger>
									<TooltipContent side="top">
										<span className="font-mono text-xs">
											{address}
										</span>
									</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											onClick={() =>
												navigator.clipboard.writeText(
													address
												)
											}
											className="active:scale-80 transition-transform"
											aria-label="Copy address"
											title="Copy address"
										>
											<Copy className="w-3.5 h-3.5" />
										</button>
									</TooltipTrigger>
									<TooltipContent side="top">
										Copy
									</TooltipContent>
								</Tooltip>
							</div>
						</TooltipProvider>
					)}
					<div className="flex flex-col gap-4">
						<BalanceCard
							title="Agent Studio Balance"
							amount={parseFloat(studioBalance)}
							patternImgUrl="/images/dot_pattern.png"
						/>
					</div>
					<p className="text-sm text-muted-foreground">
						Your credit balance will be consumed with agent usage.
						You can add funds to your crypto wallet and then
						transfer those funds to Jarvis balance.
					</p>
				</div>
			</div>
		</div>
	);
}
