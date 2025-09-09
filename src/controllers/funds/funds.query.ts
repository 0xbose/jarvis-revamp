import { ethers } from "ethers";
import {
	WalletProviderFactory,
	WalletType,
} from "@/providers/add-funds/WalletProvider";
import {
	EVMWalletProvider,
	SolanaWalletProvider,
} from "@/types/wallet";
import { PublicKey } from "@solana/web3.js";
import { getQuote, ChainId } from "@lifi/sdk";

export async function fetchTokenBalance({
	selectedWallet,
	token,
	setBalance,
}: {
	selectedWallet: WalletType | null;
	token: any;
	setBalance: (b: string) => void;
}) {
	if (!selectedWallet || !token) return;
	try {
		const provider = WalletProviderFactory.getProvider(selectedWallet);
		if (selectedWallet === "metamask") {
			const evmProvider = provider as EVMWalletProvider;
			const signer = await evmProvider.getSigner();
			const ethersProvider = evmProvider.getProvider();
			const address = await signer.getAddress();
			console.log(
				"Fetching balance for address:",
				address,
				"on provider:",
				ethersProvider,
				"token:",
				token.address
			);
			if (
				token.address ===
					"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" ||
				token.address === "0x0000000000000000000000000000000000000000"
			) {
				const balance = await ethersProvider.getBalance(address);
				setBalance(ethers.formatEther(balance));
			} else {
				const contract = new ethers.Contract(
					token.address,
					["function balanceOf(address) view returns (uint256)"],
					ethersProvider
				);
				const balance = await contract.balanceOf(address);
				setBalance(ethers.formatUnits(balance, token.decimals));
			}
		} else if (selectedWallet === "phantom") {
			const solanaProvider = provider as SolanaWalletProvider;
			if (
				token.address === "native" ||
				token.address === "11111111111111111111111111111111"
			) {
				const balance = await solanaProvider.getBalance();
				setBalance(balance);
			} else {
				const publicKey = await solanaProvider.getPublicKey();
				const connection = solanaProvider.getConnection();
				const tokenAccounts =
					await connection.getParsedTokenAccountsByOwner(publicKey, {
						mint: new PublicKey(token.address),
					});
				if (tokenAccounts.value.length > 0) {
					const balance =
						tokenAccounts.value[0].account.data.parsed.info
							.tokenAmount.uiAmount;
					setBalance(balance.toString());
				} else {
					setBalance("0");
				}
			}
		}
	} catch (error) {
		setBalance("0");
	}
}

export async function fetchQuote({
	selectedToken,
	selectedChain,
	amount,
	selectedWallet,
	evmAddress,
	setIsLoadingQuote,
	setQuote,
}: {
	selectedToken: any;
	selectedChain: any;
	amount: string;
	selectedWallet: WalletType | null;
	evmAddress: string | null;
	setIsLoadingQuote: (b: boolean) => void;
	setQuote: (q: any) => void;
}) {
	if (!selectedToken || !selectedChain || !amount || !selectedWallet) {
		return;
	}
	setIsLoadingQuote(true);
	try {
		const provider = WalletProviderFactory.getProvider(selectedWallet);
		let fromAddress: string;
		let destinationEthAddress = evmAddress;
		if (selectedWallet === "metamask") {
			const evmProvider = provider as EVMWalletProvider;
			const signer = await evmProvider.getSigner();
			const ethersProvider = evmProvider.getProvider();
			fromAddress = await signer.getAddress();
			destinationEthAddress = fromAddress;
		} else if (selectedWallet === "phantom") {
			const solanaProvider = provider as SolanaWalletProvider;
			fromAddress = await solanaProvider.getAddress();
		} else {
			throw new Error("Unsupported wallet type");
		}
		if (!destinationEthAddress) {
			throw new Error(
				"ETH address is required for bridging to Arbitrum. Please log in with Web3Auth."
			);
		}
		const fromAmount = ethers
			.parseUnits(amount, selectedToken.decimals)
			.toString();
		const quoteParams = {
			fromChain:
				selectedChain.id === "SOL"
					? ChainId.SOL
					: Number(selectedChain.id),
			fromToken: selectedToken.address,
			fromAmount: fromAmount,
			fromAddress: fromAddress,
			toChain: ChainId.ARB,
			toToken: "0x0000000000000000000000000000000000000000",
			toAddress: destinationEthAddress,
			slippage: 0.03,
		};
		const quote = await getQuote(quoteParams);
		if (!quote) {
			throw new Error("Failed to get quote");
		}
		setQuote(quote);
	} catch (error) {
	} finally {
		setIsLoadingQuote(false);
	}
}

export async function fetchTokensFromLifi(chainId: number | string) {
	const res = await fetch(`https://li.quest/v1/tokens?chains=${chainId}`);
	const data = await res.json();
	return data.tokens[chainId] || [];
}
