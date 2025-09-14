"use client";
import ChatInput from "@/components/common/chat-input";
import React from "react";
import { useGlobalStore } from "@/stores/global-store";
import { useRouter } from "next/navigation";
import Spline from "@splinetool/react-spline";

export default function CreatePage() {
	const { mode, prompt, setPrompt, setMode, selectedAgent } =
		useGlobalStore();
	const router = useRouter();

	const handleModeChange = (newMode: "chat" | "agent") => {
		setMode(newMode);
	};

	const handlePromptSubmit = () => {
		if (prompt.trim()) {
			if (mode === "agent") {
				if (selectedAgent) {
					const agentAddress =
						("collection_address" in selectedAgent
							? selectedAgent.collection_address
							: null) ||
						("collection_id" in selectedAgent
							? selectedAgent.collection_id
							: null) ||
						("nft_address" in selectedAgent
							? selectedAgent.nft_address
							: null);
					const nftId =
						"nft_id" in selectedAgent ? selectedAgent.nft_id : null;

					if (agentAddress && nftId) {
						console.log("✅ Navigating to agent:", agentAddress);
						router.push(
							`/chat/agent/${agentAddress}?nftId=${nftId}`
						);
					} else {
						console.log("❌ No agent address or nftId available");
					}
				} else {
					console.log("❌ No selected agent");
				}
			} else {
				console.log("🔄 Navigating to: /chat with prompt:", prompt);
				// Keep prompt in global store for auto-submission in chat page
				router.push("/chat");
			}
		} else {
			console.log("❌ Empty prompt, not navigating");
		}
	};

	return (
		<div className="flex flex-col items-center h-full w-full relative ">
			<div className="w-full h-full max-h-[50%] relative">
				<Spline scene="https://prod.spline.design/XGG3yvqNuvg63wOA/scene.splinecode" />
				<div className="absolute bottom-5 right-5 h-10 w-36 bg-background"></div>
			</div>
			<div className="w-fit min-w-4xl">
				<ChatInput
					onSend={handlePromptSubmit}
					mode={mode}
					setMode={handleModeChange}
					prompt={prompt}
					setPrompt={setPrompt}
				/>
			</div>
		</div>
	);
}
