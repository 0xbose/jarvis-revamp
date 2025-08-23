"use client";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";

export default function ConnectButton() {
	const { isConnected, address, loading, connect, disconnect } = useWallet();

	if (loading) {
		return (
			<Button 
				disabled 
				className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 text-white border border-purple-500/30 backdrop-blur-sm"
			>
				Connecting...
			</Button>
		);
	}

	if (isConnected && address) {
		return (
			<div className="flex items-center gap-3">
				<span className="text-sm font-mono text-white/90 bg-gradient-to-r from-purple-600/20 to-blue-600/20 px-4 py-2 rounded-full border border-purple-500/30 backdrop-blur-sm">
					{`${address.slice(0, 6)}...${address.slice(-4)}`}
				</span>
				<Button 
					variant="outline" 
					onClick={disconnect}
					className="border-purple-500/30 text-white bg-gradient-to-r from-purple-600/10 to-blue-600/10 hover:from-purple-600/20 hover:to-blue-600/20 hover:text-white backdrop-blur-sm transition-all duration-300"
				>
					Disconnect
				</Button>
			</div>
		);
	}

	return (
		<Button 
			onClick={connect}
			className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 h-10 text-white border border-purple-500/30 hover:from-purple-600/30 hover:to-blue-600/30 hover:text-white backdrop-blur-sm transition-all duration-300 shadow-lg hover:shadow-purple-500/20"
		>
			Connect Wallet
		</Button>
	);
}
