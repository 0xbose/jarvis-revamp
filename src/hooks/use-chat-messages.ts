import { useState, useCallback, useRef } from "react";
import { ChatMsg } from "@/types/chat";
import { useQueryClient } from "@tanstack/react-query";
import { useSubnetCache } from "./use-subnet-cache";
import { processAndDeduplicateMessages } from "@/utils/message-deduplication";

export const useChatMessages = () => {
	const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
	const [pendingNotifications, setPendingNotifications] = useState<ChatMsg[]>(
		[]
	);

	const queryClient = useQueryClient();
	const currentWorkflowId = useRef<string | null>(null);
	const lastQuestionRef = useRef<string | null>(null);
	
	// Use the subnet cache hook as the brain for subnet processing
	const {
		processSubnetData,
		clearWorkflowCache,
		clearWorkflowTracking,
		getCachedSubnets,
	} = useSubnetCache();

	const safeSetChatMessages = useCallback(
		(messages: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])) => {
			setChatMessages(messages);
		},
		[]
	);

	const setChatMessagesWithWorkflowCheck = useCallback(
		(
			messages: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[]),
			workflowId?: string
		) => {
			if (
				workflowId &&
				currentWorkflowId.current &&
				workflowId !== currentWorkflowId.current
			) {
				console.warn(
					`⚠️ Attempting to set messages for different workflow: ${workflowId} vs ${currentWorkflowId.current}`
				);
				return;
			}
			setChatMessages(messages);
		},
		[]
	);

	const updateMessagesWithSubnetData = useCallback(
		(
			data: any,
			lastQuestionRef: React.MutableRefObject<string | null>,
			options: {
				includeHistory?: boolean;
				isExistingWorkflow?: boolean;
				initializeCacheOnly?: boolean;
			} = {}
		) => {
			const workflowId =
				data.requestId || data.workflowId || `workflow_${Date.now()}`;

			console.log(
				`🔄 Processing workflow: ${workflowId}, Current: ${currentWorkflowId.current}`,
				`Options:`,
				options
			);

			if (
				currentWorkflowId.current &&
				currentWorkflowId.current !== workflowId
			) {
							console.log(
				`🔄 Switching workflows: ${currentWorkflowId.current} -> ${workflowId}`
			);
			clearWorkflowCache(currentWorkflowId.current);
			clearWorkflowTracking(currentWorkflowId.current);
			}

			currentWorkflowId.current = workflowId;

			const newMessages = processSubnetData(
				workflowId,
				data.subnets,
				lastQuestionRef,
				options
			);

			// If we're only initializing cache, don't process messages further
			if (options.initializeCacheOnly) {
				console.log(
					`🔧 Cache initialization complete for workflow ${workflowId} - skipping message processing`
				);
				return;
			}

			console.log(`🔍 Subnet data processing results:`, {
				subnetCount: data.subnets?.length || 0,
				newMessageCount: newMessages.length,
				newMessageTypes: newMessages.map((msg) => ({
					type: msg.type,
					content: msg.content?.slice(0, 50),
					subnetIndex: msg.subnetIndex,
					toolName: msg.toolName,
					sourceId: msg.sourceId,
				})),
			});

			// DEBUG: Log detailed information about new messages
			newMessages.forEach((msg, idx) => {
				console.log(
					`🔍 NEW MESSAGE ${idx} for subnet ${msg.subnetIndex}:`,
					{
						type: msg.type,
						toolName: msg.toolName,
						sourceId: msg.sourceId,
						contentPreview: msg.content?.slice(0, 100),
						timestamp: msg.timestamp,
						isFeedbackMessage: msg.sourceId?.includes("feedback"),
					}
				);
			});



			setChatMessages((prevMessages) => {
				console.log(
					`🔄 Updating chat messages. Current: ${prevMessages.length}, New: ${newMessages.length}`
				);

				const messageTypes = prevMessages.map((msg) => ({
					type: msg.type,
					content: msg.content?.slice(0, 30),
				}));
				console.log(`📋 Current message types:`, messageTypes);

				// Use utility function for message processing and deduplication
				const { filteredMessages, uniqueNewMessages, finalMessages } = processAndDeduplicateMessages(
					prevMessages,
					newMessages,
					data.workflowStatus
				);

				// Return the processed messages from the utility function
				return finalMessages;
			});

			const notificationMessages = newMessages.filter(
				(msg) => msg.type === "notification"
			);
			if (notificationMessages.length > 0) {
				setPendingNotifications((prev) => [
					...prev,
					...notificationMessages,
				]);
			}
		},
		[queryClient]
	);

	const clearMessages = useCallback(() => {
		console.log(
			`🗑️ Clearing all messages. Current count: ${chatMessages.length}`
		);
		setChatMessages([]);
		setPendingNotifications([]);

		if (currentWorkflowId.current) {
			console.log(
				`🗑️ Clearing workflow tracking and cache for: ${currentWorkflowId.current}`
			);
			clearWorkflowCache(currentWorkflowId.current);
			clearWorkflowTracking(currentWorkflowId.current);

			import("@/utils/chat-utils").then(({ clearChatCache }) => {
				clearChatCache(currentWorkflowId.current!, queryClient);
			});

			currentWorkflowId.current = null;
		}
	}, [queryClient, chatMessages.length]);

	const resetFeedbackState = useCallback(() => {
		console.log("🔄 Resetting feedback state");

		setPendingNotifications([]);
	}, []);

	const getCurrentWorkflowSubnets = useCallback(() => {
		if (!currentWorkflowId.current) return new Map();
		return getCachedSubnets(currentWorkflowId.current) || new Map();
	}, [getCachedSubnets]);

	const setWorkflowId = useCallback(
		(workflowId: string) => {
			console.log(
				`🔄 Setting workflow ID: ${workflowId}, Current: ${currentWorkflowId.current}`
			);

			if (
				currentWorkflowId.current &&
				currentWorkflowId.current !== workflowId
			) {
				console.log(
					`🔄 Clearing previous workflow: ${currentWorkflowId.current}`
				);
				clearWorkflowCache(currentWorkflowId.current);
				clearWorkflowTracking(currentWorkflowId.current);
			}

			currentWorkflowId.current = workflowId;
			console.log(`✅ Workflow ID set to: ${workflowId}`);
		},
		[queryClient]
	);

	return {
		chatMessages,
		setChatMessages,
		safeSetChatMessages,
		setChatMessagesWithWorkflowCheck,
		pendingNotifications,
		setPendingNotifications,
		updateMessagesWithSubnetData,
		clearMessages,
		resetFeedbackState,
		getCurrentWorkflowSubnets,
		setWorkflowId,
		currentWorkflowId: currentWorkflowId.current,
	};
};
