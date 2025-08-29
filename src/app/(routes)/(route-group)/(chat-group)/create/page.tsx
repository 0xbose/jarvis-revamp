"use client";
import ChatInput from "@/components/common/chat-input";
import React, { useEffect } from "react";
import { useGlobalStore } from "@/stores/global-store";
import { useRouter } from "next/navigation";
// import Image from "next/image";
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
					router.push(`/chat/agent/${selectedAgent.id}`);
				} else {
					console.log("❌ No selected agent");
				}
			} else {
				console.log("🔄 Navigating to: /chat");
				router.push("/chat");
			}
		} else {
			console.log("❌ Empty prompt, not navigating");
		}
	};

	return (
		<div className="flex flex-col items-center h-full w-full relative ">
			{/* <div className="w-full h-full flex flex-col items-center justify-center"> */}
			<div className="w-full h-full max-h-[50%] relative">
				{/* <Image
					src="/full-logo.svg"
					alt="Create"
					width={1000}
					height={1000}
					className="w-full max-w-80 h-full"
				/> */}
				<Spline scene="https://prod.spline.design/XGG3yvqNuvg63wOA/scene.splinecode" />
				<div className="absolute bottom-5 right-5 h-10 w-36 bg-background"></div>
				{/* </div> */}
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
