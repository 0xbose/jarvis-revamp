import { useState, useCallback, useRef } from "react";
import { ChatMsg } from "@/types/chat";
import { useSubnetCache } from "./use-subnet-cache";

export const useChatMessages = () => {
	const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
	const [pendingNotifications, setPendingNotifications] = useState<ChatMsg[]>(
		[]
	);

	const {
		processSubnetData,
		clearWorkflowCache,
		clearWorkflowTracking,
		getCachedSubnets,
	} = useSubnetCache();

	const currentWorkflowId = useRef<string | null>(null);

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
				clearWorkflowTracking(currentWorkflowId.current);
				clearWorkflowCache(currentWorkflowId.current);
			}

			currentWorkflowId.current = workflowId;

			const newMessages = processSubnetData(
				workflowId,
				data.subnets,
				lastQuestionRef,
				options
			);

			console.log(`🔍 Subnet data processing results:`, {
				subnetCount: data.subnets?.length || 0,
				newMessageCount: newMessages.length,
				newMessageTypes: newMessages.map((msg) => ({
					type: msg.type,
					content: msg.content?.slice(0, 50),
				})),
			});

			const isDuplicateMessage = (
				newMsg: ChatMsg,
				existingMsgs: ChatMsg[]
			) => {
				return existingMsgs.some((existingMsg) => {
					if (
						(newMsg.type === "workflow_subnet" &&
							existingMsg.type === "response") ||
						(newMsg.type === "response" &&
							existingMsg.type === "workflow_subnet")
					) {
						if (
							newMsg.subnetIndex === existingMsg.subnetIndex &&
							newMsg.content &&
							existingMsg.content &&
							(newMsg.content.includes(
								existingMsg.content.slice(0, 100)
							) ||
								existingMsg.content.includes(
									newMsg.content.slice(0, 100)
								))
						) {
							console.log(
								`🔍 Detected potential duplicate between ${newMsg.type} and ${existingMsg.type} for subnet ${newMsg.subnetIndex}`
							);
							return true;
						}
					}

					// Handle question message duplicates
					if (
						newMsg.type === "question" &&
						existingMsg.type === "question"
					) {
						if (
							newMsg.subnetIndex === existingMsg.subnetIndex &&
							newMsg.content === existingMsg.content &&
							newMsg.questionData?.text ===
								existingMsg.questionData?.text
						) {
							console.log(
								`🔍 Detected duplicate question for subnet ${newMsg.subnetIndex}: "${newMsg.content}"`
							);
							return true;
						}
					}

					// Handle answer message duplicates
					if (
						newMsg.type === "answer" &&
						existingMsg.type === "answer"
					) {
						if (
							newMsg.subnetIndex === existingMsg.subnetIndex &&
							newMsg.content === existingMsg.content
						) {
							console.log(
								`🔍 Detected duplicate answer for subnet ${newMsg.subnetIndex}: "${newMsg.content}"`
							);
							return true;
						}
					}

					if (
						newMsg.type !== "workflow_subnet" ||
						existingMsg.type !== "workflow_subnet"
					) {
						return false;
					}

					if (
						newMsg.subnetIndex === existingMsg.subnetIndex &&
						newMsg.toolName === existingMsg.toolName &&
						newMsg.subnetStatus === existingMsg.subnetStatus &&
						newMsg.content === existingMsg.content
					) {
						return true;
					}

					return false;
				});
			};

			setChatMessages((prevMessages) => {
				console.log(
					`🔄 Updating chat messages. Current: ${prevMessages.length}, New: ${newMessages.length}`
				);

				const messageTypes = prevMessages.map((msg) => ({
					type: msg.type,
					content: msg.content?.slice(0, 30),
				}));
				console.log(`📋 Current message types:`, messageTypes);

				const filteredMessages = prevMessages.filter((msg) => {
					if (msg.type === "user" || msg.type === "response") {
						console.log(
							`✅ Keeping ${
								msg.type
							} message: "${msg.content?.slice(0, 50)}..."`
						);
						return true;
					}

					if (
						msg.type === "question" ||
						msg.type === "notification"
					) {
						console.log(
							`✅ Keeping ${
								msg.type
							} message: "${msg.content?.slice(0, 50)}..."`
						);
						return true;
					}

					if (msg.type === "workflow_subnet") {
						if (msg.subnetIndex !== undefined) {
							if (
								msg.content &&
								!msg.content.includes("Processing") &&
								!msg.content.includes("Waiting for") &&
								!msg.content.includes("Queued for")
							) {
								console.log(
									`✅ Keeping subnet response ${
										msg.subnetIndex
									}: "${msg.content?.slice(0, 50)}..."`
								);
								return true;
							}

							const hasNewMessageForSubnet = newMessages.some(
								(newMsg) =>
									newMsg.type === "workflow_subnet" &&
									newMsg.subnetIndex === msg.subnetIndex &&
									(newMsg.subnetStatus === "done" ||
										newMsg.subnetStatus ===
											"waiting_response")
							);

							if (
								msg.subnetStatus === "in_progress" &&
								msg.content.includes("Processing") &&
								hasNewMessageForSubnet
							) {
								console.log(
									`🔄 Removing processing message for subnet ${msg.subnetIndex} - replaced by new message`
								);
								return false;
							}

							if (
								msg.subnetStatus === "in_progress" &&
								msg.content.includes("Processing") &&
								!hasNewMessageForSubnet
							) {
								console.log(
									`✅ Keeping processing message for subnet ${msg.subnetIndex}`
								);
								return true;
							}

							if (
								msg.subnetStatus === "waiting_response" &&
								msg.content.includes("Waiting for")
							) {
								console.log(
									`✅ Keeping waiting response message for subnet ${msg.subnetIndex}`
								);
								return true;
							}

							if (
								msg.subnetStatus === "pending" &&
								msg.content.includes("Queued for")
							) {
								console.log(
									`✅ Keeping pending message for subnet ${msg.subnetIndex}`
								);
								return true;
							}

							if (
								msg.subnetStatus === "pending" &&
								msg.content &&
								!msg.content.includes("Queued for")
							) {
								console.log(
									`✅ Keeping pending message with data for subnet ${
										msg.subnetIndex
									}: "${msg.content?.slice(0, 50)}..."`
								);
								return true;
							}

							if (msg.subnetStatus === "pending") {
								console.log(
									`🔍 Pending message debug for subnet ${msg.subnetIndex}:`,
									{
										content: msg.content?.slice(0, 100),
										includesQueued:
											msg.content?.includes("Queued for"),
										willKeep:
											msg.content &&
											!msg.content.includes("Queued for"),
									}
								);
							}

							console.log(
								`🗑️ Removing old status update for subnet ${msg.subnetIndex}: "${msg.content}"`
							);
							return false;
						}

						console.log(
							`✅ Keeping global subnet message: "${msg.content?.slice(
								0,
								50
							)}..."`
						);
						return true;
					}

					console.log(
						`✅ Keeping ${msg.type} message: "${msg.content?.slice(
							0,
							50
						)}..."`
					);
					return true;
				});

				console.log(
					`📊 After filtering: ${filteredMessages.length} messages preserved`
				);

				const uniqueNewMessages = newMessages.filter(
					(newMsg) => !isDuplicateMessage(newMsg, filteredMessages)
				);

				console.log(
					`📝 Adding ${uniqueNewMessages.length} unique new messages`
				);

				// Simple append: always add new messages to the end for natural chat flow
				const finalMessages = [
					...filteredMessages,
					...uniqueNewMessages,
				];

				console.log(
					`📝 Appended ${uniqueNewMessages.length} new messages to end of chat`
				);

				if (finalMessages.length === 0 && prevMessages.length > 0) {
					console.warn(
						`⚠️ All messages were filtered out! Keeping original messages.`
					);
					return prevMessages;
				}

				console.log(`✅ Final message count: ${finalMessages.length}`);
				console.log(
					`🔍 Final message types:`,
					finalMessages.map((msg) => ({
						type: msg.type,
						content: msg.content?.slice(0, 50),
						subnetStatus: msg.subnetStatus,
						toolName: msg.toolName,
					}))
				);
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
		[processSubnetData, clearWorkflowCache, clearWorkflowTracking]
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
			clearWorkflowTracking(currentWorkflowId.current);
			clearWorkflowCache(currentWorkflowId.current);

			import("@/utils/chat-utils").then(({ clearChatCache }) => {
				clearChatCache(currentWorkflowId.current!);
			});

			currentWorkflowId.current = null;
		}
	}, [clearWorkflowTracking, clearWorkflowCache, chatMessages.length]);

	const resetFeedbackState = useCallback(() => {
		console.log("🔄 Resetting feedback state");

		setPendingNotifications([]);
	}, []);

	const getCurrentWorkflowSubnets = useCallback(() => {
		if (!currentWorkflowId.current) return new Map();
		return getCachedSubnets(currentWorkflowId.current);
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
				clearWorkflowTracking(currentWorkflowId.current);
				clearWorkflowCache(currentWorkflowId.current);
			}

			currentWorkflowId.current = workflowId;
			console.log(`✅ Workflow ID set to: ${workflowId}`);
		},
		[clearWorkflowTracking, clearWorkflowCache]
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
