"use client";

import React, { useRef } from "react";
import { ChatMessagesGrouped } from "./chat-messages-grouped";
import ChatInput from "./chat-input";
import ChatSkeleton from "./chat-skeleton";
import { Skeleton } from "../ui/skeleton";
import { ChatMsg } from "@/types/chat";

interface ChatMessagesContainerProps {
	// Core data
	chatMessages: ChatMsg[];
	urlWorkflowId?: string;
	currentWorkflowData?: any;
	workflowStatus?:
		| "running"
		| "stopped"
		| "completed"
		| "failed"
		| "awaiting_response"
		| "in_progress"
		| "waiting"
		| "pending";
	completedFeedback: Set<number>;
	pendingNotifications: ChatMsg[];
	pollingStoppedAt?: Date | null;
	isShowingCachedMessages: boolean;
	selectedAgent?: any;

	// Callbacks
	onNotificationYes: (notification: any) => Promise<void>;
	onNotificationNo: (notification: any) => Promise<void>;
	onFeedbackProceed: (question: string, answer: string) => Promise<void>;
	onFeedbackSubmit: (
		question: string,
		answer: string,
		feedback: string
	) => Promise<void>;
	onRefreshPolling: () => void;
	onSend: (message: string) => void;
	onStop?: () => void;
	onResume?: () => void;
	onRetrySubnet?: (subnetIndex: number) => Promise<void>;

	// Chat input state
	mode?: "chat" | "agent";
	setMode?: (mode: "chat" | "agent") => void;
	prompt: string;
	setPrompt: (prompt: string) => void;

	// Execution state
	isExecuting?: boolean;
	isSubmittingFeedback?: boolean;
	currentExecution?: any;
	retryingSubnetIndex?: number | null;

	// UI options
	showChatInput?: boolean;
	showSkeleton?: boolean;
	shouldShowSkeleton?: () => boolean;
	isReadOnly?: boolean;

	// Layout options
	containerClassName?: string;
	messagesContainerClassName?: string;
	inputContainerClassName?: string;

	// Scroll handling
	chatContainerRef?: React.RefObject<HTMLDivElement>;
	messagesEndRef?: React.RefObject<HTMLDivElement>;
	handleScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

export function ChatMessagesContainer({
	// Core data
	chatMessages,
	urlWorkflowId,
	currentWorkflowData,
	workflowStatus,
	completedFeedback,
	pendingNotifications,
	pollingStoppedAt,
	isShowingCachedMessages,
	selectedAgent,

	// Callbacks
	onNotificationYes,
	onNotificationNo,
	onFeedbackProceed,
	onFeedbackSubmit,
	onRefreshPolling,
	onSend,
	onStop,
	onResume,
	onRetrySubnet,

	// Chat input state
	mode,
	setMode,
	prompt,
	setPrompt,

	// Execution state
	isExecuting = false,
	isSubmittingFeedback = false,
	currentExecution,
	retryingSubnetIndex,

	// UI options
	showChatInput = true,
	showSkeleton = true,
	shouldShowSkeleton,
	isReadOnly = false,

	// Layout options
	containerClassName = "relative w-full h-full flex flex-col",
	messagesContainerClassName = "flex-1 pt-8 md:pt-4 md:p-4 pb-20 min-h-0 w-full overflow-y-auto scrollbar-hide h-[calc(100vh-8rem)] md:h-[calc(100vh-11rem)]",
	inputContainerClassName = "absolute bottom-4 left-0 right-0 px-4",

	// Scroll handling
	chatContainerRef,
	messagesEndRef,
	handleScroll,
}: ChatMessagesContainerProps) {
	// Default refs if not provided
	const defaultChatContainerRef = useRef<HTMLDivElement>(null);
	const defaultMessagesEndRef = useRef<HTMLDivElement>(null);

	const finalChatContainerRef = chatContainerRef || defaultChatContainerRef;
	const finalMessagesEndRef = messagesEndRef || defaultMessagesEndRef;

	// Determine if we should show skeleton
	const shouldShowSkeletonContent = shouldShowSkeleton
		? shouldShowSkeleton()
		: false;

	return (
		<div className={containerClassName}>
			{chatMessages.length === 0 ? (
				showSkeleton ? (
					<div className="w-full p-4 pt-8 md:pt-4 md:px-6 mx-auto max-w-7xl">
						<ChatSkeleton />
					</div>
				) : null
			) : (
				<div>
					<div className={messagesContainerClassName}>
						<div
							ref={finalChatContainerRef}
							className="flex flex-col gap-4 px-4 md:px-6 mx-auto max-w-7xl"
							onScroll={handleScroll}
						>
							<ChatMessagesGrouped
								messages={chatMessages}
								urlWorkflowId={urlWorkflowId}
								currentWorkflowData={currentWorkflowData}
								workflowStatus={workflowStatus}
								completedFeedback={completedFeedback}
								pendingNotifications={pendingNotifications}
								pollingStoppedAt={pollingStoppedAt}
								onNotificationYes={onNotificationYes}
								onNotificationNo={onNotificationNo}
								onFeedbackProceed={onFeedbackProceed}
								onFeedbackSubmit={onFeedbackSubmit}
								onRefreshPolling={onRefreshPolling}
								selectedAgent={selectedAgent}
								isReadOnly={isReadOnly}
								onRetrySubnet={onRetrySubnet}
								retryingSubnetIndex={retryingSubnetIndex}
							/>

							{shouldShowSkeletonContent && (
								<div className="space-y-2">
									<div className="py-3 rounded-md space-y-2">
										<Skeleton className="h-4 w-36" />
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-20 w-full" />
										<div className="flex items-center space-x-2 mt-2">
											<Skeleton className="h-4 w-20 rounded" />
											<Skeleton className="h-4 w-12" />
										</div>
									</div>
									<div className="py-3 rounded-md space-y-2">
										<Skeleton className="h-4 w-36" />
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-20 w-full" />
										<div className="flex items-center space-x-2 mt-2">
											<Skeleton className="h-4 w-20 rounded" />
											<Skeleton className="h-4 w-12" />
										</div>
									</div>
								</div>
							)}
							<div ref={finalMessagesEndRef} />
						</div>
					</div>
				</div>
			)}

			{showChatInput && (
				<div className={`${inputContainerClassName} mx-auto max-w-7xl`}>
					<ChatInput
						onSend={onSend}
						onStop={onStop}
						onResume={onResume}
						mode={mode || "chat"}
						setMode={setMode || (() => {})}
						prompt={prompt}
						setPrompt={setPrompt}
						hideModeSelection={true}
						disableAgentSelection={true}
						isExecuting={
							(workflowStatus === "stopped"
								? false
								: isExecuting) ||
							isSubmittingFeedback ||
							(workflowStatus === "stopped"
								? false
								: currentExecution?.workflowStatus ===
								  "in_progress") ||
							(workflowStatus === "stopped"
								? false
								: currentExecution?.workflowStatus ===
								  "pending") ||
							(workflowStatus === "stopped"
								? false
								: currentExecution?.workflowStatus ===
								  "awaiting_response")
						}
						workflowStatus={
							workflowStatus === "stopped"
								? "stopped"
								: currentWorkflowData?.workflowStatus ===
								  "awaiting_response"
								? "awaiting_response"
								: workflowStatus === "pending"
								? undefined
								: workflowStatus
						}
					/>
				</div>
			)}
		</div>
	);
}
