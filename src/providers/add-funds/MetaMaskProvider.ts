import { ethers } from 'ethers';
import { EVMWalletProvider } from '@/types/wallet';

declare global {
    interface Window {
        ethereum?: {
            isMetaMask?: boolean;
            isRabby?: boolean;
            request: (args: { method: string; params?: any[] }) => Promise<any>;
            on: (event: string, callback: (...args: any[]) => void) => void;
            removeListener: (event: string, callback: (...args: any[]) => void) => void;
        };
    }
}

export class MetaMaskProvider implements EVMWalletProvider {
    private provider: ethers.BrowserProvider | null = null;
    private signer: ethers.Signer | null = null;
    private connected: boolean = false;

    constructor() {
        if (typeof window !== 'undefined') {
            console.log('Checking for MetaMask...');
            console.log('window.ethereum:', window.ethereum);
            
            if (window.ethereum?.isMetaMask) {
                console.log('MetaMask detected!');
                this.provider = new ethers.BrowserProvider(window.ethereum);
                this.setupEventListeners();
            } else {
                console.log('MetaMask not detected');
            }
        }
    }

    private setupEventListeners() {
        if (!this.provider) return;

        const handleAccountsChanged = async (accounts: string[]) => {
            console.log('MetaMask accounts changed:', accounts);
            if (accounts.length === 0) {
                this.connected = false;
                this.signer = null;
            } else {
                this.signer = await this.provider!.getSigner();
            }
        };

        const handleChainChanged = (chainId: string) => {
            console.log('MetaMask chain changed:', chainId);
            // window.location.reload(); // Removed to prevent page refresh
        };

        const handleDisconnect = () => {
            console.log('MetaMask disconnected');
            this.connected = false;
            this.signer = null;
        };

        window.ethereum?.on('accountsChanged', handleAccountsChanged);
        window.ethereum?.on('chainChanged', handleChainChanged);
        window.ethereum?.on('disconnect', handleDisconnect);
    }

    async connect(): Promise<void> {
        console.log('Attempting to connect to MetaMask...');
        
        if (!window.ethereum) {
            console.error('No ethereum provider found');
            throw new Error('MetaMask not installed');
        }

        if (!window.ethereum.isMetaMask) {
            console.error('Provider is not MetaMask');
            throw new Error('MetaMask not detected');
        }

        try {
            console.log('Requesting MetaMask accounts...');
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            console.log('MetaMask accounts received:', accounts);
            
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found');
            }

            this.provider = new ethers.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();
            this.connected = true;
            
            const network = await this.provider.getNetwork();
            console.log('Connected to network:', network);
        } catch (error: any) {
            console.error('MetaMask connection error:', error);
            if (error.code === 4001) {
                throw new Error('User denied account access');
            } else if (error.code === -32002) {
                throw new Error('Already processing eth_requestAccounts. Please check MetaMask.');
            }
            throw new Error('Failed to connect to MetaMask: ' + error.message);
        }
    }

    async disconnect(): Promise<void> {
        this.connected = false;
        this.signer = null;
    }

    async getAddress(): Promise<string> {
        if (!this.signer) {
            throw new Error('Not connected to MetaMask');
        }
        return await this.signer.getAddress();
    }

    async getBalance(): Promise<string> {
        if (!this.signer) {
            throw new Error('Not connected to MetaMask');
        }
        const address = await this.signer.getAddress();
        const balance = await this.provider!.getBalance(address);
        return ethers.formatEther(balance);
    }

    async signMessage(message: string): Promise<string> {
        if (!this.signer) {
            throw new Error('Not connected to MetaMask');
        }
        return await this.signer.signMessage(message);
    }

    isConnected(): boolean {
        return this.connected;
    }

    getProvider(): ethers.BrowserProvider {
        if (!this.provider) {
            throw new Error('MetaMask not installed');
        }
        return this.provider;
    }

    async getSigner(): Promise<ethers.Signer> {
        if (!this.provider) {
            throw new Error('MetaMask not installed');
        }
        return await this.provider.getSigner();
    }

    // Static method to detect available injected EVM wallets
    static getAvailableInjectedWallets() {
        if (typeof window === 'undefined' || !window.ethereum) return [];
        const wallets = [];
        if (window.ethereum.isMetaMask) wallets.push({ type: 'metamask', label: 'MetaMask' });
        if (window.ethereum.isRabby) wallets.push({ type: 'rabby', label: 'Rabby' });
        // Add more wallet detections here as needed
        return wallets;
    }
} 