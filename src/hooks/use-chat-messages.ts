import { useState, useCallback, useRef } from "react";
import { ChatMsg } from "@/types/chat";
import { useQueryClient } from "@tanstack/react-query";
import { useSubnetCache } from "./use-subnet-cache";

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

			const isDuplicateMessage = (
				newMsg: ChatMsg,
				existingMsgs: ChatMsg[]
			) => {
				// DEBUG: Special logging for feedback messages
				if (newMsg.sourceId?.includes("feedback")) {
					console.log(
						`🔍 Checking if feedback message is duplicate:`,
						{
							type: newMsg.type,
							content: newMsg.content?.slice(0, 50),
							sourceId: newMsg.sourceId,
							subnetIndex: newMsg.subnetIndex,
							toolName: newMsg.toolName,
						}
					);
				}

				return existingMsgs.some((existingMsg) => {
					// Special handling for image regeneration - if new message has different image data, it's not a duplicate
					if (newMsg.imageData && existingMsg.imageData) {
						if (newMsg.imageData !== existingMsg.imageData) {
							console.log(
								`🖼️ New image detected for subnet ${newMsg.subnetIndex} - not a duplicate`
							);
							return false;
						}
					}
					// DEBUG: Log comparison details for feedback messages
					if (newMsg.sourceId?.includes("feedback")) {
						console.log(
							`🔍 Comparing feedback message with existing:`,
							{
								newMsg: {
									type: newMsg.type,
									content: newMsg.content?.slice(0, 30),
									sourceId: newMsg.sourceId,
								},
								existingMsg: {
									type: existingMsg.type,
									content: existingMsg.content?.slice(0, 30),
									sourceId: existingMsg.sourceId,
								},
							}
						);
					}

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
							// Check if this is an image regeneration case
							if (newMsg.imageData && existingMsg.imageData && newMsg.imageData !== existingMsg.imageData) {
								console.log(
									`🖼️ Image regeneration detected for subnet ${newMsg.subnetIndex} - not a duplicate`
								);
								return false;
							}
							
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
						newMsg.type === "response" &&
						existingMsg.type === "response"
					) {
						if (
							newMsg.sourceId &&
							existingMsg.sourceId &&
							newMsg.sourceId === existingMsg.sourceId
						) {
							console.log(
								`🔍 Detected duplicate response by sourceId: "${newMsg.sourceId}"`
							);
							if (newMsg.sourceId?.includes("feedback")) {
								console.log(
									`🚫 FEEDBACK MESSAGE MARKED AS DUPLICATE by sourceId!`
								);
							}
							return true;
						}

						if (
							!newMsg.sourceId?.includes("feedback") &&
							!existingMsg.sourceId?.includes("feedback")
						) {
							if (
								newMsg.subnetIndex ===
									existingMsg.subnetIndex &&
								newMsg.toolName === existingMsg.toolName &&
								newMsg.content === existingMsg.content
							) {
								// Check if this is an image regeneration case
								if (newMsg.imageData && existingMsg.imageData && newMsg.imageData !== existingMsg.imageData) {
									console.log(
										`🖼️ Image regeneration detected for subnet ${newMsg.subnetIndex} - not a duplicate`
									);
									return false;
								}
								
								console.log(
									`🔍 Detected duplicate response for subnet ${
										newMsg.subnetIndex
									} (${
										newMsg.toolName
									}): "${newMsg.content?.slice(0, 50)}..."`
								);
								return true;
							}
						}

						// DEBUG: Log when response messages are NOT considered duplicates
						console.log(
							`🔍 Response message NOT considered duplicate:`,
							{
								newMsg: {
									subnetIndex: newMsg.subnetIndex,
									toolName: newMsg.toolName,
									content: newMsg.content?.slice(0, 50),
									sourceId: newMsg.sourceId,
									isFeedback:
										newMsg.sourceId?.includes("feedback"),
								},
								existingMsg: {
									subnetIndex: existingMsg.subnetIndex,
									toolName: existingMsg.toolName,
									content: existingMsg.content?.slice(0, 50),
									sourceId: existingMsg.sourceId,
									isFeedback:
										existingMsg.sourceId?.includes(
											"feedback"
										),
								},
							}
						);

						// Special logging for feedback messages
						if (newMsg.sourceId?.includes("feedback")) {
							console.log(
								`✅ FEEDBACK MESSAGE NOT CONSIDERED DUPLICATE - will be added`
							);
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
						// Check if this is an image regeneration case
						if (newMsg.imageData && existingMsg.imageData && newMsg.imageData !== existingMsg.imageData) {
							console.log(
								`🖼️ Image regeneration detected for subnet ${newMsg.subnetIndex} - not a duplicate`
							);
							return false;
						}
						
						return true;
					}

					// DEBUG: Log final result for feedback messages
					if (newMsg.sourceId?.includes("feedback")) {
						console.log(
							`🔍 Final duplicate check result for feedback message: false (NOT duplicate)`
						);
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

				const isWorkflowCompleted =
					data.workflowStatus === "completed" ||
					data.workflowStatus === "failed" ||
					data.workflowStatus === "stopped";

				const subnetsWithNewFeedbackQuestions = new Set<number>();
				newMessages.forEach((msg) => {
					if (
						msg.type === "question" &&
						msg.questionData?.type === "feedback" &&
						msg.subnetIndex !== undefined
					) {
						subnetsWithNewFeedbackQuestions.add(msg.subnetIndex);
						console.log(
							`🔍 Detected new feedback question for subnet ${msg.subnetIndex}: "${msg.content?.slice(0, 50)}"`
						);
					}
				});

				const filteredMessages = prevMessages.filter((msg) => {
					// DEBUG: Special logging for feedback messages in filtering
					if (msg.sourceId?.includes("feedback")) {
						console.log(`🔍 Filtering feedback message:`, {
							type: msg.type,
							content: msg.content?.slice(0, 50),
							sourceId: msg.sourceId,
							subnetIndex: msg.subnetIndex,
						});
					}

					if (
						msg.type === "workflow_subnet" &&
						msg.subnetIndex !== undefined &&
						subnetsWithNewFeedbackQuestions.has(msg.subnetIndex) &&
						!msg.sourceId?.includes("feedback")
					) {
						console.log(
							`🚫 Removing old workflow_subnet message for subnet ${msg.subnetIndex} - new feedback question detected: "${msg.content?.slice(0, 50)}"`
						);
						return false;
					}

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
							// If workflow is completed, remove all processing/contacting messages
							if (
								isWorkflowCompleted &&
								msg.subnetStatus === "in_progress" &&
								(msg.content.includes("Processing") ||
									msg.content.includes("Contacting") ||
									msg.content.includes("agent..."))
							) {
								console.log(
									`🏁 Removing processing message for subnet ${msg.subnetIndex} - workflow completed`
								);
								return false;
							}

							if (
								msg.content &&
								!msg.content.includes("Processing") &&
								!msg.content.includes("Waiting for") &&
								!msg.content.includes("Queued for") &&
								!msg.content.includes("Contacting")
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
											"awaiting_response")
							);

							// Check if new message has different image data (image regeneration case)
							const hasNewImageData = newMessages.some(
								(newMsg) =>
									newMsg.type === "workflow_subnet" &&
									newMsg.subnetIndex === msg.subnetIndex &&
									newMsg.imageData &&
									msg.imageData &&
									newMsg.imageData !== msg.imageData
							);

							if (hasNewImageData) {
								console.log(
									`🖼️ Removing old image message for subnet ${msg.subnetIndex} - new image data detected`
								);
								return false;
							}

							if (
								msg.subnetStatus === "in_progress" &&
								(msg.content.includes("Processing") ||
									msg.content.includes("Contacting")) &&
								hasNewMessageForSubnet
							) {
								console.log(
									`🔄 Removing processing message for subnet ${msg.subnetIndex} - replaced by new message`
								);
								return false;
							}

							if (
								msg.subnetStatus === "in_progress" &&
								(msg.content.includes("Processing") ||
									msg.content.includes("Contacting")) &&
								!hasNewMessageForSubnet
							) {
								console.log(
									`✅ Keeping processing message for subnet ${msg.subnetIndex}`
								);
								return true;
							}

							if (
								msg.subnetStatus === "awaiting_response" &&
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

				// Count feedback messages in filtered messages
				const filteredFeedbackCount = filteredMessages.filter((msg) =>
					msg.sourceId?.includes("feedback")
				).length;
				console.log(
					`🔍 Feedback messages in filtered messages: ${filteredFeedbackCount}`
				);

				// DEBUG: Special handling for feedback messages
				console.log(
					`🔍 Processing ${newMessages.length} new messages for deduplication`
				);
				newMessages.forEach((msg, idx) => {
					if (msg.sourceId?.includes("feedback")) {
						console.log(`🔍 FEEDBACK MESSAGE ${idx}:`, {
							type: msg.type,
							content: msg.content?.slice(0, 50),
							sourceId: msg.sourceId,
							subnetIndex: msg.subnetIndex,
							toolName: msg.toolName,
						});
					}
				});

				// Count feedback messages
				const feedbackMessageCount = newMessages.filter((msg) =>
					msg.sourceId?.includes("feedback")
				).length;
				console.log(
					`🔍 Total feedback messages to process: ${feedbackMessageCount}`
				);

				// Show all feedback messages that will be processed
				if (feedbackMessageCount > 0) {
					console.log(
						`🔍 FEEDBACK MESSAGES TO PROCESS:`,
						newMessages
							.filter((msg) => msg.sourceId?.includes("feedback"))
							.map((msg, idx) => ({
								index: idx,
								type: msg.type,
								content: msg.content?.slice(0, 50),
								sourceId: msg.sourceId,
								subnetIndex: msg.subnetIndex,
								toolName: msg.toolName,
							}))
					);
				}

				// Process each feedback message individually to see what happens
				const feedbackMessages = newMessages.filter((msg) =>
					msg.sourceId?.includes("feedback")
				);
				feedbackMessages.forEach((feedbackMsg, idx) => {
					const isDuplicate = isDuplicateMessage(
						feedbackMsg,
						filteredMessages
					);
					console.log(`🔍 Feedback message ${idx} duplicate check:`, {
						type: feedbackMsg.type,
						content: feedbackMsg.content?.slice(0, 50),
						sourceId: feedbackMsg.sourceId,
						subnetIndex: feedbackMsg.subnetIndex,
						isDuplicate,
						willBeAdded: !isDuplicate,
					});
				});

				const uniqueNewMessages = newMessages.filter(
					(newMsg) => !isDuplicateMessage(newMsg, filteredMessages)
				);

				console.log(
					`📝 Adding ${uniqueNewMessages.length} unique new messages`
				);

				// DEBUG: Log which messages are being filtered out as duplicates
				const duplicateMessages = newMessages.filter((newMsg) =>
					isDuplicateMessage(newMsg, filteredMessages)
				);

				if (duplicateMessages.length > 0) {
					console.log(
						`🚫 Filtered out ${duplicateMessages.length} duplicate messages:`,
						duplicateMessages.map((msg) => ({
							type: msg.type,
							content: msg.content?.slice(0, 50),
							sourceId: msg.sourceId,
							subnetIndex: msg.subnetIndex,
							isFeedback: msg.sourceId?.includes("feedback"),
						}))
					);

					// Special debugging for feedback messages that are filtered out
					const duplicateFeedbackMessages = duplicateMessages.filter(
						(msg) => msg.sourceId?.includes("feedback")
					);
					if (duplicateFeedbackMessages.length > 0) {
						console.log(
							`🚫 FEEDBACK MESSAGES FILTERED OUT:`,
							duplicateFeedbackMessages.map((msg) => ({
								type: msg.type,
								content: msg.content?.slice(0, 50),
								sourceId: msg.sourceId,
								subnetIndex: msg.subnetIndex,
								toolName: msg.toolName,
							}))
						);
					}
				}

				// DEBUG: Log which messages are being added
				uniqueNewMessages.forEach((msg, idx) => {
					console.log(`🔍 ADDING MESSAGE ${idx}:`, {
						type: msg.type,
						toolName: msg.toolName,
						subnetIndex: msg.subnetIndex,
						sourceId: msg.sourceId,
						contentPreview: msg.content?.slice(0, 50),
						isFeedback: msg.sourceId?.includes("feedback"),
					});
				});

				// Special debugging for feedback messages that are being added
				const addedFeedbackMessages = uniqueNewMessages.filter((msg) =>
					msg.sourceId?.includes("feedback")
				);
				if (addedFeedbackMessages.length > 0) {
					console.log(
						`✅ FEEDBACK MESSAGES BEING ADDED:`,
						addedFeedbackMessages.map((msg) => ({
							type: msg.type,
							content: msg.content?.slice(0, 50),
							sourceId: msg.sourceId,
							subnetIndex: msg.subnetIndex,
							toolName: msg.toolName,
						}))
					);
				} else {
					console.log(
						`⚠️ NO FEEDBACK MESSAGES BEING ADDED after deduplication!`
					);
				}

				let messagesWithoutCompletion = filteredMessages;
				let completionMessage = null;

				const completionIndex = filteredMessages.findIndex(
					(msg) => msg.content === "Workflow executed successfully"
				);
				if (completionIndex !== -1) {
					completionMessage = filteredMessages[completionIndex];
					messagesWithoutCompletion = [
						...filteredMessages.slice(0, completionIndex),
						...filteredMessages.slice(completionIndex + 1),
					];
					console.log(
						`🔄 Extracted completion message to move to end`
					);
				}

				// Add new messages
				const messagesWithNew = [
					...messagesWithoutCompletion,
					...uniqueNewMessages,
				];

				// DEBUG: Check message ordering for feedback messages
				console.log(`🔍 Message ordering check:`, {
					messagesWithoutCompletionCount:
						messagesWithoutCompletion.length,
					uniqueNewMessagesCount: uniqueNewMessages.length,
					messagesWithNewCount: messagesWithNew.length,
					feedbackMessagesInNew: uniqueNewMessages.filter((msg) =>
						msg.sourceId?.includes("feedback")
					).length,
					feedbackMessagesInExisting:
						messagesWithoutCompletion.filter((msg) =>
							msg.sourceId?.includes("feedback")
						).length,
				});

				// Add completion message back at the very end if it exists
				const finalMessages = completionMessage
					? [...messagesWithNew, completionMessage]
					: messagesWithNew;

				console.log(
					`📝 Appended ${
						uniqueNewMessages.length
					} new messages to end of chat${
						completionMessage
							? " (completion message moved to final position)"
							: ""
					}`
				);

				// DEBUG: Log final message structure
				console.log(
					`🔍 Final message structure:`,
					finalMessages.map((msg, idx) => ({
						index: idx,
						type: msg.type,
						content: msg.content?.slice(0, 50),
						sourceId: msg.sourceId,
						subnetIndex: msg.subnetIndex,
						isFeedback: msg.sourceId?.includes("feedback"),
					}))
				);

				// Special debugging for feedback messages in final structure
				const finalFeedbackMessages = finalMessages.filter((msg) =>
					msg.sourceId?.includes("feedback")
				);
				if (finalFeedbackMessages.length > 0) {
					console.log(
						`✅ FEEDBACK MESSAGES IN FINAL STRUCTURE:`,
						finalFeedbackMessages.map((msg, idx) => ({
							index: finalMessages.indexOf(msg),
							type: msg.type,
							content: msg.content?.slice(0, 50),
							sourceId: msg.sourceId,
							subnetIndex: msg.subnetIndex,
							toolName: msg.toolName,
						}))
					);
					console.log(
						`✅ Total feedback messages in final structure: ${finalFeedbackMessages.length}`
					);
				} else {
					console.log(`⚠️ NO FEEDBACK MESSAGES IN FINAL STRUCTURE!`);
					console.log(
						`⚠️ This means feedback messages were either filtered out or not generated!`
					);
				}

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

				// Final detailed check of all messages
				console.log(
					`🔍 COMPLETE FINAL MESSAGE STRUCTURE:`,
					finalMessages.map((msg, idx) => ({
						index: idx,
						type: msg.type,
						content: msg.content?.slice(0, 100),
						sourceId: msg.sourceId,
						subnetIndex: msg.subnetIndex,
						toolName: msg.toolName,
						timestamp: msg.timestamp,
						isFeedback: msg.sourceId?.includes("feedback"),
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
