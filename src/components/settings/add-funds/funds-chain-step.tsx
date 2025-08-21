"use client";
import React from "react";
import { WalletType } from "@/providers/add-funds/WalletProvider";
import { useWeb3Auth } from "@web3auth/modal-react-hooks";
import { Web3RPC } from "@/utils/rpc/web3RPC";
import { ethers } from "ethers";
import { executeFundsTransaction } from "./fund-transaction";
import { toast } from "sonner";
import Image from "next/image";
import { TransactionStepper } from "./transaction-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { handleArbitrumETHtoSkynet } from "@/utils/funds/bridge";
import { getFromTokenUSDValue } from "@/utils/funds/funds";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Fuel } from "lucide-react";

// Inline types
export interface Chain {
	id: number | string;
	name: string;
	logoURI?: string;
}

export interface Token {
	address: string;
	symbol: string;
	name: string;
	decimals: number;
	logoURI?: string;
	chainId?: number | string;
}

interface FundsChainStepProps {
	availableChains: Chain[];
	availableTokens: Token[];
	selectedWallet: WalletType | null;
	isLoadingChains: boolean;
	isLoadingTokens: boolean;
	selectedChain: Chain | null;
	handleChainSelect: (chain: Chain) => void;
	handleTokenSelect: (token: Token) => void;
	selectedToken: Token | null;
}

const FundsChainStep: React.FC<
	FundsChainStepProps & {
		amount: string;
		setAmount: (val: string) => void;
		balance: string | null;
		isLoadingQuote: boolean;
		quote: any;
		onContinue: () => void;
		disableContinue: boolean;
	}
