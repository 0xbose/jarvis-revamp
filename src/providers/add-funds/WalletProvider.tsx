import { RPC_CONFIG } from "@/config/rpc-config";
import { MetaMaskProvider } from "@/providers/add-funds/MetaMaskProvider";
import { PhantomProvider } from "@/providers/add-funds/PhantomProvider";
import { WalletProvider } from "@/types/wallet";

export type WalletType = "metamask" | "phantom";

export class WalletProviderFactory {
	private static instances: Map<WalletType, WalletProvider> = new Map();

	static getProvider(type: WalletType): WalletProvider {
		if (!this.instances.has(type)) {
			switch (type) {
				case "metamask":
					this.instances.set(type, new MetaMaskProvider());
					break;
				case "phantom":
					console.log(
						"Creating new PhantomProvider with Helius RPC:",
						RPC_CONFIG.HELIUS_RPC_URL
					);
					this.instances.set(
						type,
						new PhantomProvider(RPC_CONFIG.HELIUS_RPC_URL)
					);
					break;
				default:
					throw new Error(`Unsupported wallet type: ${type}`);
			}
		}
		return this.instances.get(type)!;
	}

	static async connect(type: WalletType): Promise<void> {
		const provider = this.getProvider(type);
		await provider.connect();
	}

	static async disconnect(type: WalletType): Promise<void> {
		const provider = this.getProvider(type);
		await provider.disconnect();
	}

	static isConnected(type: WalletType): boolean {
		const provider = this.getProvider(type);
		return provider.isConnected();
	}
}
