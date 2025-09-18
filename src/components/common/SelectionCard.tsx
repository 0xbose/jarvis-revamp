"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GitCompare, Loader2, Trash2, X } from "lucide-react";
import ModelSelectDialog from "@/components/common/ModelSelectDialog";
import Marketplace from "../market-place/user-agent-selector";

interface SelectionCard {
	id: string;
	text: string;
	modelId?: string;
	agentId?: string;
	chatId?: string;
	workflowId?: string;
	isSending?: boolean;
	isCollapsed?: boolean;
}

interface SelectionCardProps {
	card: SelectionCard;
	models: any[];
	selectedModel: any;
	selectedAgent: any;
	isStreaming: boolean;
	onTextChange: (cardId: string, text: string) => void;
	onModelChange: (cardId: string, modelId: string) => void;
	onAgentChange: (cardId: string, agentId: string) => void;
	onSend: (
		cardId: string,
		text: string,
		modelId?: string,
		agentId?: string
	) => void;
	onOpenChat: (chatId: string, cardId: string) => void;
	onRemove: (cardId: string) => void;
	onToggleCollapse: (cardId: string) => void;
	onCompare?: (cardId: string, chatId: string, agentId?: string) => void;
}

// Generate a consistent gradient index based on card ID
const getGradientIndex = (cardId: string): number => {
	let hash = 0;
	for (let i = 0; i < cardId.length; i++) {
		const char = cardId.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash) % 8; // 8 different gradients
};

const Gradients = [
	// Platinum
	"bg-[conic-gradient(at_center,_#fafafa,_#d4d4d8,_#f3f4f6,_#fafafa)] dark:bg-[conic-gradient(at_center,_#525252,_#262626,_#737373,_#525252)]",

	// Titanium Blue
	"bg-[conic-gradient(at_center,_#dbeafe,_#60a5fa,_#93c5fd,_#dbeafe)] dark:bg-[conic-gradient(at_center,_#1e3a8a,_#0c4a6e,_#1e40af,_#1e3a8a)]",

	// Polished Silver
	"bg-[conic-gradient(at_top_left,_#f5f5f5,_#d4d4d8,_#f5f5f5)] dark:bg-[conic-gradient(at_top_left,_#404040,_#171717,_#404040)]",

	// Chrome
	"bg-[conic-gradient(at_center,_#fafafa,_#a3a3a3,_#e5e5e5,_#fafafa)] dark:bg-[conic-gradient(at_center,_#525252,_#0a0a0a,_#262626,_#525252)]",

	// Shiny Gold
	"bg-[conic-gradient(at_center,_#fef9c3,_#facc15,_#fde68a,_#fef9c3)] dark:bg-[conic-gradient(at_center,_#854d0e,_#713f12,_#a16207,_#854d0e)]",

	// Bronze
	"bg-[conic-gradient(at_center,_#fcd34d,_#b45309,_#fbbf24,_#fcd34d)] dark:bg-[conic-gradient(at_center,_#78350f,_#451a03,_#92400e,_#78350f)]",

	// Gunmetal
	"bg-[conic-gradient(at_center,_#e5e7eb,_#9ca3af,_#6b7280,_#e5e7eb)] dark:bg-[conic-gradient(at_center,_#1f2937,_#111827,_#374151,_#1f2937)]",

	// Rose Gold
	"bg-[conic-gradient(at_center,_#fce7f3,_#f9a8d4,_#fbcfe8,_#fce7f3)] dark:bg-[conic-gradient(at_center,_#831843,_#4a044e,_#9d174d,_#831843)]",
];

