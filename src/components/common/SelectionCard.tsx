"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, X } from "lucide-react";
import ModelSelectDialog from "@/components/common/ModelSelectDialog";

interface SelectionCard {
	id: string;
	text: string;
	modelId?: string;
	chatId?: string;
	isSending?: boolean;
	isCollapsed?: boolean;
}

interface SelectionCardProps {
	card: SelectionCard;
	models: any[];
	selectedModel: any;
	isStreaming: boolean;
	onTextChange: (cardId: string, text: string) => void;
	onModelChange: (cardId: string, modelId: string) => void;
	onSend: (cardId: string, text: string, modelId: string) => void;
	onOpenChat: (chatId: string) => void;
	onRemove: (cardId: string) => void;
	onToggleCollapse: (cardId: string) => void;
}

export default function SelectionCardComponent({
	card,
	models,
	selectedModel,
	isStreaming,
	onTextChange,
	onModelChange,
	onSend,
	onOpenChat,
	onRemove,
	onToggleCollapse,
}: SelectionCardProps) {
	const isCollapsed = card.isCollapsed ?? true;

	if (isCollapsed) {
		return (
			<div className="flex justify-end">
				<button
					onClick={() => onToggleCollapse(card.id)}
					className="mr-2 group relative w-12 h-12 bg-background border border-border rounded-full shadow-sm backdrop-blur hover:shadow-md transition-all duration-200 hover:scale-105 flex items-center justify-center"
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
						className="text-muted-foreground group-hover:text-foreground transition-colors"
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
					{card.chatId && !card.isSending && (
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
				<div className="space-y-0.5">
					<Label className="text-xs font-normal">Model</Label>
					<div className="mt-1">
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
														m.id === card.modelId
												)?.name || card.modelId,
									  } as any)
									: null
							}
							disableGlobalSync={true}
							onChange={(m) => onModelChange(card.id, m.id)}
						/>
					</div>
				</div>

				<div className="flex gap-2">
					{card.chatId ? (
						<Button
							variant="outline"
							onClick={() => onOpenChat(card.chatId!)}
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
								card.isSending
							}
							onClick={() =>
								onSend(
									card.id,
									card.text,
									card.modelId ||
										selectedModel?.id ||
										models[0]?.id
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
