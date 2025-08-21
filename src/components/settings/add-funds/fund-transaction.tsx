"use client"
import { ethers } from 'ethers';
import { executeRoute, convertQuoteToRoute, type ExecutionOptions, Solana, ChainId } from '@lifi/sdk';
import { WalletProviderFactory, WalletType } from '@/providers/add-funds/WalletProvider';
import { SolanaWalletProvider } from '@/types/wallet';
import { switchToArbitrum } from '@/utils/funds/bridge';
import { Connection } from '@solana/web3.js';
import { Web3RPC } from '@/utils/rpc/web3RPC';
import { createConfig, EVM } from '@lifi/sdk';
import { RPC_CONFIG } from '@/config/rpc-config';

type StepStatus = 'pending' | 'success' | 'failed';
type UpdateStepFunction = (step: string, status: StepStatus) => void;

interface ExtendedStatusResponse {
    status: 'DONE' | 'FAILED' | 'PENDING';
    error?: {
        message: string;
    };
    txHash?: string;
}

interface ExtendedExecutionOptions extends ExecutionOptions {
    updateCallback: (status: ExtendedStatusResponse) => void;
    providers?: any[];
}

interface BalanceVerificationConfig {
    maxAttempts?: number;
    intervalMs?: number;
}

async function verifyArbitrumBalance(
    provider: ethers.BrowserProvider, 
    address: string, 
    config: BalanceVerificationConfig = {}
): Promise<{ balance: bigint; success: boolean }> {
    const { maxAttempts = 60, intervalMs = 5000 } = config;
    
    try {
        let attempts = 0;
        let ethBalance = BigInt(0);
        while (attempts < maxAttempts) {
            ethBalance = await provider.getBalance(address);
            console.log('Current ETH balance:', ethers.formatEther(ethBalance));
            if (ethBalance > BigInt(0)) {
                return { balance: ethBalance, success: true };
            }
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            attempts++;
        }
        return { balance: ethBalance, success: false };
    } catch (error) {
        console.error('Error verifying Arbitrum balance:', error);
        return { balance: BigInt(0), success: false };
    }
}

// Configure Solana provider
export const configureSolanaProvider = async (provider: SolanaWalletProvider) => {
    try {
        // Create connection with proper config
        const connection = new Connection(RPC_CONFIG.HELIUS_RPC_URL, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 120000, // 2 minutes
            wsEndpoint: 'wss://mainnet.helius-rpc.com/ws?api-key=c73b793a-38da-4141-ad57-97d71c264a76',
        });

       
        // Create wallet adapter with proper configuration
        const walletAdapter = await provider.getProvider();

        // Get latest blockhash with validity period
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
            commitment: 'confirmed'
        });

        // Configure LiFi SDK with Solana provider
        createConfig({
            integrator: 'skynet',
            providers: [
                Solana({
                    getWalletAdapter: async () => {
                        try {
                            // Get fresh blockhash before each transaction
                            const { blockhash: newBlockhash, lastValidBlockHeight: newLastValidBlockHeight } =
                                await connection.getLatestBlockhash({
                                    commitment: 'confirmed'
                                });

                            // Set the blockhash and lastValidBlockHeight
                            (walletAdapter as any).recentBlockhash = newBlockhash;
                            (walletAdapter as any).lastValidBlockHeight = newLastValidBlockHeight;

                            return walletAdapter;
                        } catch (error) {
                            console.error("Failed to get latest blockhash:", error);
                            throw error;
                        }
                    }
                }),
            ],
            rpcUrls: {
                [ChainId.SOL]: [RPC_CONFIG.HELIUS_RPC_URL],
            }
        });

        return {
            connection,
            walletAdapter,
            blockhash,
            lastValidBlockHeight
        };
    } catch (error) {
        console.error("Error configuring Solana provider:", error);
        throw error;
    }
};