> = ({
	availableChains,
	availableTokens,
	selectedWallet,
	isLoadingChains,
	isLoadingTokens,
	selectedChain,
	handleChainSelect,
	handleTokenSelect,
	selectedToken,
	amount,
	setAmount,
	balance,
	isLoadingQuote,
	quote,
	onContinue,
	disableContinue,
}) => {
	const [isExecuting, setIsExecuting] = React.useState(false);
	const [currentStep, setCurrentStep] = React.useState<string>("");
	const [stepStatuses, setStepStatuses] = React.useState<
		("pending" | "processing" | "success" | "failed")[]
	>(["pending", "pending", "pending"]);
	const { provider: web3AuthProvider, web3Auth } = useWeb3Auth();

	const minAmount = 0.001;
	const minUSDValue = 5;

	const handleUnifiedContinue = async () => {
		if (isExecuting) return;

		// Check minimum token amount
		if (parseFloat(amount) < minAmount) {
			toast.error(
				`Minimum amount is ${minAmount} ${
					selectedToken?.symbol || "tokens"
				}`,
				{
					style: { fontSize: 13, padding: "8px 16px", maxWidth: 320 },
				}
			);
			return;
		}

		// Check minimum USD value
		if (quote && selectedToken) {
			const usdValue = getFromTokenUSDValue(
				quote,
				selectedToken.decimals
			);

			if (usdValue !== null && usdValue < minUSDValue) {
				toast.error(
					`Minimum USD value is $${minUSDValue}. Current value: $${usdValue.toFixed(
						2
					)}`,
					{
						style: {
							fontSize: 13,
							padding: "8px 16px",
							maxWidth: 320,
						},
					}
				);
				return;
			}
		}
		setIsExecuting(true);
		setStepStatuses(["processing", "pending", "pending"]);
		try {
			if (selectedWallet === "phantom") {
				setCurrentStep("Executing LiFi bridge...");
				await executeFundsTransaction({
					quote,
					selectedWallet,
					updateStep: (step, status) => {
						setCurrentStep(`${step} (${status})`);
						if (
							step.includes("Transaction completed") &&
							status === "success"
						) {
							setStepStatuses([
								"success",
								"processing",
								"pending",
							]);
						} else if (status === "failed") {
							setStepStatuses(["failed", "pending", "pending"]);
						}
					},
					onSuccess: async () => {
						try {
							if (!web3Auth?.provider) {
								throw new Error(
									"Web3Auth provider not initialized"
								);
							}
							setStepStatuses([
								"success",
								"processing",
								"pending",
							]);
							setCurrentStep("Verifying Arbitrum ETH balance...");
							const web3RPC = new Web3RPC(web3Auth.provider);
							const address = await web3RPC.getAccounts();
							const provider = new ethers.BrowserProvider(
								web3Auth.provider
							);
							let attempts = 0;
							let ethBalance = BigInt(0);
							while (attempts < 60) {
								ethBalance = await provider.getBalance(address);
								setCurrentStep(
									`Verifying Arbitrum ETH balance... (${ethers.formatEther(
										ethBalance
									)} ETH)`
								);
								if (ethBalance > BigInt(0)) break;
								await new Promise((resolve) =>
									setTimeout(resolve, 5000)
								);
								attempts++;
							}
							if (ethBalance === BigInt(0)) {
								setStepStatuses([
									"success",
									"failed",
									"pending",
								]);
								throw new Error(
									"Timed out waiting for ETH balance on Arbitrum"
								);
							}
							setStepStatuses([
								"success",
								"success",
								"processing",
							]);
							setCurrentStep("Bridging and minting SkyUSD...");
							const ethToUse =
								(ethBalance * BigInt(90)) / BigInt(100);
							const signer = await provider.getSigner();
							await handleArbitrumETHtoSkynet(
								ethers.formatEther(ethToUse),
								address,
								(step, status) => {
									setCurrentStep(`${step} (${status})`);
									if (status === "success")
										setStepStatuses([
											"success",
											"success",
											"success",
										]);
									if (status === "failed")
										setStepStatuses([
											"success",
											"success",
											"failed",
										]);
								},
								web3Auth
							);
							toast.success(
								"sUSD purchased and bridged to Skynet!",
								{
									style: {
										fontSize: 13,
										padding: "8px 16px",
										maxWidth: 320,
									},
								}
							);
							setIsExecuting(false);
							onContinue();
						} catch (error) {
							setIsExecuting(false);
							setStepStatuses(["success", "success", "failed"]);
							toast.error("Failed to purchase/bridge SkyUSD");
						}
					},
					onError: (error) => {
						setIsExecuting(false);
						setStepStatuses(["failed", "pending", "pending"]);
						toast.error("Failed to purchase/bridge SkyUSD");
					},
					web3Auth: web3Auth,
					amount,
				});
			} else if (selectedWallet === "metamask") {
				setCurrentStep("Executing LiFi bridge...");
				setStepStatuses(["processing", "pending", "pending"]);
				if (!web3Auth?.provider) {
					throw new Error("Web3Auth provider not initialized");
				}
				const web3RPC = new Web3RPC(web3Auth.provider);
				const address = await web3RPC.getAccounts();
				try {
					await executeFundsTransaction({
						quote,
						selectedWallet,
						updateStep: (step, status) => {
							setCurrentStep(`${step} (${status})`);
							if (
								step.includes("LiFi bridge completed") &&
								status === "success"
							) {
								setStepStatuses([
									"success",
									"processing",
									"pending",
								]);
							} else if (status === "failed") {
								setStepStatuses([
									"failed",
									"pending",
									"pending",
								]);
							}
						},
						onSuccess: async () => {
							try {
								if (!web3Auth?.provider) {
									throw new Error(
										"Web3Auth provider not initialized"
									);
								}
								// Step 2: Waiting for ETH
								setStepStatuses([
									"success",
									"processing",
									"pending",
								]);
								setCurrentStep(
									"Verifying Arbitrum ETH balance..."
								);
								const provider = new ethers.BrowserProvider(
									web3Auth.provider
								);
								let attempts = 0;
								let ethBalance = BigInt(0);
								while (attempts < 60) {
									ethBalance = await provider.getBalance(
										address
									);
									setCurrentStep(
										`Verifying Arbitrum ETH balance... (${ethers.formatEther(
											ethBalance
										)} ETH)`
									);
									if (ethBalance > BigInt(0)) break;
									await new Promise((resolve) =>
										setTimeout(resolve, 5000)
									);
									attempts++;
								}
								if (ethBalance === BigInt(0)) {
									setStepStatuses([
										"success",
										"failed",
										"pending",
									]);
									throw new Error(
										"Timed out waiting for ETH balance on Arbitrum"
									);
								}
								setStepStatuses([
									"success",
									"success",
									"success",
								]);
								toast.success(
									"Bridge completed successfully!",
									{
										style: {
											fontSize: 13,
											padding: "8px 16px",
											maxWidth: 320,
										},
									}
								);
								setIsExecuting(false);
								onContinue();
							} catch (error) {
								setIsExecuting(false);
								setStepStatuses([
									"success",
									"success",
									"failed",
								]);
								toast.error(
									"Failed to verify ETH balance: " +
										(error instanceof Error
											? error.message
											: "Unknown error"),
									{
										style: {
											fontSize: 13,
											padding: "8px 16px",
											maxWidth: 320,
										},
									}
								);
							}
						},
						onError: (error) => {
							setIsExecuting(false);
							setStepStatuses(["failed", "pending", "pending"]);
							toast.error("Failed to purchase/bridge SkyUSD");
						},
						web3Auth: web3Auth,
						amount,
					});
				} catch (error) {
					setIsExecuting(false);
					setStepStatuses(["success", "success", "failed"]);
					toast.error("Failed to purchase/bridge SkyUSD");
				}
			} else {
				setIsExecuting(false);
				toast.error("Unsupported wallet", {
					style: { fontSize: 13, padding: "8px 16px", maxWidth: 320 },
				});
			}
		} catch (error) {
			setIsExecuting(false);
			setStepStatuses(["failed", "pending", "pending"]);
			toast.error("Failed to fetch quote", {
				style: { fontSize: 13, padding: "8px 16px", maxWidth: 320 },
			});
		}
	};

	return (
		<div className="bg-background text-foreground px-2">
			<h2 className="text-xl font-medium mb-6 text-center text-foreground">
				{selectedWallet === "phantom"
					? "Select Asset & Enter Amount"
					: "Select Chain, Asset & Enter Amount"}
			</h2>
			<div className="mb-6" />
			{selectedWallet !== "phantom" && (
				<Select
					onValueChange={(value) => {
						const chain = availableChains.find(
							(c) => c.id.toString() === value
						);
						if (chain) {
							handleChainSelect(chain);
						}
					}}
					disabled={isLoadingChains}
				>
					<SelectTrigger className="w-full h-12 bg-background border-border text-foreground">
						<SelectValue placeholder="Search or select a chain..." />
					</SelectTrigger>
					<SelectContent className="bg-background border-border">
						{availableChains.map((chain) => (
							<SelectItem
								key={chain.id}
								value={chain.id.toString()}
								className="text-foreground hover:bg-muted cursor-pointer"
							>
								<div className="flex items-center gap-2.5">
									{chain.logoURI ? (
										<Image
											src={chain.logoURI}
											alt={chain.name}
											width={24}
											height={24}
											className="rounded-md"
										/>
									) : (
										<div className="w-6 h-6 bg-muted rounded-md flex items-center justify-center text-xs font-medium">
											{chain.name.slice(0, 2)}
										</div>
									)}
									<span>{chain.name}</span>
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
			<div className="my-6" />
			<Select
				onValueChange={(value) => {
					const token = availableTokens.find(
						(t) => t.address === value
					);
					if (token) {
						handleTokenSelect(token);
					}
				}}
				disabled={
					(selectedWallet !== "phantom" && !selectedChain) ||
					isLoadingTokens ||
					availableTokens.length === 0
				}
				value={selectedToken?.address || ""}
			>
				<SelectTrigger className="w-full h-12 bg-background border-border text-foreground mb-[18px]">
					<SelectValue
						placeholder={
							selectedWallet === "phantom"
								? isLoadingTokens
									? "Loading tokens..."
									: "Search or select a token..."
								: selectedChain
								? isLoadingTokens
									? "Loading tokens..."
									: "Search or select a token..."
								: "Select a chain first"
						}
					/>
				</SelectTrigger>
				<SelectContent className="bg-background border-border">
					{availableTokens.map((token) => (
						<SelectItem
							key={token.address}
							value={token.address}
							className="text-foreground hover:bg-muted cursor-pointer"
						>
							<div className="flex items-center gap-2.5">
								{token.logoURI ? (
									<Image
										src={token.logoURI}
										alt={token.symbol}
										width={24}
										height={24}
										className="rounded-md"
									/>
								) : (
									<div className="w-6 h-6 bg-muted rounded-md flex items-center justify-center text-xs font-medium">
										{token.symbol.slice(0, 2)}
									</div>
								)}
								<span>{token.symbol}</span>
								<span className="text-muted-foreground text-xs ml-2">
									{token.name}
								</span>
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{/* BAL (balance) above input, right-aligned, with extra spacing from token select */}
			{balance && selectedToken && (
				<div className="flex justify-end items-center mt-7 mb-4 min-h-[18px]">
					<span className="text-muted-foreground text-xs font-medium">
						BAL: {balance} {selectedToken.symbol}
					</span>
				</div>
			)}
			<div className="relative mb-[18px]">
				<Input
					type="number"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
					placeholder="Enter amount"
					className="w-full pr-28 text-lg h-12"
					disabled={!selectedToken}
				/>
				{/* Conversion price inside input (right-aligned) */}
				<div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm pointer-events-none bg-background/95 px-2 py-0.5 rounded-md font-medium">
					{(() => {
						if (!quote || !selectedToken) return "";
						const usdValue = getFromTokenUSDValue(
							quote,
							selectedToken.decimals
						);
						return usdValue !== null
							? `$${usdValue.toFixed(2)}`
							: "";
					})()}
				</div>
			</div>
			{/* Minimum requirement indicator */}
			{selectedToken && (
				<div className="flex justify-between items-center mb-2 px-1">
					<span className="text-muted-foreground text-xs">
						{(() => {
							// Calculate minimum amount in selected token using quote data
							if (quote?.action?.fromToken?.priceUSD) {
								const tokenPrice =
									quote.action.fromToken.priceUSD;
								const minTokenAmount = (5 / tokenPrice).toFixed(
									6
								);
								return `Minimum: ${minTokenAmount} ${selectedToken.symbol} (≈$5.00 USD)`;
							}
							// Fallback when quote is not available yet
							return `Minimum: $5.00 USD (enter amount to see minimum in ${selectedToken.symbol})`;
						})()}
					</span>
					{quote &&
						!isExecuting &&
						(() => {
							const usdValue = getFromTokenUSDValue(
								quote,
								selectedToken.decimals
							);

							if (usdValue !== null) {
								const isBelowMinimum = usdValue < 5;

								return (
									<span
										className={`text-xs font-medium ${
											isBelowMinimum
												? "text-red-500"
												: "text-green-500"
										}`}
									>
										{isBelowMinimum
											? "Below minimum"
											: "Meets minimum"}
									</span>
								);
							}
							return null;
						})()}
				</div>
			)}
			{/* Info bar below input, only if quote and not executing */}
			{quote && !isExecuting && (
				<div className="flex items-center justify-between bg-transparent pt-2.5 pb-0 px-0.5 text-base font-medium text-muted-foreground">
					{/* Left: You'll Receive */}
					<span className="text-foreground font-semibold">
						You'll Receive:{" "}
						{quote.estimate?.toAmountUSD
							? `$${Number(quote.estimate.toAmountUSD).toFixed(
									2
							  )}`
							: "N/A"}
					</span>
					{/* Right: Gas icon and fees */}
					<span className="flex items-center gap-1.5 text-foreground font-semibold">
						<Fuel size={20} />
						{(() => {
							// Market value (input token × input price)
							const marketValue = selectedToken
								? getFromTokenUSDValue(
										quote,
										selectedToken.decimals
								  )
								: null;
							const received = quote.estimate?.toAmountUSD
								? Number(quote.estimate.toAmountUSD)
								: null;
							const diff =
								marketValue && received
									? marketValue - received
									: null;
							return diff !== null
								? `$${diff.toFixed(2)} fees`
								: "N/A";
						})()}
					</span>
				</div>
			)}
			<div className="flex items-center justify-between mt-1" />
			{/* Show TransactionStepper only when executing */}
			{isExecuting && <TransactionStepper statuses={stepStatuses} />}
			<Button
				className="w-full mt-3 h-10 text-base rounded-lg text-foreground"
				variant="outline"
				onClick={handleUnifiedContinue}
				disabled={disableContinue || isExecuting || isLoadingQuote}
			>
				{isLoadingQuote
					? "Fetching quote..."
					: isExecuting
					? "Processing..."
					: "Transfer"}
			</Button>
		</div>
	);
};

export default FundsChainStep;
