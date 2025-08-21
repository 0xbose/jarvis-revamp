"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { MetaMaskProvider } from "@/providers/add-funds/MetaMaskProvider";
import { WalletIcon } from "lucide-react";
import { SolanaLogoIcon } from "@/components/icons/SolanaLogoIcon";

interface FundsWalletStepProps {
	onSelect: (wallet: string) => void;
}

const FundsWalletStep: React.FC<FundsWalletStepProps> = ({ onSelect }) => {
	// Dynamically detect available EVM wallets
	const availableEVMWallets =
		typeof window !== "undefined"
			? MetaMaskProvider.getAvailableInjectedWallets()
			: [];

	return (
		<div className="bg-background text-foreground px-2">
			<h2 className="text-xl font-medium mb-6 text-center text-foreground">
				Select Wallet
			</h2>
			<div className="flex flex-col gap-4 w-full">
				{availableEVMWallets.map((wallet) => (
					<Button
						key={wallet.type}
						variant="outline"
						className="w-full flex items-center gap-2 bg-background text-foreground h-14"
						onClick={() => onSelect(wallet.type)}
						size={"lg"}
					>
						<WalletIcon className="opacity-50 text-foreground" />
						<p className="text-sm font-normal text-foreground">
							{wallet.label}
						</p>
					</Button>
				))}
				<Button
					variant="outline"
					className="w-full flex items-center gap-2 bg-background text-foreground h-14"
					onClick={() => onSelect("phantom")}
					size={"lg"}
				>
					<SolanaLogoIcon className="opacity-50" style={{
						transform: "translate(-18%, 0%)",
						color: "hsl(var(--foreground))",
					}} />
					<p className="text-sm font-normal text-foreground">
						Phantom
					</p>
				</Button>
			</div>
		</div>
	);
};

export default FundsWalletStep;