export const configureEVMProvider = async (ethersProvider?: ethers.BrowserProvider) => {
    const config: any = {
        integrator: 'skynet',
        rpcUrls: {
            1151111081099710: [RPC_CONFIG.HELIUS_RPC_URL],
            [ChainId.ARB]: [RPC_CONFIG.ARBITRUM_RPC_URL],
            [ChainId.BSC]: [RPC_CONFIG.BSC_RPC_URL],
            [ChainId.ETH]: [RPC_CONFIG.ETH_RPC_URL],
            [ChainId.OPT]: [RPC_CONFIG.OPTIMISM_RPC_URL],
            [ChainId.BAS]: [RPC_CONFIG.BASE_RPC_URL],
        },
    };

    // Add providers if ethersProvider is available
    if (ethersProvider) {
        const signer = await ethersProvider.getSigner();
        const address = await signer.getAddress();
        config.providers = [
            {
                type: 'evm',
                getProvider: async () => ethersProvider,
                getAccount: async () => address as `0x${string}`,
                getSigner: async () => signer,
                isAddress: (address: string) => ethers.isAddress(address),
                getStepExecutor: async (step: any) => {
                    let currentInteraction: any = null;
                    return {
                        executeStep: async (stepConfig: any) => {
                            try {
                                console.log("Executing step with config:", JSON.stringify(stepConfig, null, 2));

                                if (!stepConfig || !stepConfig.transactionRequest) {
                                    throw new Error('Invalid step configuration - missing transaction request');
                                }

                                // Use the transaction request from the step config
                                const tx = stepConfig.transactionRequest;
                                console.log("Using transaction request:", JSON.stringify(tx, null, 2));

                                const response = await signer.sendTransaction(tx);
                                console.log("Transaction sent:", response.hash);
                                const receipt = await response.wait();
                                console.log("Transaction confirmed:", receipt);
                                return receipt;
                            } catch (error) {
                                console.error("Error executing step:", error);
                                throw error;
                            }
                        },
                        setInteraction: (interaction: any) => {
                            currentInteraction = interaction;
                            console.log("Set interaction:", interaction);
                        },
                        getInteraction: () => currentInteraction,
                        gasLimit: async (overrides: any) => {
                            try {
                                const signerAddress = await signer.getAddress();
                                const tx = {
                                    from: signerAddress,
                                    ...step.transaction,
                                    ...overrides
                                };
                                return await signer.estimateGas(tx);
                            } catch (error) {
                                console.error("Error estimating gas:", error);
                                throw error;
                            }
                        }
                    };
                }
            }
        ];
    }

    // Initialize SDK with config
    createConfig(config);
};

export async function executeFundsTransaction({
    quote,
    selectedWallet,
    updateStep,
    onSuccess,
    onError,
    web3Auth,
    amount
}: {
    quote: any;
    selectedWallet: WalletType;
    updateStep: UpdateStepFunction;
    onSuccess: () => void;
    onError: (error: Error) => void;
    web3Auth: any;
    amount: string;
}) {
    try {
        if (!quote) {
            throw new Error('No quote available');
        }

        const route = await convertQuoteToRoute(quote);
        if (!route) {
            throw new Error('Failed to convert quote to route');
        }

        const provider = WalletProviderFactory.getProvider(selectedWallet);
        if (!provider) {
            throw new Error('Failed to get wallet provider');
        }

        // Step 1: Execute LiFi Bridge
        updateStep('Executing LiFi bridge...', 'pending');
        let executionOptions: ExtendedExecutionOptions = {
            infiniteApproval: false,
            executeInBackground: false,
            updateCallback: async (status: ExtendedStatusResponse) => {
                console.log('Transaction status:', status);
                if (status.status === 'DONE') {
                    updateStep('LiFi bridge completed', 'success');
                } else if (status.status === 'FAILED') {
                    updateStep('LiFi bridge failed', 'failed');
                    throw new Error(status.error?.message || 'Bridge failed');
                }
            }
           
        };

        if (selectedWallet === 'phantom') {
            const solanaProvider = provider as SolanaWalletProvider;
            await configureSolanaProvider(solanaProvider);
        } else if (selectedWallet === 'metamask') {
            if (!window.ethereum) {
                throw new Error('MetaMask provider not found');
            }
            const ethersProvider = new ethers.BrowserProvider(window.ethereum);
            await configureEVMProvider(ethersProvider);
        }

        await executeRoute(route, executionOptions);

        if (web3Auth?.provider) {
            const web3RPC = new Web3RPC(web3Auth.provider);
            const address = await web3RPC.getAccounts();
            const ethersProvider = new ethers.BrowserProvider(web3Auth.provider as any);

            // Step 2: Verify Arbitrum ETH balance
            updateStep('Verifying Arbitrum ETH balance...', 'pending');
            await switchToArbitrum(web3Auth);
            const { balance, success } = await verifyArbitrumBalance(ethersProvider, address, {
                maxAttempts: 10,
                intervalMs: 10000
            });

            if (!success) {
                throw new Error('Timed out waiting for ETH balance on Arbitrum');
            }
        }

        onSuccess();
    } catch (error) {
        console.error('Error executing transaction:', error);
        updateStep('Transaction failed', 'failed');
        onError(error instanceof Error ? error : new Error('Unknown error occurred'));
    }
} 