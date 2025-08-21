import { ethers } from "ethers";
import {
	type Chain as ViemChain,
	mainnet,
	arbitrum,
	base,
	optimism,
} from "viem/chains";
import { CHAIN_NAMESPACES } from "@web3auth/base";
import { web3AuthConfig } from "@/config/web3AuthConfig";
import { RPC_CONFIG } from "@/config/rpc-config";

// Constants
export const INBOX_ADDRESS = "0xaaa958976b2794bf6d87ab8d68a5909104c6a757";

export const RPC_URLS: Record<number, string> = {
	1: "https://eth-mainnet.g.alchemy.com/v2/2Xl0kiqyNVT5An-x05eclIgbpBMYVjAD", // Ethereum
	42161: "https://arb-mainnet.g.alchemy.com/v2/2Xl0kiqyNVT5An-x05eclIgbpBMYVjAD",
	8453: "https://base-mainnet.g.alchemy.com/v2/2Xl0kiqyNVT5An-x05eclIgbpBMYVjAD",
	10: "https://opt-mainnet.g.alchemy.com/v2/2Xl0kiqyNVT5An-x05eclIgbpBMYVjAD",
	1151111081099710: RPC_CONFIG.HELIUS_RPC_URL, // Solana ChainId
};

export const CHAIN_CONFIGS: Record<number, ViemChain> = {
	1: mainnet,
	42161: arbitrum,
	8453: base,
	10: optimism,
};

export const CHAIN_TYPE_MAP: Record<number, "testnet" | "mainnet"> = {
	1: "mainnet", // Ethereum
	42161: "mainnet", // Arbitrum
	8453: "mainnet", // Base
	10: "mainnet", // Optimism
};

// Interfaces
export interface TokenInfo {
	address: string;
	symbol: string;
	decimals: number;
	name: string;
	logoURI: string;
	priceUSD?: string;
	chainId?: number;
}

export interface Chain {
	id: number;
	name: string;
	key: string;
}

// Token Constants
export const SOLANA_TOKEN: TokenInfo = {
	address: "11111111111111111111111111111111",
	symbol: "SOL",
	decimals: 9,
	name: "Solana",
	logoURI:
		"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
};

export const SKYUSD_TOKEN: TokenInfo = {
	address: "0x411F8debb819DB8dAE3999310014f47c03FA4a68",
	symbol: "SkyUSD",
	decimals: 18,
	name: "SkyUSD",
	logoURI:
		"https://raw.githubusercontent.com/stackosofficial/node-docker-images/main/logos/skyusd.png",
};

export const NATIVE_TOKENS: Record<number, TokenInfo> = {
	1: {
		// Ethereum
		address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
		symbol: "ETH",
		decimals: 18,
		name: "Ethereum",
		logoURI:
			"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
	},
	42161: {
		// Arbitrum
		address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
		symbol: "ETH",
		decimals: 18,
		name: "Ethereum",
		logoURI:
			"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
	},
	10: {
		// Optimism
		address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
		symbol: "ETH",
		decimals: 18,
		name: "Ethereum",
		logoURI:
			"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
	},
	8453: {
		// Base
		address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
		symbol: "ETH",
		decimals: 18,
		name: "Ethereum",
		logoURI:
			"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
	},
	1151111081099710: {
		// Solana
		address: "11111111111111111111111111111111",
		symbol: "SOL",
		decimals: 9,
		name: "Solana",
		logoURI:
			"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
	},
};

// Add type definitions
type StepStatus = "pending" | "success" | "failed";
type UpdateStepFunction = (step: string, status: StepStatus) => void;

export const switchToArbitrum = async (web3Auth: any): Promise<void> => {
	console.log("Switching to Arbitrum network...");
	const chainConfig = {
		chainNamespace: CHAIN_NAMESPACES.EIP155,
		chainId: "0xa4b1",
		rpcTarget: RPC_URLS[42161],
		displayName: "Arbitrum One",
		blockExplorerUrl: "https://arbiscan.io",
		ticker: "ETH",
		tickerName: "Ethereum",
	};

	await web3Auth.addChain(chainConfig);
	await web3Auth.switchChain({ chainId: chainConfig.chainId });
	console.log("Successfully switched to Arbitrum");
	await new Promise((resolve) => setTimeout(resolve, 2000));
};

// Update switchToSkynet function with correct config
export const switchToSkynet = async (web3Auth: any): Promise<void> => {
	console.log("Switching to Skynet mainnet...");
	const chainConfig = web3AuthConfig.chainConfig;

	try {
		await web3Auth.addChain(chainConfig);
		await web3Auth.switchChain({ chainId: chainConfig.chainId });
		console.log("Successfully switched to Skynet mainnet");
		await new Promise((resolve) => setTimeout(resolve, 2000));
	} catch (error) {
		console.error("Error switching to Skynet:", error);
		throw error;
	}
};

