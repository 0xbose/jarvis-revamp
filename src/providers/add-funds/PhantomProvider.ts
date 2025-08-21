import {
	PublicKey,
	Connection,
	LAMPORTS_PER_SOL,
	ConnectionConfig,
} from "@solana/web3.js";
import { SolanaWalletProvider } from "@/types/wallet";
import { RPC_CONFIG } from "@/config/rpc-config";

declare global {
	interface Window {
		phantom?: {
			solana?: {
				isPhantom: boolean;
				connect(): Promise<{ publicKey: PublicKey }>;
				disconnect(): Promise<void>;
				signMessage(
					message: Uint8Array
				): Promise<{ signature: Uint8Array }>;
				publicKey: PublicKey | null;
				connection: Connection;
			};
		};
	}
}

// Connection configuration with higher timeouts and proper commitment
const CONNECTION_CONFIG: ConnectionConfig = {
	commitment: "confirmed",
	confirmTransactionInitialTimeout: 120000, // 2 minutes
	httpHeaders: {
		"Content-Type": "application/json",
	},
};

export class PhantomProvider implements SolanaWalletProvider {
	private provider: any = null;
	private connected: boolean = false;
	private connection: Connection;
	private rpcUrl: string;

	constructor(rpcUrl: string = RPC_CONFIG.HELIUS_RPC_URL) {
		if (typeof window !== "undefined" && window.phantom?.solana) {
			this.provider = window.phantom.solana;
		}

		this.rpcUrl = rpcUrl;
		console.log("Initializing PhantomProvider with RPC URL:", this.rpcUrl);

		// Initialize with Helius RPC configuration
		this.connection = new Connection(this.rpcUrl, CONNECTION_CONFIG);

		// Override the default RPC endpoint in the provider
		if (this.provider) {
			console.log(
				"Setting provider connection to use RPC URL:",
				this.rpcUrl
			);
			// Override the provider's connection
			this.provider.connection = this.connection;

			// Override the provider's RPC endpoint
			const originalSend = this.provider.connection._rpcWebSocket.send;
			this.provider.connection._rpcWebSocket.send = (msg: any) => {
				console.log("Intercepted RPC call:", msg);
				return originalSend.call(
					this.provider.connection._rpcWebSocket,
					msg
				);
			};
		}
	}

	// Method to update RPC endpoint
	updateRpcEndpoint(rpcUrl: string) {
		console.log("Updating RPC endpoint from", this.rpcUrl, "to", rpcUrl);
		this.rpcUrl = rpcUrl;

		// Reinitialize connection with new endpoint
		this.connection = new Connection(this.rpcUrl, CONNECTION_CONFIG);

		// Update the provider's connection
		if (this.provider) {
			console.log(
				"Updating provider connection to use new RPC URL:",
				this.rpcUrl
			);
			this.provider.connection = this.connection;

			// Override the provider's RPC endpoint
			const originalSend = this.provider.connection._rpcWebSocket.send;
			this.provider.connection._rpcWebSocket.send = (msg: any) => {
				console.log("Intercepted RPC call:", msg);
				return originalSend.call(
					this.provider.connection._rpcWebSocket,
					msg
				);
			};
		}
	}

	// Method to get current RPC configuration
	getRpcConfig() {
		console.log("Current RPC configuration:", { rpcUrl: this.rpcUrl });
		return {
			rpcUrl: this.rpcUrl,
		};
	}

	async connect(): Promise<void> {
		if (!this.provider) {
			throw new Error("Phantom wallet not found");
		}

		try {
			// Ensure we're using our RPC before connecting
			this.provider.connection = this.connection;

			const { publicKey } = await this.provider.connect();
			this.connected = true;
			console.log(
				"Connected to Phantom wallet:",
				publicKey.toString(),
				"using RPC:",
				this.rpcUrl
			);
		} catch (error) {
			console.error("Failed to connect to Phantom wallet:", error);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		if (!this.provider) {
			throw new Error("Phantom wallet not found");
		}

		try {
			await this.provider.disconnect();
			this.connected = false;
			console.log("Disconnected from Phantom wallet");
		} catch (error) {
			console.error("Failed to disconnect from Phantom wallet:", error);
			throw error;
		}
	}

	async getAddress(): Promise<string> {
		if (!this.provider || !this.connected) {
			throw new Error("Phantom wallet not connected");
		}

		try {
			const publicKey = this.provider.publicKey;
			if (!publicKey) {
				throw new Error("No public key available");
			}
			return publicKey.toString();
		} catch (error) {
			console.error("Failed to get address from Phantom wallet:", error);
			throw error;
		}
	}

	async getPublicKey(): Promise<PublicKey> {
		if (!this.provider || !this.connected) {
			throw new Error("Phantom wallet not connected");
		}

		try {
			const publicKey = this.provider.publicKey;
			if (!publicKey) {
				throw new Error("No public key available");
			}
			return publicKey;
		} catch (error) {
			console.error(
				"Failed to get public key from Phantom wallet:",
				error
			);
			throw error;
		}
	}

	async getBalance(): Promise<string> {
		if (!this.provider || !this.connected) {
			throw new Error("Phantom wallet not connected");
		}

		try {
			const publicKey = await this.getPublicKey();
			console.log("Getting balance using RPC:", this.rpcUrl);
			const balance = await this.connection.getBalance(publicKey);
			return (balance / LAMPORTS_PER_SOL).toString();
		} catch (error) {
			console.error("Failed to get balance from Phantom wallet:", error);
			throw error;
		}
	}

	async signMessage(message: string): Promise<string> {
		if (!this.provider || !this.connected) {
			throw new Error("Phantom wallet not connected");
		}

		try {
			const encodedMessage = new TextEncoder().encode(message);
			const { signature } = await this.provider.signMessage(
				encodedMessage
			);
			return Buffer.from(signature).toString("hex");
		} catch (error) {
			console.error("Failed to sign message with Phantom wallet:", error);
			throw error;
		}
	}

	isConnected(): boolean {
		return this.connected;
	}

	getProvider(): any {
		return this.provider;
	}

	getConnection(): Connection {
		return this.connection;
	}
}
