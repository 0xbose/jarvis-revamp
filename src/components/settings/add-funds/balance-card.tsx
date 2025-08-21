"use client";

import { HTMLAttributes, useState, useContext } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Web3Context, isConnectedState } from "@/providers/Web3ContextProvider";
import { useWeb3AuthSafe } from "@/providers/Web3AuthProvider";
import { ethers } from "ethers";
import { Wallet, Send, X } from "lucide-react";
import FundsModal from "./funds-dialog";

interface IProps extends HTMLAttributes<HTMLDivElement> {
	title: string;
	amount: number;
	patternImgUrl: string;
	onClick?: () => void;
	style?: React.CSSProperties;
}

interface SendFundsModalProps {
	isOpen: boolean;
	onClose: () => void;
	currentBalance: number;
}

const SendFundsModal = ({
	isOpen,
	onClose,
	currentBalance,
}: SendFundsModalProps) => {
	const [address, setAddress] = useState("");
	const [amount, setAmount] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [addressError, setAddressError] = useState("");
	const [amountError, setAmountError] = useState("");
	const [transactionSuccess, setTransactionSuccess] = useState(false);
	const [transactionHash, setTransactionHash] = useState("");
	const { provider, web3Auth } = useWeb3AuthSafe();
	const web3Context = useContext(Web3Context);

	const handleMaxClick = () => {
		setAmount(currentBalance.toString());
		setAmountError("");
	};

	// Validate Ethereum address
	const validateAddress = (address: string) => {
		// Clear previous errors
		setAddressError("");

		// Check if empty
		if (!address.trim()) {
			setAddressError("Address is required");
			return false;
		}

		// Check if it's a valid Ethereum address format
		if (!address.startsWith("0x") || address.length !== 42) {
			setAddressError("Invalid Ethereum address format");
			return false;
		}

		// Additional check using ethers.js
		try {
			ethers.getAddress(address); // This will normalize and validate the address
			return true;
		} catch (error) {
			setAddressError("Invalid Ethereum address");
			return false;
		}
	};

	// Validate amount
	const validateAmount = (value: string) => {
		setAmountError("");

		if (!value.trim()) {
			setAmountError("Amount is required");
			return false;
		}

		const numValue = parseFloat(value);

		if (isNaN(numValue) || numValue <= 0) {
			setAmountError("Amount must be greater than 0");
			return false;
		}

		if (numValue > currentBalance) {
			setAmountError("Amount exceeds your balance");
			return false;
		}

		return true;
	};

	const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newAddress = e.target.value;
		setAddress(newAddress);

		// Only validate if there's some input
		if (newAddress.trim()) {
			validateAddress(newAddress);
		} else {
			setAddressError("");
		}
	};

	const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newAmount = e.target.value;
		setAmount(newAmount);

		if (newAmount.trim()) {
			validateAmount(newAmount);
		} else {
			setAmountError("");
		}
	};

	const resetForm = () => {
		setAddress("");
		setAmount("");
		setAddressError("");
		setAmountError("");
		setTransactionSuccess(false);
		setTransactionHash("");
		setIsLoading(false);
	};

	const handleSend = async () => {
		if (!isConnectedState(web3Context) || !provider || !web3Auth?.provider)
			return;

		// Validate inputs before sending
		const isAddressValid = validateAddress(address);
		const isAmountValid = validateAmount(amount);

		if (!isAddressValid || !isAmountValid) {
			return;
		}

		try {
			setIsLoading(true);

			// Switch to Skynet chain
			// await switchToSkynet(web3Auth);

			// Create provider and signer
			const ethersProvider = new ethers.BrowserProvider(provider);
			const signer = await ethersProvider.getSigner();

			// Send transaction
			const tx = await signer.sendTransaction({
				to: address,
				value: ethers.parseEther(amount),
			});

			// Display transaction hash immediately, but show as pending
			setTransactionHash(tx.hash);

			// Wait for transaction confirmation
			const receipt = await tx.wait();

			if (receipt?.status === 0) {
				throw new Error("Transaction failed during processing");
			}

			setTransactionSuccess(true);
		} catch (error) {
			console.error("Error sending funds:", error);

			// Handle different types of errors with user-friendly messages
			if (error instanceof Error) {
				if (error.message.includes("user rejected")) {
					setAddressError("Transaction was rejected by the user");
				} else if (error.message.includes("insufficient funds")) {
					setAmountError(
						"Insufficient funds for this transaction (remember to include gas fees)"
					);
				} else if (error.message.includes("gas")) {
					setAddressError(
						"Gas estimation failed. Try reducing the amount to cover gas fees."
					);
				} else {
					setAddressError(
						`Transaction failed: ${error.message.substring(0, 100)}`
					);
				}
			} else {
				setAddressError("Transaction failed. Please try again.");
			}
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		resetForm();
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Send Funds</DialogTitle>
					<DialogClose asChild>
						<Button
							variant="ghost"
							size="icon"
							className="absolute right-4 top-4"
						></Button>
					</DialogClose>
				</DialogHeader>

				<div className="space-y-4">
					{transactionSuccess ? (
						<div className="text-center space-y-4">
							<div className="flex items-center justify-center">
								<svg
									width="48"
									height="48"
									viewBox="0 0 48 48"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<circle
										cx="24"
										cy="24"
										r="24"
										fill="#10B981"
										fillOpacity="0.1"
									/>
									<path
										d="M32 18L21 29L16 24"
										stroke="#10B981"
										strokeWidth="3"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</div>
							<h3 className="text-lg font-medium">
								Transaction Successful!
							</h3>
							<p className="text-muted-foreground">
								Your funds have been sent successfully.
							</p>

							{transactionHash && (
								<div className="space-y-2">
									<p className="text-sm text-muted-foreground">
										Transaction Hash:
									</p>
									<div className="p-2 bg-muted rounded text-xs font-mono break-all">
										{transactionHash}
									</div>
								</div>
							)}

							<Button onClick={handleClose} className="w-full">
								Close
							</Button>
						</div>
					) : (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="address">
									Recipient Address (Ethereum only)
								</Label>
								<Input
									id="address"
									type="text"
									value={address}
									onChange={handleAddressChange}
									placeholder="0x..."
									className={`font-mono text-sm ${
										addressError ? "border-red-500" : ""
									}`}
									disabled={isLoading}
								/>
								{addressError && (
									<p className="text-red-500 text-xs">
										{addressError}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<div className="flex justify-between items-center">
									<Label htmlFor="amount">Amount</Label>
									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">
											Balance: {currentBalance}
										</span>
										<Button
											variant="outline"
											size="sm"
											onClick={handleMaxClick}
											disabled={
												isLoading ||
												currentBalance === 0
											}
										>
											MAX
										</Button>
									</div>
								</div>
								<Input
									id="amount"
									type="number"
									value={amount}
									onChange={handleAmountChange}
									placeholder="0.0"
									className={
										amountError ? "border-red-500" : ""
									}
									disabled={isLoading}
									min="0"
									max={currentBalance.toString()}
									step="0.000001"
								/>
								{amountError && (
									<p className="text-red-500 text-xs">
										{amountError}
									</p>
								)}
							</div>

							<Button
								onClick={handleSend}
								disabled={
									isLoading ||
									!address ||
									!amount ||
									!!addressError ||
									!!amountError
								}
								className="w-full"
							>
								{isLoading ? "Processing..." : "Send"}
							</Button>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};

const BalanceCard = ({
	title,
	amount,
	patternImgUrl,
	onClick,
	...props
}: IProps) => {
	const [isAddFundsModalOpen, setIsAddFundsModalOpen] = useState(false);
	const [isSendModalOpen, setIsSendModalOpen] = useState(false);
	return (
		<>
			<div className="w-fit max-w-sm">
				<div className="bg-background text-foreground rounded-lg p-6 space-y-4 border border-gray">
					<div className="space-y-1">
						<h3 className="text-4xl font-bold tracking-tight">
							${amount.toFixed(4)}
						</h3>
						<p className="text-muted-foreground text-sm font-medium">
							{title}
						</p>
					</div>

					<div className="flex gap-2">
						<Button
							variant="outline"
							className="flex-1 bg-background text-foreground font-medium"
							onClick={() => setIsAddFundsModalOpen(true)}
						>
							<Wallet className="w-4 h-4 mr-2" />
							Add Funds
						</Button>

						<Button
							variant="outline"
							className="flex-1 bg-background text-foreground font-medium"
							onClick={() => setIsSendModalOpen(true)}
						>
							<Send className="w-4 h-4 mr-2" />
							Send
						</Button>
					</div>
				</div>
			</div>

			<FundsModal
				isOpen={isAddFundsModalOpen}
				onClose={() => setIsAddFundsModalOpen(false)}
			/>

			<SendFundsModal
				isOpen={isSendModalOpen}
				onClose={() => setIsSendModalOpen(false)}
				currentBalance={amount}
			/>
		</>
	);
};

export default BalanceCard;
