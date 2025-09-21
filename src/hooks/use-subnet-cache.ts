import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChatMsg } from "@/types/chat";
import { parseAgentResponse, createContentHash } from "@/utils/message-parser";

// Query keys for subnet caching with TanStack Query
export const subnetQueryKeys = {
	subnets: (workflowId: string) => ["subnets", workflowId] as const,
	subnetData: (workflowId: string, subnetIndex: number) =>
		["subnets", workflowId, "data", subnetIndex] as const,
	subnetStatus: (workflowId: string) =>
		["subnets", workflowId, "status"] as const,
};

// Subnet data interface for caching
export interface CachedSubnetData {
	itemID: number;
	toolName: string;
	status: "pending" | "in_progress" | "done" | "failed" | "awaiting_response";
	data: any;
	prompt: string | null;
	question?: {
		type: string;
		text: string;
		itemID: number;
		expiresAt: string;
	};
	feedbackHistory?: any[];
	timestamp: number;
}

const detectDataDuplication = (
	subnet: any
): { hasDuplication: boolean; details: string } => {
	if (
		!subnet.data ||
		!subnet.feedbackHistory ||
		subnet.feedbackHistory.length === 0
	) {
		return {
			hasDuplication: false,
			details: "No potential for duplication",
		};
	}

	try {
		const subnetDataContent =
			typeof subnet.data === "string"
				? subnet.data
				: JSON.stringify(subnet.data);
		const feedbackContent =
			subnet.feedbackHistory[0]?.response?.message || "";

		const subnetPreview = subnetDataContent.slice(0, 200);
		const feedbackPreview = feedbackContent.slice(0, 200);

		const similarity =
			subnetPreview.includes(feedbackPreview) ||
			feedbackPreview.includes(subnetPreview);

		return {
			hasDuplication: similarity,
			details: `Subnet data: ${subnetPreview}... | Feedback: ${feedbackPreview}...`,
		};
	} catch (error) {
		return { hasDuplication: false, details: "Error checking duplication" };
	}
};

