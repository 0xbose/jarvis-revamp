"use client";
import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LucideArrowUp, Square, Play } from "lucide-react";
import { ChatInputProps } from "@/types/types";
import { useGlobalStore } from "@/stores/global-store";
import { useRouter } from "next/navigation";
import Marketplace from "../market-place/user-agent-selector";

export default function ChatInput({
	onSend,
	onStop,
	onResume,
	mode,
	setMode,
	prompt,
	setPrompt,
	hideModeSelection = false,
	disableAgentSelection = false,
	isExecuting = false,
	workflowStatus = "running",
}: ChatInputProps) {
	const { selectedAgent, setSelectedAgent } = useGlobalStore();
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (mode === "agent") {
			if (!selectedAgent || !prompt.trim()) {
				return;
			}

			const agentAddress = selectedAgent.collection_address || 
				('nft_address' in selectedAgent ? selectedAgent.nft_address : null);
			
			if (agentAddress) {
				router.push(`/chat/agent/${agentAddress}?nftId=${selectedAgent.nft_id}`);

				// Call onSend to execute the workflow
				if (onSend) {
					onSend(prompt, agentAddress);
				}
			} else {
				console.log("❌ No agent address available");
			}
		} else {
			if (!prompt.trim()) return;
			router.push("/chat");

			// Call onSend for chat mode as well
			if (onSend) {
				onSend(prompt);
			}
		}
	};

	const handleStop = () => {
		if (onStop) {
			onStop();
		}
	};

	const handleResume = () => {
		if (onResume) {
			onResume();
		}
	};

	const isAgentMode = mode === "agent";
	const isAgentSelected = !!selectedAgent;
	const canType = !isAgentMode || (isAgentMode && isAgentSelected);
	const canSubmit =
		(isAgentMode && isAgentSelected && !!prompt.trim()) ||
		(!isAgentMode && !!prompt.trim());

	const isWorkflowStopped = workflowStatus === "stopped";
	const showResumeButton = isWorkflowStopped;
	const showStopButton = isExecuting && !isWorkflowStopped;

	const getPlaceholderText = () => {
		if (isExecuting && workflowStatus === "awaiting_response") {
			return "Provide feedback to continue...";
		}
		if (isExecuting) {
			return "Processing...";
		}
		if (isAgentMode) {
			if (isAgentSelected) {
				return `Ask ${selectedAgent.name} anything...`;
			}
			return "Select an agent first...";
		}
		return prompt || "Type your message...";
	};

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-y-2 w-full">
			<div className="flex items-center gap-2 w-full">
				{!hideModeSelection && (
					<div className="flex items-center gap-2 min-w-[110px]">
						<button
							className={`
								relative h-7 rounded-full cursor-pointer transition-colors duration-200
								flex items-center justify-center overflow-hidden text-xs font-medium font-sans  
								${
									mode === "agent"
										? "bg-accent text-accent-foreground w-27"
										: "bg-input border border-border text-foreground w-26"
								}
								${mode === "agent" ? "flex-row" : "flex-row-reverse"}
								leading-none whitespace-nowrap p-0
							`}
							type="button"
							onClick={() => {
								if (mode === "agent") {
									setSelectedAgent(null);
								}
								setMode(mode === "agent" ? "chat" : "agent");
							}}
							aria-pressed={mode === "agent"}
						>
							<span
								className={`
									flex-1 z-[1] font-medium transition-colors duration- pt-0.5
									${mode === "agent" ? "text-right ml-0 mr-7" : "text-left ml-7 mr-0"}
								`}
							>
								{mode === "agent" ? "Agent Mode" : "Chat Mode"}
							</span>
							<div
								className={`
									absolute top-1/2 ${
										mode === "agent"
											? "-left-1.5"
											: "left-1"
									} size-4.5 bg-[#CDD1D4] rounded-full
									shadow-[0_2px_4px_rgba(0,0,0,0.2)] z-[2] transition-transform duration-[750ms] ease-[cubic-bezier(0.4,0,0.2,1)]
								`}
								style={{
									transform:
										mode === "agent"
											? "translateX(92px) translateY(-50%)"
											: "translateX(0) translateY(-50%)",
								}}
							/>
						</button>
					</div>
				)}
				<Marketplace disabled={disableAgentSelection} />
			</div>

			<div className="w-full flex items-center bg-input rounded-lg px-4 border border-border h-13">
				<Input
					className="flex-1 px-0 h-full border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground text-base"
					type="text"
					placeholder={getPlaceholderText()}
					value={prompt}
					onChange={(e) => {
						if (canType) {
							setPrompt(e.target.value);
						}
					}}
				/>
				{showResumeButton ? (
					<Button
						size="icon"
						className="!p-0 rounded-full bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
						type="button"
						aria-label="Resume execution"
						disabled={false}
						onClick={handleResume}
					>
						<Play className="size-4" />
					</Button>
				) : showStopButton ? (
					<Button
						size="icon"
						className="!p-0 rounded-full bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
						type="button"
						aria-label="Stop execution"
						disabled={false}
						onClick={handleStop}
					>
						<Square className="size-4" />
					</Button>
				) : (
					<Button
						size="icon"
						className="!p-0 rounded-full bg-[#CDD1D4] hover:bg-[#CDD1D4]/90 text-background disabled:opacity-50 disabled:cursor-not-allowed"
						type="submit"
						aria-label="Send"
						disabled={!canSubmit}
					>
						<LucideArrowUp className="size-5.5" />
					</Button>
				)}
			</div>
		</form>
	);
}
