"use client";
import { FC, useState, useEffect } from "react";
import {
	getChains,
	type Chain as LifiChain,
	type EVMChain,
	getQuote,
	ChainId,
	createConfig,
	Solana as LiFiSolana,
} from "@lifi/sdk";
import {
	WalletProviderFactory,
	WalletType,
} from "@/providers/add-funds/WalletProvider";
import { ethers } from "ethers";
import { EVMWalletProvider, SolanaWalletProvider } from "@/types/wallet";
import { toast } from "sonner";
import { useWeb3AuthSafe } from "@/providers/Web3AuthProvider";
import { Web3RPC } from "@/utils/rpc/web3RPC";
import { isAmountInvalid } from "@/utils/funds/funds";
import FundsWalletStep from "./funds-wallet-step";
import FundsChainStep from "./funds-chain-step";
import {
	fetchTokenBalance,
	fetchQuote,
	fetchTokensFromLifi,
} from "@/controllers/funds/funds.query";
import { TransactionSuccessMessage } from "./transaction-message";
import { Button } from "@/components/ui/button";
import { Landmark, WalletCards } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface FundsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

type Step =
	| "choose-method"
	| "choose-wallet"
	| "choose-chain"
	| "choose-asset"
	| "amount"
	| "actions";

interface Token {
	symbol: string;
	name: string;
	logoURI?: string;
	address: string;
	decimals: number;
	chainId?: number | string;
}

interface Chain {
	id: number | string;
	name: string;
	logoURI?: string;
}

const EVM_CHAIN_PARAMS: Record<number, any> = {
	1: {
		chainId: "0x1",
		chainName: "Ethereum Mainnet",
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
		rpcUrls: ["https://rpc.ankr.com/eth"],
		blockExplorerUrls: ["https://etherscan.io"],
	},
	42161: {
		chainId: "0xa4b1",
		chainName: "Arbitrum One",
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
		rpcUrls: ["https://arb1.arbitrum.io/rpc"],
		blockExplorerUrls: ["https://arbiscan.io"],
	},
	10: {
		chainId: "0xa",
		chainName: "Optimism",
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
		rpcUrls: ["https://mainnet.optimism.io"],
		blockExplorerUrls: ["https://optimistic.etherscan.io"],
	},
	8453: {
		chainId: "0x2105",
		chainName: "Base",
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
		rpcUrls: ["https://mainnet.base.org"],
		blockExplorerUrls: ["https://basescan.org"],
	},
	137: {
		chainId: "0x89",
		chainName: "Polygon",
		nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
		rpcUrls: ["https://polygon-rpc.com"],
		blockExplorerUrls: ["https://polygonscan.com"],
	},
};

const SUPPORTED_TOKEN_SYMBOLS: Record<number, string[]> = {
	1: ["USDC", "USDT", "ETH", "WBTC"], // Ethereum
	42161: ["USDC", "USDT", "ETH", "ARB", "USDC.e"], // Arbitrum
	10: ["USDC", "USDT", "ETH", "OP"], // Optimism
	8453: ["USDC", "USDT", "ETH"], // Base
	137: ["USDC", "USDT", "MATIC", "WBTC"], // Polygon
};

const SOLANA_SUPPORTED_TOKENS = ["USDC", "USDT", "SOL"];