export const useSubnetCache = () => {
	const queryClient = useQueryClient();

	const subnetPreviousStatus = useRef<Map<string, Map<number, string>>>(
		new Map()
	);
	const feedbackGivenForSubnet = useRef<Map<string, Set<number>>>(new Map());
	const postFeedbackProcessing = useRef<Map<string, Map<number, boolean>>>(
		new Map()
	);
	const generatedMessageIds = useRef<Map<string, Set<string>>>(new Map());

	// TanStack Query-based subnet caching functions
	const cacheSubnetData = useCallback(
		(workflowId: string, subnetIndex: number, subnetData: any) => {
			const cachedData: CachedSubnetData = {
				itemID: subnetData.itemID || subnetIndex,
				toolName: subnetData.toolName,
				status: subnetData.status,
				data: subnetData.data,
				prompt: subnetData.prompt,
				question: subnetData.question,
				feedbackHistory: subnetData.feedbackHistory,
				timestamp: Date.now(),
			};

			// Store individual subnet data
			queryClient.setQueryData(
				subnetQueryKeys.subnetData(workflowId, subnetIndex),
				cachedData
			);

			// Update the full subnets map
			queryClient.setQueryData(
				subnetQueryKeys.subnets(workflowId),
				(oldSubnets: Map<number, CachedSubnetData> = new Map()) => {
					const newSubnets = new Map(oldSubnets);
					newSubnets.set(subnetIndex, cachedData);
					return newSubnets;
				}
			);
		},
		[queryClient]
	);

	const getCachedSubnetData = useCallback(
		(
			workflowId: string,
			subnetIndex: number
		): CachedSubnetData | undefined => {
			return queryClient.getQueryData(
				subnetQueryKeys.subnetData(workflowId, subnetIndex)
			);
		},
		[queryClient]
	);

	const hasSubnetChanged = useCallback(
		(workflowId: string, subnetIndex: number, newData: any): boolean => {
			const cached = getCachedSubnetData(workflowId, subnetIndex);

			if (!cached) {
				return true; // New subnet, consider it changed
			}

			// Simple comparison based on status and data
			return (
				cached.status !== newData.status ||
				JSON.stringify(cached.data) !== JSON.stringify(newData.data) ||
				JSON.stringify(cached.question) !==
					JSON.stringify(newData.question)
			);
		},
		[getCachedSubnetData]
	);

	const clearWorkflowCache = useCallback(
		(workflowId: string) => {
			queryClient.removeQueries({
				queryKey: subnetQueryKeys.subnets(workflowId),
			});
			queryClient.removeQueries({
				predicate: (query) =>
					Array.isArray(query.queryKey) &&
					query.queryKey[0] === "subnets" &&
					query.queryKey[1] === workflowId,
			});
		},
		[queryClient]
	);

	const getCachedSubnets = useCallback(
		(workflowId: string): Map<number, CachedSubnetData> | undefined => {
			return queryClient.getQueryData(
				subnetQueryKeys.subnets(workflowId)
			);
		},
		[queryClient]
	);

	const updateSubnetStatus = useCallback(
		(
			workflowId: string,
			subnetIndex: number,
			status: string,
			data: any = null
		) => {
			const cached = getCachedSubnetData(workflowId, subnetIndex);
			if (cached) {
				const updatedData = {
					...cached,
					status: status as CachedSubnetData["status"],
					data: data || cached.data,
					timestamp: Date.now(),
				};

				queryClient.setQueryData(
					subnetQueryKeys.subnetData(workflowId, subnetIndex),
					updatedData
				);
			}
		},
		[getCachedSubnetData, queryClient]
	);

	const getWorkflowMaps = useCallback((workflowId: string) => {
		if (!subnetPreviousStatus.current.has(workflowId)) {
			subnetPreviousStatus.current.set(workflowId, new Map());
		}
		if (!feedbackGivenForSubnet.current.has(workflowId)) {
			feedbackGivenForSubnet.current.set(workflowId, new Set());
		}
		if (!postFeedbackProcessing.current.has(workflowId)) {
			postFeedbackProcessing.current.set(workflowId, new Map());
		}
		if (!generatedMessageIds.current.has(workflowId)) {
			generatedMessageIds.current.set(workflowId, new Set());
		}

		return {
			statusMap: subnetPreviousStatus.current.get(workflowId)!,
			feedbackSet: feedbackGivenForSubnet.current.get(workflowId)!,
			processingMap: postFeedbackProcessing.current.get(workflowId)!,
			messageIds: generatedMessageIds.current.get(workflowId)!,
		};
	}, []);

	const clearWorkflowTracking = useCallback((workflowId: string) => {
		subnetPreviousStatus.current.delete(workflowId);
		feedbackGivenForSubnet.current.delete(workflowId);
		postFeedbackProcessing.current.delete(workflowId);
		generatedMessageIds.current.delete(workflowId);
	}, []);

	const resetMessageTracking = useCallback((workflowId: string) => {
		if (generatedMessageIds.current.has(workflowId)) {
			generatedMessageIds.current.get(workflowId)!.clear();
		}
	}, []);

	const processSubnetData = useCallback(
		(
			workflowId: string,
			subnetData: any[],
			lastQuestionRef: React.MutableRefObject<string | null>,
			options: {
				includeHistory?: boolean;
				isExistingWorkflow?: boolean;
				initializeCacheOnly?: boolean;
			} = {}
		): ChatMsg[] => {
			const {
				includeHistory = true,
				isExistingWorkflow = false,
				initializeCacheOnly = false,
			} = options;

			if (!subnetData || subnetData.length === 0) return [];

			const hasStoppedStatus = subnetData.some(
				(subnet) =>
					subnet.workflowStatus === "stopped" ||
					subnet.status === "stopped"
			);

			if (hasStoppedStatus && !includeHistory) {
				return [];
			}

			const { statusMap, feedbackSet, processingMap, messageIds } =
				getWorkflowMaps(workflowId);
			const dataMessages: ChatMsg[] = [];
			const questionMessages: ChatMsg[] = [];

			if (initializeCacheOnly) {
				subnetData.forEach((subnet: any, index: number) => {
					cacheSubnetData(workflowId, index, subnet);
					statusMap.set(index, subnet.status);
				});

				return [];
			}

			subnetData.forEach((subnet: any, index: number) => {
				const prevStatus = statusMap.get(index);
				const currentStatus = subnet.status;

				cacheSubnetData(workflowId, index, subnet);

				const hasChanged = hasSubnetChanged(workflowId, index, subnet);

				const isRegenerating =
					prevStatus === "awaiting_response" &&
					currentStatus === "in_progress";
				const isShowingQuestion =
					prevStatus === "in_progress" &&
					currentStatus === "awaiting_response";

				const isResumingWorkflow =
					!prevStatus &&
					currentStatus === "awaiting_response" &&
					subnet.data;

				const isQuestionArrivingLater =
					prevStatus === "awaiting_response" &&
					currentStatus === "awaiting_response" &&
					subnet.question &&
					!subnet.data;

				if (isRegenerating) {
					processingMap.set(index, true);
					feedbackSet.add(index);
				}

				statusMap.set(index, currentStatus);

				const hasSubstantialData =
					subnet.data &&
					subnet.data.length > 50 &&
					!subnet.data.includes("Queued for processing") &&
					!subnet.data.includes("Processing with");

				const hasFeedbackHistory =
					subnet.feedbackHistory && subnet.feedbackHistory.length > 0;

				// ALWAYS process current subnet question first, regardless of feedback history
				if (subnet.question) {
					const isAuthenticationQuestion =
						subnet.question.type === "authentication";
					const isQuestionAlreadyAnswered =
						subnet.feedbackHistory?.some(
							(feedback: any) =>
								feedback.feedback_question ===
									subnet.question.text &&
								feedback.user_answer &&
								feedback.user_answer.trim() !== "" &&
								feedback.user_answer !== null
						);

					// Always show authentication questions, even if we have feedback history
					const shouldShowQuestion =
						!isQuestionAlreadyAnswered || isAuthenticationQuestion;

					if (shouldShowQuestion) {
						const currentQuestionKey = `current_question_${workflowId}_${index}`;

						// Determine the correct feedback index for the current question
						let currentFeedbackIndex = 0;
						if (
							subnet.feedbackHistory &&
							subnet.feedbackHistory.length > 0
						) {
							// Find the feedback item that matches this current question
							const matchingFeedbackIndex =
								subnet.feedbackHistory.findIndex(
									(feedback: any) =>
										feedback.feedback_question ===
										subnet.question.text
								);
							if (matchingFeedbackIndex !== -1) {
								currentFeedbackIndex = matchingFeedbackIndex;
							} else {
								// If no exact match, use the highest index + 1 (for new questions)
								currentFeedbackIndex =
									subnet.feedbackHistory.length - 1;
							}
						}

						// Check if a question with this sourceId already exists (from feedback history processing)
						const proposedSourceId = `subnet_${index}_feedback_question_${currentFeedbackIndex}`;
						const questionAlreadyExists =
							dataMessages.some(
								(msg) => msg.sourceId === proposedSourceId
							) ||
							questionMessages.some(
								(msg) => msg.sourceId === proposedSourceId
							);

						if (
							!messageIds.has(currentQuestionKey) &&
							!questionAlreadyExists
						) {
							const baseTimestamp = subnet.updatedAt
								? new Date(subnet.updatedAt)
								: new Date();
							const questionTimestamp = new Date(
								baseTimestamp.getTime() + 1000
							);

							// For authentication questions, try to get authUrl from feedback history
							let authUrl = undefined;
							if (
								isAuthenticationQuestion &&
								subnet.feedbackHistory?.length > 0
							) {
								const authFeedback =
									subnet.feedbackHistory.find(
										(feedback: any) =>
											feedback.response?.type ===
											"authentication"
									);
								if (authFeedback) {
									authUrl = authFeedback.response?.authUrl;
								}
							}

							const currentQuestionMessage: ChatMsg = {
								id: `current_question_${index}_${Date.now()}`,
								type: "question",
								content: subnet.question.text,
								timestamp: questionTimestamp,
								subnetStatus: subnet.status,
								toolName: subnet.toolName,
								subnetIndex: index,
								questionData: {
									...subnet.question,
									// Include authUrl for authentication questions
									authUrl: authUrl || subnet.question.authUrl,
								},
								// Use feedback sourceId to ensure proper grouping with feedback threads
								sourceId: proposedSourceId,
							};
							questionMessages.push(currentQuestionMessage);
							messageIds.add(currentQuestionKey);
							console.log(
								`✅ Current question message generated for subnet ${index} (type: ${subnet.question.type}) - feedbackIndex: ${currentFeedbackIndex} - sourceId: ${proposedSourceId}`
							);
						}
					}
				}

				// Check for potential data duplication
				const duplicationCheck = detectDataDuplication(subnet);
				if (duplicationCheck.hasDuplication && includeHistory) {
				}

				// Original logic preserved - only add duplication check for specific case
				// For running workflows: prioritize feedback history over subnet data to avoid duplicates
				const isRunningWorkflow =
					subnet.status === "in_progress" ||
					subnet.status === "awaiting_response" ||
					subnet.status === "pending";

				const hasFeedbackData =
					hasFeedbackHistory && subnet.feedbackHistory.length > 0;

				if (hasFeedbackData) {
					// Clear any existing feedback messages for this subnet to avoid duplicates
					const subnetMessageKeys = Array.from(messageIds).filter(
						(key) =>
							key.startsWith(`feedback_${workflowId}_${index}_`)
					);
					subnetMessageKeys.forEach((key) => messageIds.delete(key));

					// Sort feedback history by creation time (oldest first for proper flow)
					const sortedFeedbackHistory = [
						...subnet.feedbackHistory,
					].sort((a, b) => {
						const timeA = new Date(a.created_at).getTime();
						const timeB = new Date(b.created_at).getTime();
						return timeA - timeB; // oldest first for proper chronological flow
					});

					console.log(
						`🔍 Processing ${sortedFeedbackHistory.length} feedback history items for subnet ${index}`
					);

					// Process each feedback history item
					sortedFeedbackHistory.forEach(
						(feedbackItem: any, feedbackIndex: number) => {
							const feedbackBaseKey = `feedback_${workflowId}_${index}_${feedbackIndex}`;

							// Always create response message first (prompt + data/message)
							const responseKey = `${feedbackBaseKey}_response`;
							const responseSourceId = `subnet_${index}_feedback_response_${feedbackIndex}`;

							const responseAlreadyExists =
								dataMessages.some(
									(msg) => msg.sourceId === responseSourceId
								) ||
								questionMessages.some(
									(msg) => msg.sourceId === responseSourceId
								);

							if (!responseAlreadyExists) {
								// Resolve file/image url from feedback response if available
								const responseContentType =
									feedbackItem.response?.data?.contentType ||
									feedbackItem.response?.contentType;
								const responseFileUrl: string | undefined =
									feedbackItem.response?.data?.fileUrl ||
									feedbackItem.response?.fileUrl;
								let resolvedImageUrl: string | undefined =
									undefined;
								if (
									typeof responseFileUrl === "string" &&
									responseFileUrl.length > 0
								) {
									try {
										// If external URL, route via proxy to avoid CORS
										const isExternal =
											responseFileUrl.startsWith("http");
										if (isExternal) {
											resolvedImageUrl = `/api/image/proxy?url=${encodeURIComponent(
												responseFileUrl
											)}`;
										} else {
											resolvedImageUrl = responseFileUrl;
										}
									} catch {
										resolvedImageUrl = responseFileUrl;
									}
								}

								// Create response message with prompt and data
								const responseMessage: ChatMsg = {
									id: `feedback_response_${index}_${feedbackIndex}_${Date.now()}`,
									type: "workflow_subnet", // Use workflow_subnet type for collapsible display
									content:
										feedbackItem.response?.message ||
										subnet.data ||
										"No response data available",
									timestamp: new Date(
										feedbackItem.created_at
									),
									toolName: subnet.toolName,
									subnetIndex: index,
									subnetStatus: subnet.status,
									sourceId: responseSourceId,
									prompt:
										subnet.prompt ||
										feedbackItem.response?.prompt,
									// Include image url from response if present
									imageData: resolvedImageUrl,
									isImage:
										!!resolvedImageUrl &&
										typeof responseContentType ===
											"string" &&
										responseContentType.startsWith(
											"image/"
										),
									contentType: responseContentType,
								};
								dataMessages.push(responseMessage);
								messageIds.add(responseKey);
								console.log(
									`✅ Created feedback response message for subnet ${index}, feedback ${feedbackIndex}`
								);
							}

							// Check if this is an authentication question
							const isAuthenticationQuestion =
								feedbackItem.response?.type ===
								"authentication";

							// For authentication questions, don't create a separate feedback question message
							// since we're already creating the current subnet question message
							if (!isAuthenticationQuestion) {
								// Always create question message (feedback_question) for non-authentication questions
								const questionKey = `${feedbackBaseKey}_question`;
								const questionSourceId = `subnet_${index}_feedback_question_${feedbackIndex}`;

								const questionAlreadyExists =
									dataMessages.some(
										(msg) =>
											msg.sourceId === questionSourceId
									) ||
									questionMessages.some(
										(msg) =>
											msg.sourceId === questionSourceId
									);

								if (!questionAlreadyExists) {
									const responseTimestamp = new Date(
										feedbackItem.created_at
									);
									const questionTimestamp = new Date(
										responseTimestamp.getTime() + 1000
									);

									const questionMessage: ChatMsg = {
										id: `feedback_question_${index}_${feedbackIndex}_${Date.now()}`,
										type: "question",
										content: feedbackItem.feedback_question,
										timestamp: questionTimestamp,
										toolName: subnet.toolName,
										subnetIndex: index,
										subnetStatus: subnet.status,
										questionData: {
											type: "feedback", // Always feedback type for non-authentication questions
											text: feedbackItem.feedback_question,
											itemID: feedbackItem.item_id,
											expiresAt: feedbackItem.updated_at,
										},
										sourceId: questionSourceId,
									};
									questionMessages.push(questionMessage);
									messageIds.add(questionKey);
									console.log(
										`✅ Created feedback question message for subnet ${index}, feedback ${feedbackIndex}`
									);
								}
							} else {
								console.log(
									`⏭️ Skipping feedback question message for authentication - using current subnet question instead`
								);
							}

							// Create answer message if user has answered
							if (
								feedbackItem.user_answer &&
								feedbackItem.user_answer.trim() !== ""
							) {
								const answerKey = `${feedbackBaseKey}_answer`;
								const answerSourceId = `subnet_${index}_feedback_answer_${feedbackIndex}`;

								const answerAlreadyExists =
									dataMessages.some(
										(msg) => msg.sourceId === answerSourceId
									) ||
									questionMessages.some(
										(msg) => msg.sourceId === answerSourceId
									);

								if (!answerAlreadyExists) {
									const responseTimestamp = new Date(
										feedbackItem.created_at
									);
									const questionTimestamp = new Date(
										responseTimestamp.getTime() + 1000
									);
									const answerTimestamp = new Date(
										feedbackItem.updated_at ||
											new Date(
												questionTimestamp.getTime() +
													1000
											)
									);

									const answerMessage: ChatMsg = {
										id: `feedback_answer_${index}_${feedbackIndex}_${Date.now()}`,
										type: "answer",
										content: feedbackItem.user_answer,
										timestamp: answerTimestamp,
										toolName: subnet.toolName,
										subnetIndex: index,
										sourceId: answerSourceId,
									};
									questionMessages.push(answerMessage);
									messageIds.add(answerKey);
									console.log(
										`✅ Created feedback answer message for subnet ${index}, feedback ${feedbackIndex}`
									);
								}
							}
						}
					);

					// Skip subnet data processing when we have feedback history
					console.log(
						`⏭️ Skipping subnet data processing - using feedback history for subnet ${index}`
					);
				} else {
					// Only process subnet data when no feedback history exists
					const shouldGenerateMessage =
						!isResumingWorkflow &&
						((hasChanged && prevStatus) ||
							(subnet.status === "in_progress" &&
								prevStatus === "pending") ||
							(subnet.status === "done" && subnet.data) ||
							(subnet.status === "awaiting_response" &&
								subnet.data &&
								(prevStatus || !includeHistory)) ||
							(subnet.status === "pending" &&
								hasSubstantialData) ||
							(prevStatus === "in_progress" &&
								subnet.status !== "in_progress") ||
							isQuestionArrivingLater);

					if (shouldGenerateMessage) {
						const {
							dataMessages: subnetDataMessages,
							questionMessages: subnetQuestionMessages,
						} = createSubnetMessages(workflowId, index, subnet, {
							isRegenerating,
							isShowingQuestion,
							hasFeedback: feedbackSet.has(index),
							isProcessingAfterFeedback:
								processingMap.get(index) || false,
							isQuestionArrivingLater,
							hasFeedbackHistory,
							includeHistory,
						});

						// Process data messages
						subnetDataMessages.forEach((message) => {
							if (message) {
								let messageKey;
								if (
									subnet.status === "pending" &&
									subnet.data
								) {
									messageKey = `${workflowId}_${index}_pending_with_data_${JSON.stringify(
										subnet.data
									).slice(0, 100)}`;
								} else if (
									message.type === "workflow_subnet" &&
									message.subnetStatus === "awaiting_response"
								) {
									const dataHash = subnet.data
										? JSON.stringify(subnet.data).slice(
												0,
												100
										  )
										: "no-data";
									messageKey = `${workflowId}_${index}_awaiting_response_data_${dataHash}`;
								} else {
									messageKey = `${workflowId}_${index}_${
										message.type
									}_${subnet.status}_${
										subnet.data
											? JSON.stringify(subnet.data).slice(
													0,
													100
											  )
											: "no-data"
									}`;
								}

								if (!messageIds.has(messageKey)) {
									dataMessages.push(message);
									messageIds.add(messageKey);
								} else {
									console.log(
										`⏭️ Skipping duplicate data message for subnet ${index}:`,
										message.type,
										`Status: ${
											message.subnetStatus || "N/A"
										}`
									);
								}
							}
						});

						subnetQuestionMessages.forEach((message) => {
							if (message) {
								let messageKey;
								const questionData =
									message.questionData || subnet.question;
								messageKey = `${workflowId}_${index}_question_${
									questionData?.type
								}_${message.content?.slice(0, 50)}`;

								if (!messageIds.has(messageKey)) {
									questionMessages.push(message);
									messageIds.add(messageKey);
								} else {
								}
							}
						});

						const shouldShowNotification =
							subnet.question?.type === "notification" &&
							(hasChanged ||
								isShowingQuestion ||
								(subnet.status === "pending" && subnet.data));

						if (shouldShowNotification) {
							const notificationKey = `notification_${workflowId}_${index}_${subnet.question.text}`;

							if (!messageIds.has(notificationKey)) {
								const notificationMessage =
									createNotificationMessage(subnet, index);
								if (notificationMessage) {
									dataMessages.push(notificationMessage);
									messageIds.add(notificationKey);
								}
							} else {
								console.log(
									`⏭️ Skipping duplicate notification for subnet ${index}`
								);
							}
						}
					}
				}

				if (currentStatus === "done" && processingMap.has(index)) {
					processingMap.delete(index);
					feedbackSet.delete(index);
				}
			});

			// Filter out unwanted system messages and feedback processing messages
			const filteredDataMessages = dataMessages.filter((msg) => {
				// Filter out workflow execution success messages
				if (msg.content === "Workflow executed successfully") {
					return false;
				}

				// Filter out feedback processing messages
				if (
					msg.content?.includes("Feedback submitted successfully") ||
					msg.content?.includes("Feedback processed successfully") ||
					msg.content?.includes("Resuming workflow")
				) {
					return false;
				}

				// Filter out generic "Response" messages without meaningful content
				if (
					msg.type === "response" &&
					(msg.content === "Response" ||
						msg.content === "Your answer" ||
						msg.content === "Proceeding with current result")
				) {
					return false;
				}

				return true;
			});

			const filteredQuestionMessages = questionMessages.filter((msg) => {
				// Filter out unwanted question messages
				if (
					msg.content?.includes("Feedback submitted successfully") ||
					msg.content?.includes("Feedback processed successfully")
				) {
					return false;
				}

				return true;
			});

			const safeguardedDataMessages = filteredDataMessages.filter(
				(msg) => {
					if (
						msg.type === "workflow_subnet" &&
						msg.subnetIndex !== undefined
					) {
						const subnetIndex = msg.subnetIndex;
						const subnet = subnetData[subnetIndex];
						const hasFeedbackForThisSubnet =
							subnet?.feedbackHistory &&
							subnet.feedbackHistory.length > 0;

						if (hasFeedbackForThisSubnet) {
							// Check if this is an original data message (not from feedback history)
							const isOriginalDataMessage =
								!msg.sourceId?.includes("feedback");

							if (isOriginalDataMessage) {
								return false;
							}
						}
					}
					// For response messages from feedback history, always keep them
					if (
						msg.type === "response" &&
						msg.sourceId?.includes("feedback")
					) {
					}

					return true;
				}
			);

			// Apply the same safeguard to question messages
			const safeguardedQuestionMessages = filteredQuestionMessages.filter(
				(msg) => {
					if (msg.subnetIndex !== undefined) {
						const subnetIndex = msg.subnetIndex;
						const subnet = subnetData[subnetIndex];
						const hasFeedbackForThisSubnet =
							subnet?.feedbackHistory &&
							subnet.feedbackHistory.length > 0;

						if (hasFeedbackForThisSubnet) {
							// Check if this is an original question (not from feedback history)
							const isOriginalQuestion =
								!msg.sourceId?.includes("feedback");
							// Only filter out original questions, keep feedback questions
							if (isOriginalQuestion && msg.type === "question") {
								return false;
							}
						}
					}
					// Always keep feedback questions
					if (msg.sourceId?.includes("feedback")) {
						console.log(`✅ Keeping feedback question message`, {
							messageId: msg.id,
							sourceId: msg.sourceId,
							content: msg.content?.slice(0, 50),
							subnetIndex: msg.subnetIndex,
						});
					}
					return true;
				}
			);

			// Sort messages to show data first, then questions, maintaining natural flow within each type
			const allMessages = [
				...safeguardedDataMessages,
				...safeguardedQuestionMessages,
			].sort((a, b) => {
				// Define message type priorities: data/response first, then questions
				const getTypePriority = (type: string) => {
					switch (type) {
						case "workflow_subnet":
							return 1; // Data messages first
						case "response":
							return 1; // Response messages (including images) first
						case "question":
							return 2; // Questions second
						case "notification":
							return 3; // Notifications last
						default:
							return 4; // Other types last
					}
				};

				const priorityA = getTypePriority(a.type);
				const priorityB = getTypePriority(b.type);

				if (priorityA !== priorityB) {
					const result = priorityA - priorityB;
					return result;
				}

				const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
				const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;

				return timeA - timeB;
			});

			const feedbackMessagesBeforeSafeguard = [
				...dataMessages.filter((msg) =>
					msg.sourceId?.includes("feedback")
				),
				...questionMessages.filter((msg) =>
					msg.sourceId?.includes("feedback")
				),
			];
			const feedbackMessagesAfterSafeguard = allMessages.filter((msg) =>
				msg.sourceId?.includes("feedback")
			);

			return allMessages;
		},
		[cacheSubnetData, hasSubnetChanged, getWorkflowMaps]
	);

	// Create subnet message based on status - returns separate data and question messages
	const createSubnetMessages = useCallback(
		(
			workflowId: string,
			index: number,
			subnet: any,
			options: {
				isRegenerating: boolean;
				isShowingQuestion: boolean;
				hasFeedback: boolean;
				isProcessingAfterFeedback: boolean;
				isQuestionArrivingLater: boolean;
				hasFeedbackHistory?: boolean;
				includeHistory?: boolean;
			}
		): { dataMessages: ChatMsg[]; questionMessages: ChatMsg[] } => {
			const {
				isRegenerating,
				isShowingQuestion,
				hasFeedback,
				isProcessingAfterFeedback,
				isQuestionArrivingLater,
				hasFeedbackHistory = false,
				includeHistory = false,
			} = options;
			const sourceId = `subnet_${index}_${subnet.status}`;
			const dataMessages: ChatMsg[] = [];
			const questionMessages: ChatMsg[] = [];

			// Helper function to extract question data from subnet
			const extractQuestionData = (subnetData: string) => {
				try {
					const parsedData = JSON.parse(subnetData);
					if (
						parsedData.question ||
						(parsedData.data && parsedData.data.question)
					) {
						const questionText =
							parsedData.question || parsedData.data.question;

						if (
							typeof questionText === "object" &&
							questionText.text
						) {
							return questionText;
						} else if (typeof questionText === "string") {
							return {
								type: "feedback",
								text: questionText,
								itemID: Date.now(),
								expiresAt: new Date(
									Date.now() + 30 * 60 * 1000
								).toISOString(),
							};
						}
					}
				} catch (e) {
					// Ignore parsing errors
				}
				return null;
			};

			switch (subnet.status) {
				case "pending":
					// Only show pending subnets if they have substantial data
					if (
						subnet.data &&
						subnet.data.length > 50 &&
						!subnet.data.includes("Queued for processing") &&
						!subnet.data.includes("Processing with")
					) {
						const result = parseAgentResponse(subnet.data);
						let content = result.content || "";

						// Handle special data formats and nested structures
						try {
							const parsedData = JSON.parse(subnet.data);

							// Check for nested data structure (like in subnet 3)
							if (
								parsedData.data &&
								parsedData.data.data &&
								parsedData.data.data.message
							) {
								content = parsedData.data.data.message;
							} else if (
								parsedData.data &&
								parsedData.data.message
							) {
								content = parsedData.data.message;
							} else if (
								parsedData.enhancedPrompt &&
								parsedData.originalPrompt
							) {
								content = "Prompt enhancement detected";
							} else if (parsedData.message) {
								content = parsedData.message;
							} else if (
								parsedData.data &&
								typeof parsedData.data === "string"
							) {
								// Handle case where data is a JSON string
								try {
									const nestedData = JSON.parse(
										parsedData.data
									);
									if (nestedData.message) {
										content = nestedData.message;
									} else if (nestedData.data?.message) {
										content = nestedData.data.message;
									}
								} catch {
									// If parsing fails, use the data string as content
									content = parsedData.data;
								}
							}
						} catch (e) {
							console.log(
								`⚠️ Failed to parse JSON for pending subnet ${index}:`,
								e
							);
						}

						// Only add message if we have meaningful content
						// Reduced threshold to catch more content, especially for structured data
						if (content && content.length > 0) {
							// Use subnet's updatedAt if available, otherwise fall back to current time
							const baseTimestamp = subnet.updatedAt
								? new Date(subnet.updatedAt)
								: new Date();

							const dataMessage = {
								id: `subnet_${index}_data_${Date.now()}`,
								type: "workflow_subnet" as const,
								content,
								timestamp: baseTimestamp,
								subnetStatus: "done" as const,
								toolName: subnet.toolName,
								subnetIndex: index,
								imageData: result.imageData,
								isImage: result.isImage,
								contentType: result.contentType,
								sourceId: `${sourceId}_data`,
								contentHash: createContentHash(result),
								prompt: subnet.prompt,
							};
							dataMessages.push(dataMessage);

							const questionData = extractQuestionData(
								subnet.data
							);
							if (questionData) {
								const questionTimestamp = new Date(
									baseTimestamp.getTime() + 1000
								);

								const questionMessage = {
									id: `subnet_${index}_question_${Date.now()}`,
									type: "question" as const,
									content: questionData.text,
									timestamp: questionTimestamp,
									subnetStatus: "awaiting_response" as const,
									toolName: subnet.toolName,
									subnetIndex: index,
									questionData: questionData,
									sourceId: `${sourceId}_question`,
								};
								questionMessages.push(questionMessage);
							}
						}
					}
					break;

				case "in_progress":
					if (isProcessingAfterFeedback) {
						dataMessages.push({
							id: `subnet_${index}_processing_after_feedback_${Date.now()}`,
							type: "workflow_subnet",
							content: `Processing with your feedback...`,
							timestamp: new Date(),
							subnetStatus: "in_progress",
							toolName: subnet.toolName,
							subnetIndex: index,
							sourceId: `${sourceId}_processing_after_feedback`,
							isRegenerated: true,
							showLoadingDots: true,
						});
					} else {
						const hasNoData =
							!subnet.data ||
							subnet.data.length === 0 ||
							subnet.data.trim() === "" ||
							subnet.data === "null" ||
							subnet.data === "undefined";

						if (hasNoData && !hasFeedbackHistory) {
							dataMessages.push({
								id: `subnet_${index}_processing_${Date.now()}`,
								type: "workflow_subnet",
								content: "",
								timestamp: new Date(),
								subnetStatus: "in_progress",
								toolName: subnet.toolName,
								subnetIndex: index,
								sourceId: `${sourceId}_processing`,
								showLoadingDots: true,
							});
						}
					}
					break;

				case "done":
					if (subnet.data) {
						const result = parseAgentResponse(subnet.data);
						const contentHash = createContentHash(result);

						let content = result.content || "";
						let hasQuestion = false;
						let questionContent = "";

						// Handle special data formats and extract questions
						try {
							const parsedData = JSON.parse(subnet.data);

							// Check for nested data structure
							if (
								parsedData.data &&
								parsedData.data.data &&
								parsedData.data.data.message
							) {
								// For Twitter responses: data.data.message
								content = parsedData.data.data.message;
							} else if (
								parsedData.data &&
								parsedData.data.message
							) {
								content = parsedData.data.message;
							} else if (
								parsedData.enhancedPrompt &&
								parsedData.originalPrompt
							) {
								content = "Prompt enhancement detected";
							} else if (parsedData.message) {
								content = parsedData.message;
							} else if (
								parsedData.data &&
								typeof parsedData.data === "string"
							) {
								// Handle case where data is a JSON string
								try {
									const nestedData = JSON.parse(
										parsedData.data
									);
									if (nestedData.message) {
										content = nestedData.message;
									} else if (nestedData.data?.message) {
										content = nestedData.data.message;
									}
								} catch {
									// If parsing fails, use the data string as content
									content = parsedData.data;
								}
							}

							// Check for questions in the data
							if (
								parsedData.question ||
								(parsedData.data && parsedData.data.question)
							) {
								hasQuestion = true;
								questionContent =
									parsedData.question ||
									parsedData.data.question;
							}
						} catch {
							// Use default content
						}

						// If we have both data and question, prioritize showing data first
						if (content || result.imageData) {
							// Use subnet's updatedAt if available, otherwise fall back to current time
							const baseTimestamp = subnet.updatedAt
								? new Date(subnet.updatedAt)
								: new Date();

							const dataMessage = {
								id: `subnet_${index}_data_${Date.now()}`,
								type: "workflow_subnet" as const,
								content: content || "Data received",
								timestamp: baseTimestamp,
								subnetStatus: "done" as const,
								toolName: subnet.toolName,
								subnetIndex: index,
								imageData: result.imageData,
								isImage: result.isImage,
								contentType: result.contentType,
								sourceId: `${sourceId}_data`,
								isRegenerated: isRegenerating,
								contentHash,
								prompt: subnet.prompt,
								showLoadingDots: false, // Ensure loading dots are not shown for completed subnets
							};
							dataMessages.push(dataMessage);

							// Check for questions in the data and add them as separate messages
							const questionData = extractQuestionData(
								subnet.data
							);
							if (questionData) {
								const questionTimestamp = new Date(
									baseTimestamp.getTime() + 1000
								);

								const questionMessage = {
									id: `subnet_${index}_question_${Date.now()}`,
									type: "question" as const,
									content: questionData.text,
									timestamp: questionTimestamp,
									subnetStatus: "awaiting_response" as const,
									toolName: subnet.toolName,
									subnetIndex: index,
									questionData: questionData,
									sourceId: `${sourceId}_question`,
								};
								questionMessages.push(questionMessage);
							}
						}
					}
					break;

				case "awaiting_response":
					let content = "";
					let hasDataContent = false;
					let hasDirectQuestion = false;
					let questionData = null;

					let shouldSkipSubnetData = false;
					if (hasFeedbackHistory) {
						shouldSkipSubnetData = true;
					}

					if (subnet.data && !shouldSkipSubnetData) {
						const result = parseAgentResponse(subnet.data);
						content = result.content || "";

						try {
							const parsedData = JSON.parse(subnet.data);

							if (
								parsedData.data &&
								parsedData.data.data &&
								parsedData.data.data.message
							) {
								// For Twitter responses: data.data.message
								content = parsedData.data.data.message;
							} else if (
								parsedData.data &&
								parsedData.data.message
							) {
								content = parsedData.data.message;
							} else if (
								parsedData.enhancedPrompt &&
								parsedData.originalPrompt
							) {
								content = "Prompt enhancement detected";
							} else if (parsedData.message) {
								content = parsedData.message;
							} else if (
								parsedData.data &&
								typeof parsedData.data === "string"
							) {
								// Handle case where data is a JSON string
								try {
									const nestedData = JSON.parse(
										parsedData.data
									);
									if (nestedData.message) {
										content = nestedData.message;
									} else if (nestedData.data?.message) {
										content = nestedData.data.message;
									}
								} catch {
									// If parsing fails, use the data string as content
									content = parsedData.data;
								}
							}

							if (
								parsedData.question ||
								(parsedData.data && parsedData.data.question)
							) {
								hasDataContent = true;
								const questionText =
									parsedData.question ||
									parsedData.data.question;

								if (
									typeof questionText === "object" &&
									questionText.text
								) {
									questionData = questionText;
								} else if (typeof questionText === "string") {
									questionData = {
										type: "feedback",
										text: questionText,
										itemID: Date.now(),
										expiresAt: new Date(
											Date.now() + 30 * 60 * 1000
										).toISOString(),
									};
								}
							}
						} catch {
							// Use default content
						}

						hasDataContent = !!(content || result.imageData);

						if (hasDataContent) {
							const baseTimestamp = subnet.updatedAt
								? new Date(subnet.updatedAt)
								: new Date();

							const dataMessage = {
								id: `subnet_${index}_data_${Date.now()}`,
								type: "workflow_subnet" as const,
								content: content || "Data received",
								timestamp: baseTimestamp,
								subnetStatus: "done" as const,
								toolName: subnet.toolName,
								subnetIndex: index,
								imageData: result.imageData,
								isImage: result.isImage,
								contentType: result.contentType,
								sourceId: `${sourceId}_data`,
								contentHash: createContentHash(result),
								prompt: subnet.prompt,
							};
							dataMessages.push(dataMessage);
						}
					}

					if (subnet.question) {
						hasDirectQuestion = true;

						questionData = subnet.question;
					}

					// Show question if we have data content OR if subnet is awaiting response with a question
					if (
						(hasDataContent ||
							subnet.status === "awaiting_response") &&
						questionData
					) {
						const finalQuestionData = questionData;

						if (finalQuestionData) {
							const baseTimestamp = subnet.updatedAt
								? new Date(subnet.updatedAt)
								: new Date();

							const questionTimestamp = new Date(
								baseTimestamp.getTime() + 10
							);

							const questionMessage = {
								id: `subnet_${index}_question_${Date.now()}`,
								type: "question" as const,
								content: finalQuestionData.text,
								timestamp: questionTimestamp,
								subnetStatus: "awaiting_response" as const,
								toolName: subnet.toolName,
								subnetIndex: index,
								questionData: finalQuestionData,
								sourceId: `${sourceId}_question`,
							};
							questionMessages.push(questionMessage);
						}
					}

					// If we have a direct question from subnet.question, show it if we have data OR if awaiting response
					if (
						hasDirectQuestion &&
						(hasDataContent ||
							subnet.status === "awaiting_response")
					) {
						const finalQuestionData = subnet.question;

						if (finalQuestionData) {
							const baseTimestamp = subnet.updatedAt
								? new Date(subnet.updatedAt)
								: new Date();

							const questionTimestamp = new Date(
								baseTimestamp.getTime() + 10
							);

							const questionMessage = {
								id: `subnet_${index}_question_${Date.now()}`,
								type: "question" as const,
								content: finalQuestionData.text,
								timestamp: questionTimestamp,
								subnetStatus: "awaiting_response" as const,
								toolName: subnet.toolName,
								subnetIndex: index,
								questionData: finalQuestionData,
								sourceId: `${sourceId}_question`,
							};
							questionMessages.push(questionMessage);
						}
					}

					if (!hasDataContent && !hasDirectQuestion) {
						dataMessages.push({
							id: `subnet_${index}_waiting_${Date.now()}`,
							type: "workflow_subnet",
							content: `Waiting for your response...`,
							timestamp: new Date(),
							subnetStatus: "awaiting_response",
							toolName: subnet.toolName,
							subnetIndex: index,
							sourceId: sourceId,
						});
					}
					break;

				case "failed":
					const errorContent =
						subnet.error ||
						(subnet.data && subnet.data.includes("error")
							? subnet.data
							: null) ||
						`${subnet.toolName || "Subnet"} processing failed`;

					dataMessages.push({
						id: `subnet_${index}_failed_${Date.now()}`,
						type: "workflow_subnet",
						content: `❌ **${
							subnet.toolName || "Subnet"
						} Failed**\n\n${errorContent}`,
						timestamp: new Date(),
						subnetStatus: "failed",
						toolName: subnet.toolName,
						subnetIndex: index,
						sourceId: sourceId,
					});
					break;

				default:
					break;
			}

			return { dataMessages, questionMessages };
		},
		[parseAgentResponse, createContentHash]
	);

	const createNotificationMessage = useCallback(
		(subnet: any, index: number): ChatMsg => {
			return {
				id: `notification_${Date.now()}`,
				type: "notification",
				content: subnet.question.text,
				timestamp: new Date(),
				toolName: subnet.toolName,
				subnetStatus: subnet.status,
				subnetIndex: index,
				questionData: subnet.question,
				sourceId: `notification_${subnet.itemID}_${Date.now()}`,
			};
		},
		[]
	);

	const hasSubnetData = useCallback(
		(workflowId: string, subnetIndex: number) => {
			const cached = getCachedSubnetData(workflowId, subnetIndex);
			return cached?.data && cached.status === "done";
		},
		[getCachedSubnetData]
	);

	return {
		processSubnetData,
		getCachedSubnets,
		hasSubnetData,
		clearWorkflowCache,
		clearWorkflowTracking,
		resetMessageTracking,
		updateSubnetStatus,
		getWorkflowMaps,
	};
};