// Update bridgeSkyUSDToSkynet function
export const bridgeSkyUSDToSkynet = async (
	signer: ethers.Signer,
	amount: string,
	web3Auth: any,
	gasParams: {
		maxFeePerGas: bigint;
		maxPriorityFeePerGas: bigint;
		gasLimit: bigint;
	}
) => {
	// Parse amount with proper decimals
	const skyusdAmount = ethers.parseUnits(amount, 18); // SkyUSD uses 18 decimals

	console.log("Starting bridge to Skynet with params:", {
		skyusdAmount: skyusdAmount.toString(),
		skyusdAddress: SKYUSD_TOKEN.address,
		inboxAddress: INBOX_ADDRESS,
		signerAddress: await signer.getAddress(),
	});

	// Initialize contracts
	const erc20ABI = [
		"function approve(address spender, uint256 amount) public returns (bool)",
		"function allowance(address owner, address spender) view returns (uint256)",
		"function balanceOf(address account) view returns (uint256)",
	];
	const skyusdContract = new ethers.Contract(
		SKYUSD_TOKEN.address,
		erc20ABI,
		signer
	);

	const inboxABI = [
		"function depositERC20(uint256 _amount) external",
		"function depositERC20AndBridge(uint256 _amount, uint256 _minOut) external",
	];
	const bridgeContract = new ethers.Contract(INBOX_ADDRESS, inboxABI, signer);

	// Check allowance
	const allowance = await skyusdContract.allowance(
		await signer.getAddress(),
		INBOX_ADDRESS
	);
	if (allowance < skyusdAmount) {
		console.log("Approving SkyUSD spend...");
		const approveTx = await skyusdContract.approve(
			INBOX_ADDRESS,
			skyusdAmount,
			{
				gasLimit: gasParams.gasLimit,
				maxFeePerGas: gasParams.maxFeePerGas,
				maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
			}
		);
		await approveTx.wait();
		console.log("SkyUSD spend approved");
	}

	// Bridge the tokens
	console.log("Bridging SkyUSD to Skynet...");
	const bridgeTx = await bridgeContract.depositERC20(skyusdAmount, {
		gasLimit: gasParams.gasLimit,
		maxFeePerGas: gasParams.maxFeePerGas,
		maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
	});
	await bridgeTx.wait();
	console.log("Bridge transaction completed");
};