const FundsModal: FC<FundsModalProps> = ({ isOpen, onClose }) => {
	const [step, setStep] = useState<Step>("choose-method");
	const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(
		null
	);
	const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
	const [selectedToken, setSelectedToken] = useState<Token | null>(null);
	const [availableChains, setAvailableChains] = useState<Chain[]>([]);
	const [isLoadingChains, setIsLoadingChains] = useState(true);
	const [availableTokens, setAvailableTokens] = useState<Token[]>([]);
	const [isLoadingTokens, setIsLoadingTokens] = useState(false);
	const [amount, setAmount] = useState("");
	const [balance, setBalance] = useState<string | null>(null);
	const [quote, setQuote] = useState<any>(null);
	const [isLoadingQuote, setIsLoadingQuote] = useState(false);
	const { provider: web3AuthProvider } = useWeb3AuthSafe();
	const [evmAddress, setEvmAddress] = useState<string | null>(null);
	const [transactionSuccess, setTransactionSuccess] = useState(false);
	const [quoteError, setQuoteError] = useState<string | null>(null);

	// Function to reset all state when going back to wallet selection
	const resetState = () => {
		setSelectedChain(null);
		setSelectedToken(null);
		setAvailableTokens([]);
		setAmount("");
		setBalance(null);
		setQuote(null);
		setIsLoadingQuote(false);
		setIsLoadingTokens(false);
	};

	// Reset state when dialog opens
	useEffect(() => {
		if (isOpen) {
			resetState();
			setSelectedWallet(null);
			setStep("choose-method");
			setTransactionSuccess(false);
		}
	}, [isOpen]);

	useEffect(() => {
		const fetchChains = async () => {
			try {
				setIsLoadingChains(true);
				const chains = await getChains();
				console.log(
					"Chain structure:",
					JSON.stringify(chains[0], null, 2)
				);

				// Define supported chain IDs
				const supportedChainIds = [
					1, // Ethereum
					42161, // Arbitrum
					10, // Optimism
					8453, // Base
					137, // Polygon
				];

				// Filter chains to only include supported ones
				let filteredChains = chains
					.filter((chain) =>
						supportedChainIds.includes(Number(chain.id))
					)
					.sort((a, b) => a.name.localeCompare(b.name))
					.map(
						(chain: any): Chain => ({
							id: chain.id,
							name: chain.name,
							logoURI: chain.logoURI,
						})
					);

				// Only add Solana if Phantom wallet is selected
				if (
					selectedWallet === "phantom" &&
					!filteredChains.some((chain) => chain.id === "SOL")
				) {
					filteredChains.push({
						id: "SOL",
						name: "Solana",
						logoURI:
							"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/solana.svg",
					});
				}
				setAvailableChains(filteredChains);
			} catch (error) {
				console.error("Error fetching chains:", error);
			} finally {
				setIsLoadingChains(false);
			}
		};

		fetchChains();
	}, [selectedWallet]);

	useEffect(() => {
		const fetchEvmAddress = async () => {
			if (web3AuthProvider) {
				const web3RPC = new Web3RPC(web3AuthProvider);
				const address = await web3RPC.getAccounts();
				setEvmAddress(address);
			}
		};
		fetchEvmAddress();
	}, [web3AuthProvider]);

	const handleWalletSelect = async (wallet: WalletType) => {
		try {
			// Reset state when selecting a new wallet
			resetState();
			console.log("Attempting to connect to wallet:", wallet);

			if (wallet === "metamask") {
				if (typeof window === "undefined") {
					throw new Error("Window is not defined");
				}

				if (!window.ethereum) {
					throw new Error(
						"MetaMask is not installed. Please install MetaMask to continue."
					);
				}

				if (!window.ethereum.isMetaMask) {
					throw new Error(
						"MetaMask is not detected. Please make sure MetaMask is installed and enabled."
					);
				}

				console.log("MetaMask detected, proceeding with connection...");
			} else if (wallet === "phantom") {
				if (typeof window === "undefined") {
					throw new Error("Window is not defined");
				}

				if (!window.phantom?.solana) {
					throw new Error(
						"Phantom wallet is not installed. Please install Phantom to continue."
					);
				}

				console.log("Phantom detected, proceeding with connection...");
			}

			console.log("Connecting to wallet...");
			await WalletProviderFactory.connect(wallet);
			console.log("Successfully connected to wallet:", wallet);

			// --- LiFi SDK provider initialization ---
			if (wallet === "metamask") {
				const provider = WalletProviderFactory.getProvider(
					"metamask"
				) as EVMWalletProvider;
				const ethersProvider = provider.getProvider();
				const signer = await provider.getSigner();
				const address = await signer.getAddress();
				createConfig({
					integrator: "skynet",
					providers: [
						{
							type: "evm",
							getProvider: async () => ethersProvider,
							getAccount: async () => address,
							getSigner: async () => signer,
							isAddress: (address: string) =>
								ethers.isAddress(address),
						} as any,
					],
				});
				setEvmAddress(address);
				setSelectedWallet(wallet);
				setStep("choose-chain");
			} else if (wallet === "phantom") {
				const provider = WalletProviderFactory.getProvider(
					"phantom"
				) as SolanaWalletProvider;
				const solAddr = await provider.getAddress();
				// LiFi Solana provider setup
				createConfig({
					integrator: "skynet",
					providers: [
						LiFiSolana({
							getWalletAdapter: async () =>
								provider.getProvider(),
						}),
					],
				});
				setSelectedWallet(wallet);
				// For Phantom, automatically select Solana chain
				let solanaChain = availableChains.find(
					(chain) =>
						chain.id === "SOL" ||
						chain.name.toLowerCase().includes("solana")
				);
				if (!solanaChain) {
					solanaChain = {
						id: "SOL",
						name: "Solana",
						logoURI:
							"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/solana.svg",
					};
					setAvailableChains((prev) => [...prev, solanaChain!]);
				}
				await handleChainSelect(solanaChain, "phantom");
				setStep("choose-chain");
			}
		} catch (error: any) {
			console.error("Failed to connect wallet:", error);
			let errorMessage = "Failed to connect wallet. ";

			if (error.message.includes("MetaMask is not installed")) {
				errorMessage =
					"MetaMask is not installed. Please install MetaMask to continue.";
			} else if (error.message.includes("MetaMask is not detected")) {
				errorMessage =
					"MetaMask is not detected. Please make sure MetaMask is installed and enabled.";
			} else if (
				error.message.includes("Phantom wallet is not installed")
			) {
				errorMessage =
					"Phantom wallet is not installed. Please install Phantom to continue.";
			} else if (error.message.includes("User denied")) {
				errorMessage =
					"Connection was rejected. Please approve the connection request.";
			} else if (error.message.includes("Already processing")) {
				errorMessage =
					"A connection request is already pending. Please check your wallet.";
			} else if (error.message.includes("Solana chain not found")) {
				errorMessage =
					"Failed to initialize Solana chain. Please try again.";
			}

			toast.error(errorMessage);
		}
	};

	const handleChainSelect = async (chain: Chain, walletType?: WalletType) => {
		console.log("handleChainSelect called with:", chain);
		const wallet = walletType || selectedWallet;

		if (
			wallet === "metamask" &&
			typeof chain.id === "number" &&
			window.ethereum
		) {
			const params = EVM_CHAIN_PARAMS[chain.id];
			if (!params) {
				toast.error("Unsupported chain for MetaMask switching");
				return;
			}
			try {
				// Switch chain in MetaMask
				await window.ethereum.request?.({
					method: "wallet_switchEthereumChain",
					params: [{ chainId: params.chainId }],
				});
			} catch (switchError: any) {
				// This error code indicates that the chain has not been added to MetaMask
				if (switchError.code === 4902) {
					try {
						// Add the chain to MetaMask
						await window.ethereum.request?.({
							method: "wallet_addEthereumChain",
							params: [params],
						});
					} catch (addError) {
						console.error(
							"Error adding chain to MetaMask:",
							addError
						);
						toast.error("Failed to add chain to MetaMask");
						return;
					}
				} else {
					console.error("Error switching chain:", switchError);
					toast.error("Failed to switch chain in MetaMask");
					return;
				}
			}
		}

		setSelectedChain(chain);
		// Reset token-related state when chain changes
		setSelectedToken(null);
		setAmount("");
		setBalance(null);
		setQuote(null);
		setIsLoadingTokens(true);
		try {
			let tokens: Token[] = [];
			if (wallet === "metamask" && typeof chain.id === "number") {
				// Existing MetaMask token fetching
				const lifiTokens = await fetchTokensFromLifi(chain.id);
				const supportedSymbols =
					SUPPORTED_TOKEN_SYMBOLS[chain.id] || [];
				tokens = (lifiTokens as any[])
					.filter((token: any) =>
						supportedSymbols.includes(token.symbol)
					)
					.map((token: any) => ({ ...token, chainId: chain.id }));
			} else if (wallet === "phantom") {
				// Canonical Solana tokens
				const canonicalSolanaTokens = [
					{
						address: "11111111111111111111111111111111",
						symbol: "SOL",
						name: "Solana",
						decimals: 9,
						logoURI:
							"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
						chainId: "SOL",
					},
					{
						address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
						symbol: "USDC",
						name: "USD Coin",
						decimals: 6,
						logoURI:
							"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
						chainId: "SOL",
					},
					{
						address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
						symbol: "USDT",
						name: "Tether USD",
						decimals: 6,
						logoURI:
							"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
						chainId: "SOL",
					},
				];
				tokens = canonicalSolanaTokens;
			}
			setAvailableTokens(tokens);
		} catch (e) {
			console.error("Error fetching tokens:", e);
			setAvailableTokens([]);
		} finally {
			setIsLoadingTokens(false);
		}
	};

	const handleTokenSelect = async (token: Token) => {
		console.log("Token selected:", token);
		setSelectedToken(token);
		setAmount("");
		setBalance(null);
		setQuote(null);
		await fetchTokenBalance({
			selectedWallet,
			token,
			setBalance,
		});
		// setStep("amount"); // Removed to keep everything on the same page
	};

	useEffect(() => {
		if (amount && selectedToken && selectedChain && selectedWallet) {
			const timeoutId = setTimeout(() => {
				fetchQuote({
					selectedToken,
					selectedChain,
					amount,
					selectedWallet,
					evmAddress,
					setIsLoadingQuote,
					setQuote,
				});
			}, 500); // Debounce for 500ms

			return () => clearTimeout(timeoutId);
		}
	}, [amount, selectedToken, selectedChain, selectedWallet]);

	// Clear quote error when a new fetch starts or quote arrives
	useEffect(() => {
		if (isLoadingQuote || quote) {
			setQuoteError(null);
		}
	}, [
		isLoadingQuote,
		quote,
		amount,
		selectedToken,
		selectedChain,
		selectedWallet,
	]);

	// Delayed error toast for quote fetch failures
	useEffect(() => {
		if (
			!isLoadingQuote &&
			!quote &&
			amount &&
			selectedToken &&
			selectedChain &&
			selectedWallet
		) {
			const timer = setTimeout(() => {
				if (!isLoadingQuote && !quote) {
					if (!quoteError) {
						toast.error("Failed to fetch quote");
						setQuoteError("Failed to fetch quote");
					}
				}
			}, 1000); // 1 second delay
			return () => clearTimeout(timer);
		}
	}, [
		isLoadingQuote,
		quote,
		amount,
		selectedToken,
		selectedChain,
		selectedWallet,
		quoteError,
	]);

	const handleBack = () => {
		if (selectedWallet) {
			WalletProviderFactory.disconnect(selectedWallet);
		}
		if (step === "actions") setStep("choose-asset");
		else if (step === "choose-asset") {
			if (selectedWallet === "metamask") {
				setStep("choose-chain");
			} else {
				setStep("choose-wallet");
			}
		} else if (step === "choose-chain") {
			// Reset state when going back to wallet selection
			resetState();
			setStep("choose-wallet");
		} else if (step === "choose-wallet") {
			// Reset state when going back to method selection
			resetState();
			setSelectedWallet(null);
			setStep("choose-method");
		}
	};

	const renderContent = () => {
		switch (step) {
			case "choose-method":
				return (
					<div className="wallet_balance_modal_content px-2">
						<div className="h-8" />
						<div className="flex flex-col gap-4 w-full">
							<Button
								variant="outline"
								className="w-full rounded-xl py-3 flex items-center gap-2 font-medium text-lg mb-2 h-14"
								onClick={() => setStep("choose-wallet")}
								size={"lg"}
							>
								<WalletCards className=" opacity-50 text-foreground" />
								Crypto
							</Button>
							<Button
								variant="outline"
								className="w-full rounded-xl py-3 flex items-center gap-2 font-medium text-lg h-14"
								onClick={() => alert("Fiat coming soon!")}
								size={"lg"}
							>
								<Landmark className=" opacity-50" size={24} />
								Fiat (Coming Soon)
							</Button>
						</div>
						<div className="h-6" />
					</div>
				);
			case "choose-wallet":
				return (
					<FundsWalletStep
						onSelect={(wallet) =>
							handleWalletSelect(wallet as WalletType)
						}
					/>
				);
			case "choose-chain":
				return (
					<FundsChainStep
						availableChains={availableChains}
						availableTokens={availableTokens}
						selectedWallet={selectedWallet}
						isLoadingChains={isLoadingChains}
						isLoadingTokens={isLoadingTokens}
						selectedChain={selectedChain}
						handleChainSelect={handleChainSelect}
						handleTokenSelect={handleTokenSelect}
						selectedToken={selectedToken}
						amount={amount}
						setAmount={setAmount}
						balance={balance}
						isLoadingQuote={isLoadingQuote}
						quote={quote}
						onContinue={() => setTransactionSuccess(true)}
						disableContinue={(() => {
							const noToken = !selectedToken;
							const noQuote = !quote;
							const loading = isLoadingQuote;
							const invalidAmount = isAmountInvalid(
								amount,
								balance,
								quote,
								selectedToken?.decimals
							);

							console.log("🔍 disableContinue debug:", {
								noToken,
								noQuote,
								loading,
								invalidAmount,
								amount,
								selectedToken: selectedToken?.symbol,
								hasQuote: !!quote,
							});

							return (
								noToken || noQuote || loading || invalidAmount
							);
						})()}
					/>
				);
			default:
				return null;
		}
	};

	const handleClose = () => {
		resetState();
		setSelectedWallet(null);
		setStep("choose-method");
		setTransactionSuccess(false);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="add_funds_modal max-w-md min-w-[340px] w-full bg-background text-foreground border-[1.5px] border-[#2a2c2f] rounded-xl shadow-[0px_18px_24px_-12px_rgba(0,0,0,0.73)] p-5">
				{transactionSuccess ? (
					<TransactionSuccessMessage onClose={handleClose} />
				) : (
					<>
						<DialogHeader className="mb-4">
							<DialogTitle className="f-size-p2 f-weight-500 mx-auto font-semibold text-xl m-0">
								Add Funds
							</DialogTitle>
						</DialogHeader>
						<div className="modal_body">
							{step !== "choose-method" &&
								!transactionSuccess && (
									<Button
										variant="outline"
										className="mb-3 back-btn text-sm px-4 py-1 min-w-0 h-8 rounded-lg shadow-none font-normal"
										onClick={handleBack}
									>
										<p className="text-sm font-medium">
											← Back
										</p>
									</Button>
								)}
							{renderContent()}
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default FundsModal;
