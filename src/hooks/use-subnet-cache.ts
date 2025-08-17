import { useCallback, useRef } from "react";
import { useSubnetCacheStore } from "@/stores";
import { ChatMsg } from "@/types/chat";
import { parseAgentResponse, createContentHash } from "@/utils/message-parser";

// Helper function to detect potential data duplication
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

		// Simple check if the content is similar (first 200 characters)
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
	const {
		cacheSubnetData,
		getCachedSubnetData,
		hasSubnetChanged,
		clearWorkflowCache,
		updateSubnetStatus,
	} = useSubnetCacheStore();

	// Track previous states for transitions
	const subnetPreviousStatus = useRef<Map<string, Map<number, string>>>(
		new Map()
	);
	const feedbackGivenForSubnet = useRef<Map<string, Set<number>>>(new Map());
	const postFeedbackProcessing = useRef<Map<string, Map<number, boolean>>>(
		new Map()
	);
	// Track which messages have already been generated to prevent duplicates
	const generatedMessageIds = useRef<Map<string, Set<string>>>(new Map());

	// Get or create workflow tracking maps
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

	// Clear workflow tracking when switching workflows
	const clearWorkflowTracking = useCallback((workflowId: string) => {
		subnetPreviousStatus.current.delete(workflowId);
		feedbackGivenForSubnet.current.delete(workflowId);
		postFeedbackProcessing.current.delete(workflowId);
		generatedMessageIds.current.delete(workflowId);
	}, []);

	// Reset message tracking for a specific workflow (useful for debugging)
	const resetMessageTracking = useCallback((workflowId: string) => {
		if (generatedMessageIds.current.has(workflowId)) {
			generatedMessageIds.current.get(workflowId)!.clear();
			console.log(`🔄 Reset message tracking for workflow ${workflowId}`);
		}
	}, []);

	// Process subnet data and return chat messages
	const processSubnetData = useCallback(
		(
			workflowId: string,
			subnetData: any[],
			lastQuestionRef: React.MutableRefObject<string | null>,
			options: {
				includeHistory?: boolean;
				isExistingWorkflow?: boolean;
			} = {}
		): ChatMsg[] => {
			const { includeHistory = true, isExistingWorkflow = false } =
				options;

			console.log(
				`🔄 Processing subnet data for workflow ${workflowId}:`,
				subnetData?.length || 0,
				"subnets",
				`includeHistory: ${includeHistory}, isExistingWorkflow: ${isExistingWorkflow}`
			);

			if (!subnetData || subnetData.length === 0) return [];

			// Check if any subnet has a stopped status - if so, don't process new data to prevent invalid additions
			const hasStoppedStatus = subnetData.some(
				(subnet) =>
					subnet.workflowStatus === "stopped" ||
					subnet.status === "stopped"
			);

			if (hasStoppedStatus && !includeHistory) {
				console.log(
					`🛑 Workflow ${workflowId} is stopped - skipping new data processing to prevent invalid additions`
				);
				return [];
			}

			const { statusMap, feedbackSet, processingMap, messageIds } =
				getWorkflowMaps(workflowId);
			const dataMessages: ChatMsg[] = [];
			const questionMessages: ChatMsg[] = [];

			subnetData.forEach((subnet: any, index: number) => {
				const prevStatus = statusMap.get(index);
				const currentStatus = subnet.status;

				console.log(
					`📊 Subnet ${index}: ${
						prevStatus || "new"
					} -> ${currentStatus}`
				);
				console.log(`🔍 Subnet ${index} data:`, {
					status: subnet.status,
					hasData: !!subnet.data,
					dataType: typeof subnet.data,
					dataPreview: subnet.data
						? JSON.stringify(subnet.data).slice(0, 100)
						: "no-data",
					hasQuestion: !!subnet.question,
					questionType: subnet.question?.type,
					questionText: subnet.question?.text?.slice(0, 50),
				});

				// Special logging for pending subnets with data
				if (subnet.status === "pending" && subnet.data) {
					console.log(
						`🔄 Pending subnet ${index} has data - will generate message`
					);
					console.log(`🔍 Pending subnet ${index} data structure:`, {
						dataType: typeof subnet.data,
						dataLength: subnet.data?.length || 0,
						dataPreview: subnet.data?.slice(0, 200) || "no-data",
						parsedData: (() => {
							try {
								return JSON.parse(subnet.data);
							} catch (e) {
								return "Failed to parse JSON";
							}
						})(),
					});
				}

				// Check if subnet has changed
				const hasChanged = hasSubnetChanged(workflowId, index, subnet);

				// Cache the subnet data
				cacheSubnetData(workflowId, index, subnet);

				// Determine transitions
				const isRegenerating =
					prevStatus === "waiting_response" &&
					currentStatus === "in_progress";
				const isShowingQuestion =
					prevStatus === "in_progress" &&
					currentStatus === "waiting_response";

				// Special case: Detect workflow resumption scenario
				// This happens when we have no previous status but subnet is already in waiting_response with data
				const isResumingWorkflow =
					!prevStatus &&
					currentStatus === "waiting_response" &&
					subnet.data;

				// Detect when a question arrives later (after data was already processed)
				const isQuestionArrivingLater =
					prevStatus === "waiting_response" &&
					currentStatus === "waiting_response" &&
					subnet.question &&
					!subnet.data; // Question only, no new data

				if (isRegenerating) {
					console.log(
						`🔄 Subnet ${index} is regenerating after feedback`
					);
				}
				if (isShowingQuestion) {
					console.log(`❓ Subnet ${index} is showing question`);
				}
				if (isResumingWorkflow) {
					console.log(
						`🔄 Subnet ${index} is resuming workflow in waiting_response state`
					);
				}
				if (isQuestionArrivingLater) {
					console.log(
						`❓ Subnet ${index} has a question arriving later - will ensure it appears at bottom`
					);
				}

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

				// Check for potential data duplication
				const duplicationCheck = detectDataDuplication(subnet);
				if (duplicationCheck.hasDuplication && includeHistory) {
					console.log(
						`⚠️ Detected data duplication for subnet ${index}:`,
						duplicationCheck.details
					);
				}

				// Original logic preserved - only add duplication check for specific case
				// For running workflows: prioritize feedback history over subnet data to avoid duplicates
				const isRunningWorkflow =
					subnet.status === "in_progress" ||
					subnet.status === "waiting_response" ||
					subnet.status === "pending";

				// If feedback history exists and we're including history, check for content duplication
				// Only skip if the content is actually duplicated to prevent losing unique messages like OpenAI responses
				let shouldSkipDueToFeedbackHistory = false;
				if (hasFeedbackHistory && includeHistory) {
					// Check if subnet.data content would be duplicated by feedback history
					const subnetDataContent = subnet.data
						? String(subnet.data)
						: "";
					const feedbackContent =
						subnet.feedbackHistory?.[0]?.response?.message || "";

					// Only skip if the content is substantially similar
					shouldSkipDueToFeedbackHistory =
						subnetDataContent.length > 0 &&
						feedbackContent.length > 0 &&
						(subnetDataContent.includes(
							feedbackContent.slice(0, 100)
						) ||
							feedbackContent.includes(
								subnetDataContent.slice(0, 100)
							));

					console.log(
						`🔍 Content duplication check for subnet ${index}:`,
						{
							hasSubnetData: subnetDataContent.length > 0,
							hasFeedbackContent: feedbackContent.length > 0,
							isDuplicated: shouldSkipDueToFeedbackHistory,
							subnetPreview: subnetDataContent.slice(0, 50),
							feedbackPreview: feedbackContent.slice(0, 50),
						}
					);
				}

				const shouldGenerateMessage =
					!shouldSkipDueToFeedbackHistory && // Primary check: skip if feedback history exists AND we're including history
					!isResumingWorkflow && // Prevent message generation during workflow resumption
					((hasChanged && prevStatus) || // Status changed from a previous state
						(subnet.status === "in_progress" &&
							prevStatus === "pending") || // Start processing
						(subnet.status === "done" && subnet.data) || // Completed with data
						(subnet.status === "waiting_response" &&
							subnet.data &&
							(prevStatus || !includeHistory)) || // Has data and waiting for response - always show during real-time updates
						(subnet.status === "pending" && hasSubstantialData) || // Pending with real data
						(prevStatus === "in_progress" &&
							subnet.status !== "in_progress") || // Transition away from processing
						isQuestionArrivingLater); // Question arriving later should always generate message

				console.log(
					`🔍 Message generation check for subnet ${index}:`,
					{
						shouldGenerateMessage,
						shouldSkipDueToFeedbackHistory,
						hasFeedbackHistory,
						includeHistory,
						hasChanged,
						prevStatus,
						currentStatus: subnet.status,
						hasSubstantialData,
						isResumingWorkflow,
						hasData: !!subnet.data,
						hasQuestion: !!subnet.question,
						dataPreview: subnet.data
							? JSON.stringify(subnet.data).slice(0, 100)
							: "no-data",
					}
				);

				if (shouldSkipDueToFeedbackHistory) {
					console.log(
						`⏭️ Skipping regular message generation for subnet ${index} - content duplicated in feedback history`
					);
				}

				if (shouldGenerateMessage) {
					console.log(
						`✨ Generating message for subnet ${index} (changed: ${hasChanged}, transition: ${prevStatus} -> ${subnet.status}, hasSubstantialData: ${hasSubstantialData})`
					);

					// Create messages for data and questions separately when both exist
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
							// Check if this message has already been generated
							let messageKey;
							if (subnet.status === "pending" && subnet.data) {
								messageKey = `${workflowId}_${index}_pending_with_data_${JSON.stringify(
									subnet.data
								).slice(0, 100)}`;
							} else if (
								message.type === "workflow_subnet" &&
								message.subnetStatus === "waiting_response"
							) {
								// Special handling for waiting_response messages to prevent duplicates during resumption
								const dataHash = subnet.data
									? JSON.stringify(subnet.data).slice(0, 100)
									: "no-data";
								messageKey = `${workflowId}_${index}_waiting_response_data_${dataHash}`;
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

							console.log(
								`🔑 Data message key for subnet ${index}:`,
								messageKey
							);

							if (!messageIds.has(messageKey)) {
								dataMessages.push(message);
								messageIds.add(messageKey);
								console.log(
									`✅ Data message generated for subnet ${index}:`,
									message.type,
									`Content: "${message.content?.slice(
										0,
										50
									)}..."`,
									`Status: ${message.subnetStatus || "N/A"}`
								);
							} else {
								console.log(
									`⏭️ Skipping duplicate data message for subnet ${index}:`,
									message.type,
									`Status: ${message.subnetStatus || "N/A"}`
								);
							}
						}
					});

					// Process question messages
					subnetQuestionMessages.forEach((message) => {
						if (message) {
							// Check if this question message has already been generated
							let messageKey;
							const questionData =
								message.questionData || subnet.question;
							messageKey = `${workflowId}_${index}_question_${
								questionData?.type
							}_${message.content?.slice(0, 50)}`;

							console.log(
								`🔑 Question message key for subnet ${index}:`,
								messageKey
							);

							if (!messageIds.has(messageKey)) {
								questionMessages.push(message);
								messageIds.add(messageKey);
								console.log(
									`✅ Question message generated for subnet ${index}:`,
									message.type,
									`Content: "${message.content?.slice(
										0,
										50
									)}..."`
								);
							} else {
								console.log(
									`⏭️ Skipping duplicate question message for subnet ${index}:`,
									message.type
								);
							}
						}
					});

					// Questions are now handled within createSubnetMessages function

					// Handle notifications with deduplication
					// Show notifications for pending subnets with data, or when there are status transitions
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
								console.log(
									`🔔 Notification message generated for subnet ${index}`
								);
							}
						} else {
							console.log(
								`⏭️ Skipping duplicate notification for subnet ${index}`
							);
						}
					}
				}

				// Handle feedback history - show as individual messages (only when includeHistory is true)
				if (hasFeedbackHistory) {
					if (includeHistory) {
						console.log(
							`📋 Processing feedback history for subnet ${index} with ${subnet.feedbackHistory.length} items`
						);
					} else {
						console.log(
							`⏭️ Skipping feedback history for subnet ${index} (includeHistory=false) - ${subnet.feedbackHistory.length} items`
						);
					}
				}

				if (hasFeedbackHistory && includeHistory) {
					console.log(
						`📋 Processing feedback history for subnet ${index} - this replaces duplicate data from subnet.data field`
					);
					subnet.feedbackHistory.forEach(
						(feedbackItem: any, feedbackIndex: number) => {
							const feedbackBaseKey = `feedback_${workflowId}_${index}_${feedbackIndex}`;

							// Create system response message from feedback history
							// Note: This contains the same data as subnet.data but in processed form
							const responseKey = `${feedbackBaseKey}_response`;
							if (!messageIds.has(responseKey)) {
								const responseMessage: ChatMsg = {
									id: `feedback_response_${index}_${feedbackIndex}_${Date.now()}`,
									type: "response",
									content: feedbackItem.response.message,
									timestamp: new Date(
										feedbackItem.created_at
									),
									toolName: subnet.toolName,
									subnetIndex: index,
									sourceId: `subnet_${index}_feedback_response_${feedbackIndex}`,
								};
								dataMessages.push(responseMessage);
								messageIds.add(responseKey);
								console.log(
									`📋 Feedback response message generated for subnet ${index}, feedback ${feedbackIndex} (replaces duplicate subnet.data)`
								);
							}

							// Create question message from feedback history
							const questionKey = `${feedbackBaseKey}_question`;
							if (!messageIds.has(questionKey)) {
								// Question should appear after response - add small offset to created_at
								const responseTimestamp = new Date(
									feedbackItem.created_at
								);
								const questionTimestamp = new Date(
									responseTimestamp.getTime() + 1000
								); // 1 second after response

								const questionMessage: ChatMsg = {
									id: `feedback_question_${index}_${feedbackIndex}_${Date.now()}`,
									type: "question",
									content: feedbackItem.feedback_question,
									timestamp: questionTimestamp,
									toolName: subnet.toolName,
									subnetIndex: index,
									questionData: {
										type: "feedback",
										text: feedbackItem.feedback_question,
										itemID: feedbackItem.item_id,
										expiresAt: feedbackItem.updated_at,
									},
									sourceId: `subnet_${index}_feedback_question_${feedbackIndex}`,
								};
								questionMessages.push(questionMessage);
								messageIds.add(questionKey);
								console.log(
									`📋 Feedback question message generated for subnet ${index}, feedback ${feedbackIndex}`
								);
							}

							// Create answer message if user provided an answer
							if (
								feedbackItem.user_answer &&
								feedbackItem.user_answer.trim() !== ""
							) {
								const answerKey = `${feedbackBaseKey}_answer`;
								if (!messageIds.has(answerKey)) {
									const answerMessage: ChatMsg = {
										id: `feedback_answer_${index}_${feedbackIndex}_${Date.now()}`,
										type: "answer",
										content: feedbackItem.user_answer,
										timestamp: new Date(
											feedbackItem.updated_at
										),
										toolName: subnet.toolName,
										subnetIndex: index,
										sourceId: `subnet_${index}_feedback_answer_${feedbackIndex}`,
									};
									questionMessages.push(answerMessage);
									messageIds.add(answerKey);
									console.log(
										`📋 Feedback answer message generated for subnet ${index}, feedback ${feedbackIndex}`
									);
								}
							}
						}
					);

					// Handle current question if it's different from feedback history
					if (subnet.question) {
						const lastFeedbackQuestion =
							subnet.feedbackHistory[
								subnet.feedbackHistory.length - 1
							]?.feedback_question;
						const isNewQuestion =
							subnet.question.text !== lastFeedbackQuestion;

						if (isNewQuestion) {
							const currentQuestionKey = `current_question_${workflowId}_${index}`;
							if (!messageIds.has(currentQuestionKey)) {
								// Use subnet's updatedAt if available for proper chronological ordering
								const baseTimestamp = subnet.updatedAt
									? new Date(subnet.updatedAt)
									: new Date();
								// Question should appear after any data from the same subnet
								const questionTimestamp = new Date(
									baseTimestamp.getTime() + 1000
								);

								const currentQuestionMessage: ChatMsg = {
									id: `current_question_${index}_${Date.now()}`,
									type: "question",
									content: subnet.question.text,
									timestamp: questionTimestamp,
									subnetStatus: subnet.status,
									toolName: subnet.toolName,
									subnetIndex: index,
									questionData: subnet.question,
									sourceId: `subnet_${index}_current_question`,
								};
								questionMessages.push(currentQuestionMessage);
								messageIds.add(currentQuestionKey);
								console.log(
									`📋 Current question message generated for subnet ${index}`,
									{
										questionText:
											subnet.question.text?.slice(0, 50),
										timestamp:
											currentQuestionMessage.timestamp,
									}
								);
							}
						}
					}
				} else {
					console.log(
						`⏭️ Skipping subnet ${index} - no changes detected or no feedback history`
					);
				}

				// Clean up processing state when done
				if (currentStatus === "done" && processingMap.has(index)) {
					processingMap.delete(index);
					feedbackSet.delete(index);
					console.log(
						`🧹 Cleaned up processing state for subnet ${index}`
					);
				}
			});

			// Combine all messages and sort by timestamp for proper chronological order
			const allMessages = [...dataMessages, ...questionMessages].sort(
				(a, b) => {
					const timeA = a.timestamp
						? new Date(a.timestamp).getTime()
						: 0;
					const timeB = b.timestamp
						? new Date(b.timestamp).getTime()
						: 0;
					return timeA - timeB;
				}
			);

			console.log(
				`📝 Generated ${allMessages.length} messages for workflow ${workflowId} (${dataMessages.length} data, ${questionMessages.length} questions)`
			);
			console.log(
				`🔍 Message deduplication: ${messageIds.size} unique message keys tracked`
			);
			console.log(
				`🔍 Final messages:`,
				allMessages.map((msg) => ({
					type: msg.type,
					content: msg.content?.slice(0, 50),
					subnetStatus: msg.subnetStatus,
					toolName: msg.toolName,
					timestamp: msg.timestamp,
				}))
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
						console.log(
							`🔍 Creating pending message with substantial data for subnet ${index}:`,
							{
								rawData: subnet.data,
								dataType: typeof subnet.data,
								dataLength: subnet.data.length,
							}
						);

						const result = parseAgentResponse(subnet.data);
						let content = result.content || "";

						// Handle special data formats and nested structures
						try {
							const parsedData = JSON.parse(subnet.data);

							// Check for nested data structure (like in subnet 3)
							if (parsedData.data && parsedData.data.message) {
								content = parsedData.data.message;
							} else if (
								parsedData.enhancedPrompt &&
								parsedData.originalPrompt
							) {
								content = "Prompt enhancement detected";
							} else if (parsedData.message) {
								content = parsedData.message;
							}
						} catch (e) {
							console.log(
								`⚠️ Failed to parse JSON for pending subnet ${index}:`,
								e
							);
						}

						// Only add message if we have meaningful content
						if (content && content.length > 10) {
							// Use subnet's updatedAt if available, otherwise fall back to current time
							const baseTimestamp = subnet.updatedAt
								? new Date(subnet.updatedAt)
								: new Date();

							const dataMessage = {
								id: `subnet_${index}_data_${Date.now()}`,
								type: "workflow_subnet" as const,
								content,
								timestamp: baseTimestamp, // Use actual subnet update time
								subnetStatus: "done" as const, // Show as completed since it has data
								toolName: subnet.toolName,
								subnetIndex: index,
								imageData: result.imageData,
								isImage: result.isImage,
								contentType: result.contentType,
								sourceId: `${sourceId}_data`,
								contentHash: createContentHash(result),
							};
							dataMessages.push(dataMessage);

							// Check for questions in the data
							const questionData = extractQuestionData(
								subnet.data
							);
							if (questionData) {
								// Question should appear after data - add offset to base timestamp
								const questionTimestamp = new Date(
									baseTimestamp.getTime() + 1000
								);

								const questionMessage = {
									id: `subnet_${index}_question_${Date.now()}`,
									type: "question" as const,
									content: questionData.text,
									timestamp: questionTimestamp, // Use base timestamp + offset
									subnetStatus: "waiting_response" as const,
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
							content: "Processing with your feedback...",
							timestamp: new Date(),
							subnetStatus: "in_progress",
							toolName: subnet.toolName,
							subnetIndex: index,
							sourceId: `${sourceId}_processing_after_feedback`,
							isRegenerated: true,
						});
					} else {
						dataMessages.push({
							id: `subnet_${index}_processing_${Date.now()}`,
							type: "workflow_subnet",
							content: `Processing with ${
								subnet.toolName || "agent"
							}...`,
							timestamp: new Date(),
							subnetStatus: "in_progress",
							toolName: subnet.toolName,
							subnetIndex: index,
							sourceId: sourceId,
						});
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
							if (parsedData.data && parsedData.data.message) {
								content = parsedData.data.message;
							} else if (
								parsedData.enhancedPrompt &&
								parsedData.originalPrompt
							) {
								content = "Prompt enhancement detected";
							} else if (parsedData.message) {
								content = parsedData.message;
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
								timestamp: baseTimestamp, // Use actual subnet update time
								subnetStatus: "done" as const,
								toolName: subnet.toolName,
								subnetIndex: index,
								imageData: result.imageData,
								isImage: result.isImage,
								contentType: result.contentType,
								sourceId: `${sourceId}_data`,
								isRegenerated: isRegenerating,
								contentHash,
							};
							dataMessages.push(dataMessage);

							// Check for questions in the data and add them as separate messages
							const questionData = extractQuestionData(
								subnet.data
							);
							if (questionData) {
								// Question should appear after data - add a small offset to the base timestamp
								const questionTimestamp = new Date(
									baseTimestamp.getTime() + 1000
								); // 1 second after data

								const questionMessage = {
									id: `subnet_${index}_question_${Date.now()}`,
									type: "question" as const,
									content: questionData.text,
									timestamp: questionTimestamp,
									subnetStatus: "waiting_response" as const,
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

				case "waiting_response":
					// For waiting_response, we need to check both the data field and the direct question field
					console.log(
						`🔍 Processing waiting_response subnet ${index}:`,
						{
							hasData: !!subnet.data,
							hasQuestion: !!subnet.question,
							hasFeedbackHistory,
							includeHistory,
							dataPreview: subnet.data
								? JSON.stringify(subnet.data).slice(0, 100)
								: "no-data",
							questionText:
								subnet.question?.text?.slice(0, 50) ||
								"no-question",
						}
					);

					let content = "";
					let hasDataContent = false;
					let hasDirectQuestion = false;
					let questionData = null;

					// Skip processing subnet.data if feedback history exists and we're including history
					// BUT only if the subnet data content is actually duplicated in feedback history
					// This ensures OpenAI messages and other unique content in subnet.data are not lost
					let shouldSkipSubnetData = false;
					if (hasFeedbackHistory && includeHistory) {
						// Check if subnet.data content is already covered by feedback history
						const subnetDataContent = subnet.data
							? String(subnet.data)
							: "";
						const feedbackContent =
							subnet.feedbackHistory?.[0]?.response?.message ||
							"";

						// Only skip if the content is substantially similar (simple check)
						const isContentDuplicated =
							subnetDataContent.length > 0 &&
							feedbackContent.length > 0 &&
							(subnetDataContent.includes(
								feedbackContent.slice(0, 100)
							) ||
								feedbackContent.includes(
									subnetDataContent.slice(0, 100)
								));

						shouldSkipSubnetData = isContentDuplicated;

						console.log(
							`🔍 Subnet data duplication check for subnet ${index}:`,
							{
								hasSubnetData: subnetDataContent.length > 0,
								hasFeedbackContent: feedbackContent.length > 0,
								isDuplicated: shouldSkipSubnetData,
								subnetPreview: subnetDataContent.slice(0, 50),
								feedbackPreview: feedbackContent.slice(0, 50),
							}
						);

						if (shouldSkipSubnetData) {
							console.log(
								`⏭️ Skipping subnet.data processing for subnet ${index} - content duplicated in feedback history`
							);
						} else {
							console.log(
								`✅ Processing subnet.data for subnet ${index} - content not duplicated in feedback history`
							);
						}
					}

					// First, handle data content if it exists and we should process it
					if (subnet.data && !shouldSkipSubnetData) {
						const result = parseAgentResponse(subnet.data);
						content = result.content || "";

						// Handle special data formats
						try {
							const parsedData = JSON.parse(subnet.data);

							// Check for nested data structure
							if (parsedData.data && parsedData.data.message) {
								content = parsedData.data.message;
							} else if (
								parsedData.enhancedPrompt &&
								parsedData.originalPrompt
							) {
								content = "Prompt enhancement detected";
							} else if (parsedData.message) {
								content = parsedData.message;
							}

							// Check for questions embedded in the data
							if (
								parsedData.question ||
								(parsedData.data && parsedData.data.question)
							) {
								hasDataContent = true;
								const questionText =
									parsedData.question ||
									parsedData.data.question;

								// Extract question data if it's structured
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
										).toISOString(), // 30 minutes
									};
								}
							}
						} catch {
							// Use default content
						}

						hasDataContent = !!(content || result.imageData);

						// Always show data content if available
						if (hasDataContent) {
							// Use subnet's updatedAt if available, otherwise fall back to current time
							const baseTimestamp = subnet.updatedAt
								? new Date(subnet.updatedAt)
								: new Date();

							console.log(
								`✨ Adding data message for subnet ${index}:`,
								{
									contentPreview: content?.slice(0, 50),
									hasImageData: !!result.imageData,
									timestamp: baseTimestamp,
								}
							);

							const dataMessage = {
								id: `subnet_${index}_data_${Date.now()}`,
								type: "workflow_subnet" as const,
								content: content || "Data received",
								timestamp: baseTimestamp, // Use actual subnet update time
								subnetStatus: "done" as const,
								toolName: subnet.toolName,
								subnetIndex: index,
								imageData: result.imageData,
								isImage: result.isImage,
								contentType: result.contentType,
								sourceId: `${sourceId}_data`,
								contentHash: createContentHash(result),
							};
							dataMessages.push(dataMessage);
						}
					}

					// Check for direct question field (separate from data)
					if (subnet.question) {
						hasDirectQuestion = true;
						// Use the direct question field which is already structured
						questionData = subnet.question;
					}

					// Show question if we have one (either from data or direct field)
					if ((hasDataContent && questionData) || hasDirectQuestion) {
						const finalQuestionData =
							subnet.question || questionData;

						console.log(
							`✨ Adding question message for subnet ${index}:`,
							{
								questionText: finalQuestionData?.text?.slice(
									0,
									50
								),
								questionType: finalQuestionData?.type,
								hasDataContent,
								hasDirectQuestion,
								timestamp: new Date(
									Date.now() +
										(isQuestionArrivingLater ? 1000 : 100)
								),
							}
						);

						if (finalQuestionData) {
							// Use subnet's updatedAt if available for proper chronological ordering
							const baseTimestamp = subnet.updatedAt
								? new Date(subnet.updatedAt)
								: new Date();
							// Question should appear after any data from the same subnet
							const questionTimestamp = new Date(
								baseTimestamp.getTime() + 1000
							);

							const questionMessage = {
								id: `subnet_${index}_question_${Date.now()}`,
								type: "question" as const,
								content: finalQuestionData.text,
								timestamp: questionTimestamp,
								subnetStatus: "waiting_response" as const,
								toolName: subnet.toolName,
								subnetIndex: index,
								questionData: finalQuestionData,
								sourceId: `${sourceId}_question`,
							};
							questionMessages.push(questionMessage);
						}
					}

					// If we have neither data nor question, show waiting message
					if (!hasDataContent && !hasDirectQuestion) {
						dataMessages.push({
							id: `subnet_${index}_waiting_${Date.now()}`,
							type: "workflow_subnet",
							content: `Waiting for your response...`,
							timestamp: new Date(),
							subnetStatus: "waiting_response",
							toolName: subnet.toolName,
							subnetIndex: index,
							sourceId: sourceId,
						});
					}
					break;

				case "failed":
					// Create more informative error message
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

	// Create notification message
	const createNotificationMessage = useCallback(
		(subnet: any, index: number): ChatMsg => {
			return {
				id: `notification_${Date.now()}`,
				type: "notification",
				content: subnet.question.text,
				timestamp: new Date(),
				toolName: subnet.toolName,
				subnetStatus: subnet.status, // Add subnet status to link notification to subnet
				subnetIndex: index, // Add subnet index to link notification to subnet
				questionData: subnet.question,
				sourceId: `notification_${subnet.itemID}_${Date.now()}`,
			};
		},
		[]
	);

	// Get cached subnets for a workflow
	const getCachedSubnets = useCallback((workflowId: string) => {
		return useSubnetCacheStore.getState().getWorkflowSubnets(workflowId);
	}, []);

	// Check if subnet has specific data
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
		// Expose tracking maps for external use if needed
		getWorkflowMaps,
	};
};
