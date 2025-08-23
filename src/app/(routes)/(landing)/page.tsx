"use client";
import React from "react";
import ConnectButton from "@/components/wallet/connect-button";
import { useWallet } from "@/hooks/use-wallet";
import { useRouter } from "next/navigation";
import SkynetParticles from "@/components/common/skynet.particles";
import Spline from "@splinetool/react-spline";

export default function page() {
	const router = useRouter();
	const { isConnected } = useWallet();
	if (isConnected) {
		router.replace("/create");
	}
	return (
		<div className="flex flex-col items-center justify-center h-screen bg-black">
			<div className="w-full h-full relative">
				
				<Spline scene="https://prod.spline.design/J7nEbPq5NFufJmjN/scene.splinecode" />
				<div className="absolute bottom-5 right-5 h-10 w-36 bg-black"></div>
				<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10 pb-20">
				<ConnectButton />
			</div>
			</div>
		</div>
	);
}