export default function SelectionCardComponent({
	card,
	models,
	selectedModel,
	selectedAgent,
	isStreaming,
	onTextChange,
	onModelChange,
	onAgentChange,
	onSend,
	onOpenChat,
	onRemove,
	onToggleCollapse,
	onCompare,
}: SelectionCardProps) {
	const isCollapsed = card.isCollapsed ?? true;
	const gradientClass = Gradients[getGradientIndex(card.id)];

	// Debug logging
	console.log("🔍 SelectionCard render:", {
		cardId: card.id,
		chatId: card.chatId,
		workflowId: card.workflowId,
		agentId: card.agentId,
		isSending: card.isSending,
		hasOpenButton: !!(card.chatId || card.workflowId),
	});

	if (isCollapsed) {
		return (
			<div className="flex justify-end">
				<button
					onClick={() => onToggleCollapse(card.id)}
					className={`mr-2 group relative w-12 h-12 ${gradientClass} border border-border/50 rounded-full shadow-sm backdrop-blur hover:shadow-md transition-all duration-200 hover:scale-105 flex items-center justify-center`}
				>
					{/* Message icon */}
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="text-slate-600 dark:text-slate-300 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors"
					>
						<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
						<path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
					</svg>

					{/* Status indicator */}
					{card.isSending && (
						<div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
							<Loader2 className="size-2 animate-spin text-white" />
						</div>
					)}
					{(card.chatId || card.workflowId) && !card.isSending && (
						<div className="absolute -top-0.5 -right-0 size-3 bg-green-500 rounded-full"></div>
					)}
				</button>
			</div>
		);
	}

	return (
		<div className="bg-background border border-border rounded-lg shadow-sm backdrop-blur p-3 flex flex-col gap-2 animate-in slide-in-from-right-2 duration-200">
			<div className="flex items-center justify-between">
				<h4 className="text-xs font-medium">Selected</h4>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 px-2 hover:bg-sidebar"
					onClick={() => onToggleCollapse(card.id)}
				>
					<X className="size-4" />
				</Button>
			</div>

			<div className="text-xs whitespace-pre-wrap">
				<Textarea
					className="bg-transparent border border-border shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground text-base min-h-10 max-h-20 overflow-y-auto scrollbar-thin"
					value={card.text}
					rows={2}
					onChange={(e) => onTextChange(card.id, e.target.value)}
					placeholder="Enter your message..."
				/>
			</div>

			<div className="flex gap-2 justify-between items-end pt-2">
				{/* Show agent/model selection only if no chat/workflow exists */}
				{!(card.chatId || card.workflowId) && (
					<div className="space-y-0.5">
						<Label className="text-xs font-normal">
							{card.agentId ? "Agent" : "Model"}
						</Label>
						<div className="mt-1">
							{card.agentId ? (
								<Marketplace disabled={false} />
							) : (
								<ModelSelectDialog
									buttonSize="sm"
									buttonClassName="!h-8"
									value={
										card.modelId
											? ({
													id: card.modelId,
													name:
														models.find(
															(m: any) =>
																m.id ===
																card.modelId
														)?.name || card.modelId,
											  } as any)
											: null
									}
									disableGlobalSync={true}
									onChange={(m) =>
										onModelChange(card.id, m.id)
									}
								/>
							)}
						</div>
					</div>
				)}

				{/* Show compare button in place of agent selection when chat/workflow exists */}
				{(card.chatId || card.workflowId) &&
					card.agentId &&
					onCompare && (
						<Button
							variant="outline"
							onClick={() =>
								onCompare(
									card.id,
									card.chatId || card.workflowId!,
									card.agentId
								)
							}
							className="flex items-center gap-2 bg-accent-foreground text-background hover:bg-accent-foreground/90 hover:text-background"
						>
							<GitCompare />
							<span>Compare</span>
						</Button>
					)}

				<div className="flex gap-2">
					{card.chatId || card.workflowId ? (
						<Button
							variant="outline"
							onClick={() =>
								onOpenChat(
									card.chatId || card.workflowId!,
									card.id
								)
							}
							className="flex items-center gap-2 bg-sidebar hover:bg-sidebar/80 cursor-pointer"
						>
							<svg
								width="10"
								height="10"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
								<path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
							</svg>
							<span>Open</span>
						</Button>
					) : (
						<Button
							disabled={
								!card.text.trim() ||
								isStreaming ||
								card.isSending ||
								(card.agentId && !card.agentId) ||
								(!card.agentId &&
									!card.modelId &&
									!selectedModel?.id &&
									!models[0]?.id)
							}
							onClick={() =>
								onSend(
									card.id,
									card.text,
									card.agentId
										? undefined
										: card.modelId ||
												selectedModel?.id ||
												models[0]?.id,
									card.agentId
								)
							}
							className="border border-border hover:bg-sidebar/70 cursor-pointer"
						>
							{card.isSending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								"Send"
							)}
						</Button>
					)}
					<Button
						variant="destructive"
						className="cursor-pointer bg-red-500/35 hover:bg-red-500/40 text-red-500/80 hover:text-red-500 border border-red-500/50"
						onClick={() => onRemove(card.id)}
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