export const handleArbitrumETHtoSkynet = async (
	amount: string,
	fromAddress: string,
	updateStep: UpdateStepFunction,
	web3Auth: any
): Promise<string> => {
	try {
		// Step 1: ARB ETH -> ARB SkyUSD
		updateStep("ARB ETH -> ARB SkyUSD", "pending");

		// Create provider and signer for Arbitrum
		const provider = web3Auth.provider;
		if (!provider) {
			throw new Error("Web3Auth provider not initialized");
		}

		// Make sure we're on Arbitrum
		await switchToArbitrum(web3Auth);
		await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for chain switch

		const ethersProvider = new ethers.BrowserProvider(provider);
		const signer = await ethersProvider.getSigner();

		// Parse the amount with proper decimals
		const ethAmount = ethers.parseEther(amount);
		console.log("Initial ETH amount:", ethers.formatEther(ethAmount));

		// Calculate gas for minting transaction
		const skynetMinterAddress =
			"0xf5440DEc20C1Bb23FC4040ABEFDC70aD964A7C0C";
		const skynetMinterABI = [
			"function buySkyUSDUsingNativeToken(address router, address weth, uint256 minAmount, uint256 deadline) external payable",
		];
		const skynetMinter = new ethers.Contract(
			skynetMinterAddress,
			skynetMinterABI,
			signer
		);

		// Estimate gas for minting transaction
		const mintGasEstimate =
			await skynetMinter.buySkyUSDUsingNativeToken.estimateGas(
				"0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // Uniswap router
				"0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH on Arbitrum
				0, // minAmount
				Math.floor(Date.now() / 1000) + 3600, // 1 hour deadline
				{ value: ethAmount }
			);

		// Estimate gas for bridge transaction using 0 SkyUSD tokens
		const bridgeContract = new ethers.Contract(
			INBOX_ADDRESS,
			["function depositERC20(uint256 _amount) external"],
			signer
		);
		const bridgeGasEstimate = await bridgeContract.depositERC20.estimateGas(
			BigInt(0) // Use 0 SkyUSD tokens for gas estimation
		);

		// Get current gas price with higher buffer
		const gasPrice = await ethersProvider.getFeeData();

		// For Arbitrum, we need to use a specific approach
		const baseGasPrice = gasPrice.gasPrice || BigInt(0);
		const maxFeePerGas = (baseGasPrice * BigInt(160)) / BigInt(100); // 1.6x buffer for Arbitrum
		const maxPriorityFeePerGas = maxFeePerGas / BigInt(10); // 10% of max fee, ensuring it's always less than max fee

		// Calculate total gas cost for both transactions with additional buffer
		const mintGasCost = mintGasEstimate * maxFeePerGas;
		const bridgeGasCost = bridgeGasEstimate * maxFeePerGas;
		const totalGasCost =
			((mintGasCost + bridgeGasCost) * BigInt(110)) / BigInt(100); // Add 10% buffer to total gas cost

		// Get user's balance
		const balance = await ethersProvider.getBalance(fromAddress);
		console.log("User balance:", ethers.formatEther(balance));
		console.log(
			"Base gas price:",
			ethers.formatUnits(baseGasPrice, "gwei"),
			"Gwei"
		);
		console.log(
			"Max fee per gas:",
			ethers.formatUnits(maxFeePerGas, "gwei"),
			"Gwei"
		);
		console.log(
			"Max priority fee per gas:",
			ethers.formatUnits(maxPriorityFeePerGas, "gwei"),
			"Gwei"
		);
		console.log("Mint gas cost:", ethers.formatEther(mintGasCost));
		console.log("Bridge gas cost:", ethers.formatEther(bridgeGasCost));
		console.log(
			"Total gas cost for both transactions:",
			ethers.formatEther(totalGasCost)
		);
		console.log("Mint gas limit:", mintGasEstimate.toString());
		console.log("Bridge gas limit:", bridgeGasEstimate.toString());

		// Calculate final amount after both gas costs
		const finalAmount = ethAmount - totalGasCost;
		console.log(
			"Final amount after both gas costs:",
			ethers.formatEther(finalAmount)
		);

		// Calculate total cost including both gas costs
		const totalCost = finalAmount + totalGasCost;
		console.log(
			"Total cost (value + both gas costs):",
			ethers.formatEther(totalCost)
		);
		console.log("Required balance:", ethers.formatEther(totalCost));
		console.log("Available balance:", ethers.formatEther(balance));

		// Check if user has enough balance for both transactions
		if (balance < totalCost) {
			throw new Error(
				`Insufficient balance. Required: ${ethers.formatEther(
					totalCost
				)} ETH, Available: ${ethers.formatEther(balance)} ETH`
			);
		}

		if (finalAmount <= BigInt(0)) {
			throw new Error("Insufficient ETH after both gas costs");
		}

		// Mint SkyUSD with ETH (using amount after both gas costs)
		const tx = await skynetMinter.buySkyUSDUsingNativeToken(
			"0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // Uniswap router
			"0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH on Arbitrum
			0, // minAmount (we trust the contract)
			Math.floor(Date.now() / 1000) + 3600, // 1 hour deadline
			{
				value: finalAmount,
				gasLimit: (mintGasEstimate * BigInt(150)) / BigInt(100), // 1.5x buffer for Arbitrum
				maxFeePerGas,
				maxPriorityFeePerGas,
			}
		);
		await tx.wait();
		updateStep("ARB ETH -> ARB SkyUSD", "success");

		// Step 2: Bridge SkyUSD to Skynet
		updateStep("ARB SkyUSD -> Skynet SkyUSD", "pending");

		// Get SkyUSD balance
		const skyusdContract = new ethers.Contract(
			SKYUSD_TOKEN.address,
			["function balanceOf(address) view returns (uint256)"],
			signer
		);
		const skyusdBalance = await skyusdContract.balanceOf(fromAddress);
		const formattedBalance = ethers.formatUnits(skyusdBalance, 18);

		// Bridge SkyUSD to Skynet with pre-calculated gas parameters
		await bridgeSkyUSDToSkynet(signer, formattedBalance, web3Auth, {
			maxFeePerGas,
			maxPriorityFeePerGas,
			gasLimit: (bridgeGasEstimate * BigInt(150)) / BigInt(100), // 1.5x buffer for Arbitrum
		});
		updateStep("ARB SkyUSD -> Skynet SkyUSD", "success");

		return formattedBalance;
	} catch (error) {
		console.error("Error in handleArbitrumETHtoSkynet:", error);
		updateStep("ARB ETH -> ARB SkyUSD", "failed");
		throw error;
	}
};
