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

	const subnetPreviousStatus = useRef<Map<string, Map<number, string>>>(
		new Map()
	);
	const feedbackGivenForSubnet = useRef<Map<string, Set<number>>>(new Map());
	const postFeedbackProcessing = useRef<Map<string, Map<number, boolean>>>(
		new Map()
	);
	const generatedMessageIds = useRef<Map<string, Set<string>>>(new Map());

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

				// SIMPLE LOGIC:
				// If feedbackHistory has items -> use ONLY feedbackHistory
				// If feedbackHistory is empty -> use ONLY original data
				const hasFeedbackData =
					hasFeedbackHistory && subnet.feedbackHistory.length > 0;

				const shouldGenerateMessage =
					!hasFeedbackData && // CRITICAL: Only generate original messages if NO feedback history exists
					!isResumingWorkflow && // Prevent message generation during workflow resumption
					((hasChanged && prevStatus) || // Status changed from a previous state
						(subnet.status === "in_progress" &&
							prevStatus === "pending") || // Start processing
						(subnet.status === "done" && subnet.data) || // Completed with data
						(subnet.status === "awaiting_response" &&
							subnet.data &&
							(prevStatus || !includeHistory)) || // Has data and waiting for response - always show during real-time updates
						(subnet.status === "pending" && hasSubstantialData) || // Pending with real data
						(prevStatus === "in_progress" &&
							subnet.status !== "in_progress") || // Transition away from processing
						isQuestionArrivingLater); // Question arriving later should always generate message

				if (shouldGenerateMessage) {
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
								message.subnetStatus === "awaiting_response"
							) {
								// Special handling for awaiting_response messages to prevent duplicates during resumption
								const dataHash = subnet.data
									? JSON.stringify(subnet.data).slice(0, 100)
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

							if (!messageIds.has(messageKey)) {
								questionMessages.push(message);
								messageIds.add(messageKey);
							} else {
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
							}
						} else {
							console.log(
								`⏭️ Skipping duplicate notification for subnet ${index}`
							);
						}
					}
				}

				// SIMPLE: If we have feedback history, use ONLY that
				if (hasFeedbackData) {
					console.log(
						`📊 Processing feedback history for subnet ${index}:`,
						{
							feedbackHistoryLength:
								subnet.feedbackHistory.length,
							firstFeedbackItem: subnet.feedbackHistory[0]
								? {
										question:
											subnet.feedbackHistory[0].feedback_question?.slice(
												0,
												50
											),
										responseMessage:
											subnet.feedbackHistory[0].response?.message?.slice(
												0,
												50
											),
										userAnswer:
											subnet.feedbackHistory[0]
												.user_answer,
								  }
								: null,
						}
					);

					// CRITICAL FIX: Reset message tracking for this subnet when processing feedback history
					// This ensures new feedback items are always processed
					const subnetMessageKeys = Array.from(messageIds).filter(
						(key) =>
							key.startsWith(`feedback_${workflowId}_${index}_`)
					);
					subnetMessageKeys.forEach((key) => messageIds.delete(key));

					console.log(
						`🔄 Reset message tracking for subnet ${index}, cleared ${subnetMessageKeys.length} keys`
					);

					// CRITICAL FIX: Sort feedback history by created_at to ensure chronological processing
					// This ensures the latest feedback response is shown, not the first one in the array
					const sortedFeedbackHistory = [...subnet.feedbackHistory].sort((a, b) => {
						const timeA = new Date(a.created_at).getTime();
						const timeB = new Date(b.created_at).getTime();
						return timeA - timeB; // oldest first, so latest response overwrites earlier ones
					});

					// CRITICAL FIX: Show ALL feedback history items to preserve the complete conversation flow
					// This ensures user answers and the progression of feedback are visible
					const feedbackToProcess = sortedFeedbackHistory;

					console.log(
						`🔍 Processing all feedback history items: ${feedbackToProcess.length} items`,
						feedbackToProcess.map((item) => ({
							question: item.feedback_question?.slice(0, 30),
							response: item.response?.message?.slice(0, 30),
							userAnswer: item.user_answer,
							createdAt: item.created_at,
						}))
					);

					// DEBUG: Log all feedback history items to understand what's being processed
					console.log(
						`🔍 Processing ${feedbackToProcess.length} feedback history items (chronologically sorted):`,
						feedbackToProcess.map(
							(item: any, idx: number) => ({
								index: idx,
								id: item.id,
								question: item.feedback_question?.slice(0, 50),
								response: item.response?.message?.slice(0, 50),
								userAnswer: item.user_answer,
								hasUserAnswer: !!(
									item.user_answer &&
									item.user_answer.trim() !== "" &&
									item.user_answer !== null
								),
								createdAt: item.created_at,
								updatedAt: item.updated_at,
							})
						)
					);

					// Process feedback history to show refined responses and questions
					// This replaces original subnet data with processed feedback responses
					console.log(
						`🚀 Starting feedback history processing for subnet ${index}:`,
						{
							feedbackHistoryLength:
								feedbackToProcess.length,
							messageIdsSize: messageIds.size,
							willProcessItems: feedbackToProcess.length,
						}
					);

					feedbackToProcess.forEach(
						(feedbackItem: any, feedbackIndex: number) => {
							const feedbackBaseKey = `feedback_${workflowId}_${index}_${feedbackIndex}`;

							console.log(
								`🔍 Processing feedback item ${feedbackIndex}:`,
								{
									question:
										feedbackItem.feedback_question?.slice(
											0,
											50
										),
									response:
										feedbackItem.response?.message?.slice(
											0,
											50
										),
									userAnswer: feedbackItem.user_answer,
									hasUserAnswer: !!(
										feedbackItem.user_answer &&
										feedbackItem.user_answer.trim() !==
											"" &&
										feedbackItem.user_answer !== null
									),
									// CRITICAL DEBUG: Show full response structure
									fullResponse: feedbackItem.response,
									hasResponse: !!feedbackItem.response,
									hasResponseMessage:
										!!feedbackItem.response?.message,
									responseMessageType:
										typeof feedbackItem.response?.message,
									responseMessageLength:
										feedbackItem.response?.message?.length,
								}
							);

							// Create system response message from feedback history
							// This is the processed/refined version that replaces subnet.data
							// IMPORTANT: Response appears FIRST, then question follows
							const responseKey = `${feedbackBaseKey}_response`;
							const sourceId = `subnet_${index}_feedback_response_${feedbackIndex}`;

							// CRITICAL FIX: Check if message already exists in current messages, not just messageIds
							const messageAlreadyExists =
								dataMessages.some(
									(msg) => msg.sourceId === sourceId
								) ||
								questionMessages.some(
									(msg) => msg.sourceId === sourceId
								);

							console.log(
								`🔍 Feedback response message check for index ${feedbackIndex}:`,
								{
									responseKey,
									sourceId,
									messageIdsHasKey:
										messageIds.has(responseKey),
									messageAlreadyExists,
									responseContent:
										feedbackItem.response?.message?.slice(
											0,
											100
										),
									willCreate:
										!messageIds.has(responseKey) &&
										!messageAlreadyExists,
								}
							);

							// CRITICAL FIX: Always create feedback history responses, ignore messageIds check
							// since we cleared the tracking for this subnet above
							if (!messageAlreadyExists) {
								// CRITICAL CHECK: Ensure we have valid content before creating message
								if (
									!feedbackItem.response?.message ||
									feedbackItem.response.message.trim() === ""
								) {
									console.log(
										`⚠️ SKIPPING feedback response creation - no valid content:`,
										{
											feedbackIndex,
											hasResponse:
												!!feedbackItem.response,
											hasMessage:
												!!feedbackItem.response
													?.message,
											messageContent:
												feedbackItem.response?.message,
											messageLength:
												feedbackItem.response?.message
													?.length,
											messageTrimmed:
												feedbackItem.response?.message?.trim(),
										}
									);
									return; // Skip this feedback item
								}
								console.log(
									`📝 Creating feedback response message:`,
									{
										feedbackIndex,
										messageContent:
											feedbackItem.response?.message?.slice(
												0,
												100
											),
										hasMessage:
											!!feedbackItem.response?.message,
										responseStructure: {
											hasResponse:
												!!feedbackItem.response,
											hasMessage:
												!!feedbackItem.response
													?.message,
											hasData:
												!!feedbackItem.response?.data,
											hasSuccess:
												feedbackItem.response
													?.success !== undefined,
										},
									}
								);

								// CRITICAL DEBUG: Log the exact content being used
								console.log(
									`🔍 Creating response message with content:`,
									{
										rawContent:
											feedbackItem.response.message,
										contentType:
											typeof feedbackItem.response
												.message,
										contentLength:
											feedbackItem.response.message
												?.length,
										contentPreview:
											feedbackItem.response.message?.slice(
												0,
												100
											),
										willUseContent:
											!!feedbackItem.response.message &&
											feedbackItem.response.message.trim() !==
												"",
									}
								);

								const responseMessage: ChatMsg = {
									id: `feedback_response_${index}_${feedbackIndex}_${Date.now()}`,
									type: "response",
									content: feedbackItem.response.message,
									timestamp: new Date(
										feedbackItem.created_at
									),
									toolName: subnet.toolName,
									subnetIndex: index,
									sourceId: sourceId,
									prompt: subnet.prompt,
									// Include image data if present
									imageData: feedbackItem.response.fileData,
									isImage:
										!!feedbackItem.response.fileData &&
										feedbackItem.response.contentType?.startsWith(
											"image/"
										),
									contentType:
										feedbackItem.response.contentType,
								};
								dataMessages.push(responseMessage);
								messageIds.add(responseKey);

								// CRITICAL DEBUG: Verify message was added
								console.log(
									`🔍 After adding response message:`,
									{
										dataMessagesLength: dataMessages.length,
										lastMessage:
											dataMessages[
												dataMessages.length - 1
											],
										messageIdsSize: messageIds.size,
										addedMessageId: responseMessage.id,
										addedMessageContent:
											responseMessage.content?.slice(
												0,
												50
											),
									}
								);

								console.log(
									`✅ Successfully created and added feedback response message:`,
									{
										messageId: responseMessage.id,
										sourceId: responseMessage.sourceId,
										content: responseMessage.content?.slice(
											0,
											50
										),
										timestamp: responseMessage.timestamp,
										createdAt: feedbackItem.created_at,
										dataMessagesLength: dataMessages.length,
										messageIdsSize: messageIds.size,
										allDataMessages: dataMessages.map(
											(msg) => ({
												type: msg.type,
												content: msg.content?.slice(
													0,
													30
												),
												sourceId: msg.sourceId,
												timestamp: msg.timestamp,
											})
										),
									}
								);
							} else {
								console.log(
									`⏭️ SKIPPING duplicate feedback response for subnet ${index}, feedback ${feedbackIndex} - messageIds: ${messageIds.has(
										responseKey
									)}, messageExists: ${messageAlreadyExists}`
								);
							}

							// Create question message from feedback history
							// ALL questions in feedbackHistory should be type: "feedback"
							// IMPORTANT: Question appears AFTER the response message to ensure proper chat flow
							const questionKey = `${feedbackBaseKey}_question`;
							const questionSourceId = `subnet_${index}_feedback_question_${feedbackIndex}`;

							// CRITICAL FIX: Check if question message already exists
							const questionAlreadyExists =
								dataMessages.some(
									(msg) => msg.sourceId === questionSourceId
								) ||
								questionMessages.some(
									(msg) => msg.sourceId === questionSourceId
								);

							// CRITICAL FIX: Always create feedback history questions, ignore messageIds check
							// since we cleared the tracking for this subnet above
							if (!questionAlreadyExists) {
								// Question should appear after response - add small offset to created_at
								const responseTimestamp = new Date(
									feedbackItem.created_at
								);
								const questionTimestamp = new Date(
									responseTimestamp.getTime() + 2000
								); // 2 seconds after response to ensure proper ordering

								console.log(
									`✅ Creating question message for feedback:`,
									{
										feedbackIndex,
										questionText:
											feedbackItem.feedback_question?.slice(
												0,
												50
											),
										hasUserAnswer: !!(
											feedbackItem.user_answer &&
											feedbackItem.user_answer.trim() !==
												"" &&
											feedbackItem.user_answer !== null
										),
										userAnswer: feedbackItem.user_answer,
										fullQuestion:
											feedbackItem.feedback_question,
									}
								);

								const questionMessage: ChatMsg = {
									id: `feedback_question_${index}_${feedbackIndex}_${Date.now()}`,
									type: "question",
									content: feedbackItem.feedback_question,
									timestamp: questionTimestamp,
									toolName: subnet.toolName,
									subnetIndex: index,
									subnetStatus: subnet.status, // Add subnet status for feedback button logic
									questionData: {
										type: "feedback", // ALWAYS feedback type for questions in feedbackHistory
										text: feedbackItem.feedback_question,
										itemID: feedbackItem.item_id,
										expiresAt: feedbackItem.updated_at,
									},
									sourceId: questionSourceId,
								};
								questionMessages.push(questionMessage);
								messageIds.add(questionKey);

								console.log(
									`✅ Successfully created and added feedback question message:`,
									{
										messageId: questionMessage.id,
										sourceId: questionMessage.sourceId,
										content: questionMessage.content?.slice(
											0,
											50
										),
										timestamp: questionMessage.timestamp,
										responseTimestamp: new Date(
											feedbackItem.created_at
										),
										timeOffset: "2 seconds after response",
										questionMessagesLength:
											questionMessages.length,
									}
								);
							} else {
								console.log(
									`⏭️ Skipping duplicate question for feedback:`,
									{
										feedbackIndex,
										questionText:
											feedbackItem.feedback_question?.slice(
												0,
												50
											),
										userAnswer:
											feedbackItem.user_answer?.slice(
												0,
												30
											),
									}
								);
							}

							// Create answer message if user provided an answer
							// IMPORTANT: Answer appears AFTER the question to complete the feedback flow
							if (
								feedbackItem.user_answer &&
								feedbackItem.user_answer.trim() !== ""
							) {
								const answerKey = `${feedbackBaseKey}_answer`;
								const answerSourceId = `subnet_${index}_feedback_answer_${feedbackIndex}`;

								// CRITICAL FIX: Check if answer message already exists
								const answerAlreadyExists =
									dataMessages.some(
										(msg) => msg.sourceId === answerSourceId
									) ||
									questionMessages.some(
										(msg) => msg.sourceId === answerSourceId
									);

								// CRITICAL FIX: Always create feedback history answers, ignore messageIds check
								// since we cleared the tracking for this subnet above
								if (!answerAlreadyExists) {
									// Answer appears after question - ensure proper chronological order
									const responseTimestamp = new Date(
										feedbackItem.created_at
									);
									const questionTimestamp = new Date(
										responseTimestamp.getTime() + 2000
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
										`✅ Successfully created and added feedback answer message:`,
										{
											messageId: answerMessage.id,
											sourceId: answerMessage.sourceId,
											content:
												answerMessage.content?.slice(
													0,
													50
												),
											timestamp: answerMessage.timestamp,
											responseTimestamp: new Date(
												feedbackItem.created_at
											),
											questionTimestamp:
												new Date(
													feedbackItem.created_at
												).getTime() + 2000,
											timeOffset:
												"1 second after question",
											questionMessagesLength:
												questionMessages.length,
										}
									);
								}
							}
						}
					);

					// DEBUG: Log what was created for this subnet
					console.log(
						`📊 Feedback processing summary for subnet ${index}:`,
						{
							dataMessagesLength: dataMessages.length,
							questionMessagesLength: questionMessages.length,
							feedbackDataMessages: dataMessages.filter((msg) =>
								msg.sourceId?.startsWith(
									`subnet_${index}_feedback_`
								)
							).length,
							feedbackQuestionMessages: questionMessages.filter(
								(msg) =>
									msg.sourceId?.startsWith(
										`subnet_${index}_feedback_`
									)
							).length,
							allFeedbackMessages: [
								...dataMessages.filter((msg) =>
									msg.sourceId?.startsWith(
										`subnet_${index}_feedback_`
									)
								),
								...questionMessages.filter((msg) =>
									msg.sourceId?.startsWith(
										`subnet_${index}_feedback_`
									)
								),
							].map((msg) => ({
								type: msg.type,
								sourceId: msg.sourceId,
								content: msg.content?.slice(0, 30),
								timestamp: msg.timestamp,
							})),
						}
					);

					// CRITICAL DEBUG: Show message flow with timestamps
					const feedbackMessageFlow = [
						...dataMessages.filter((msg) =>
							msg.sourceId?.startsWith(
								`subnet_${index}_feedback_`
							)
						),
						...questionMessages.filter((msg) =>
							msg.sourceId?.startsWith(
								`subnet_${index}_feedback_`
							)
						),
					].sort((a, b) => {
						const timeA = a.timestamp
							? new Date(a.timestamp).getTime()
							: 0;
						const timeB = b.timestamp
							? new Date(b.timestamp).getTime()
							: 0;
						return timeA - timeB;
					});

					console.log(
						`🔍 Feedback message flow for subnet ${index} (chronological order):`,
						feedbackMessageFlow.map((msg, idx) => ({
							order: idx + 1,
							type: msg.type,
							content: msg.content?.slice(0, 50),
							timestamp: msg.timestamp,
							sourceId: msg.sourceId,
						}))
					);

					// CRITICAL FIX: Always process subnet.question if it exists, regardless of feedback history
					// The current active question from subnet.question should be shown even when feedback history exists
					if (subnet.question) {
						console.log(
							`🔍 Processing subnet.question (current active question):`,
							{
								subnetQuestionText: subnet.question.text?.slice(
									0,
									50
								),
								subnetStatus: subnet.status,
								hasFeedbackData,
							}
						);

						// CRITICAL FIX: Only show current subnet.question if it's NOT already answered in feedback history
						// This prevents showing old questions when new feedback history exists
						const isQuestionAlreadyAnswered =
							subnet.feedbackHistory?.some(
								(feedback: any) =>
									feedback.feedback_question ===
										subnet.question.text &&
									feedback.user_answer &&
									feedback.user_answer.trim() !== "" &&
									feedback.user_answer !== null
							);

						if (!isQuestionAlreadyAnswered) {
							// Always show current active subnet questions
							const currentQuestionKey = `current_question_${workflowId}_${index}`;
							if (!messageIds.has(currentQuestionKey)) {
								const baseTimestamp = subnet.updatedAt
									? new Date(subnet.updatedAt)
									: new Date();
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
									`✅ Current question message generated for subnet ${index}`,
									{
										questionText:
											subnet.question.text?.slice(0, 50),
										timestamp:
											currentQuestionMessage.timestamp,
										subnetStatus: subnet.status,
									}
								);
							} else {
								console.log(
									`⚠️ Question message already exists for subnet ${index}, key: ${currentQuestionKey}`
								);
							}
						} else {
							console.log(
								`⏭️ Skipping current subnet question - already answered in feedback history: "${subnet.question.text?.slice(
									0,
									50
								)}"`
							);
						}
					}

					// DEBUG: Log summary of created messages
					console.log(
						`📊 Feedback history processing complete for subnet ${index}:`,
						{
							dataMessagesCreated: dataMessages.filter((msg) =>
								msg.sourceId?.startsWith(
									`subnet_${index}_feedback_response_`
								)
							).length,
							questionMessagesCreated: questionMessages.filter(
								(msg) =>
									msg.sourceId?.startsWith(
										`subnet_${index}_feedback_question_`
									)
							).length,
							answerMessagesCreated: questionMessages.filter(
								(msg) =>
									msg.sourceId?.startsWith(
										`subnet_${index}_feedback_answer_`
									)
							).length,
							totalMessagesCreated:
								dataMessages.length + questionMessages.length,
							feedbackHistoryLength:
								feedbackToProcess.length,
						}
					);

					// CRITICAL DEBUG: Log all feedback messages that were created
					const feedbackMessages = [
						...dataMessages.filter((msg) =>
							msg.sourceId?.startsWith(
								`subnet_${index}_feedback_`
							)
						),
						...questionMessages.filter((msg) =>
							msg.sourceId?.startsWith(
								`subnet_${index}_feedback_`
							)
						),
					];

					console.log(
						`🔍 All feedback messages created for subnet ${index}:`,
						feedbackMessages.map((msg) => ({
							type: msg.type,
							content: msg.content?.slice(0, 50),
							sourceId: msg.sourceId,
							timestamp: msg.timestamp,
							subnetIndex: msg.subnetIndex,
						}))
					);

					// DEBUG: Log all created messages for this subnet
					const subnetDataMessages = dataMessages.filter(
						(msg) =>
							msg.subnetIndex === index &&
							msg.sourceId?.startsWith(
								`subnet_${index}_feedback_`
							)
					);
					const subnetQuestionMessages = questionMessages.filter(
						(msg) =>
							msg.subnetIndex === index &&
							msg.sourceId?.startsWith(
								`subnet_${index}_feedback_`
							)
					);

					console.log(
						`🔍 All created messages for subnet ${index}:`,
						{
							dataMessages: subnetDataMessages.map((msg) => ({
								type: msg.type,
								content: msg.content?.slice(0, 50),
								sourceId: msg.sourceId,
								timestamp: msg.timestamp,
							})),
							questionMessages: subnetQuestionMessages.map(
								(msg) => ({
									type: msg.type,
									content: msg.content?.slice(0, 50),
									sourceId: msg.sourceId,
									timestamp: msg.timestamp,
								})
							),
						}
					);
				} else {
					if (hasFeedbackData) {
						console.log(
							`⏭️ Skipping original data generation for subnet ${index} - feedback history exists, using feedback history only`
						);
					} else {
						console.log(
							`⏭️ Skipping subnet ${index} - no changes detected`
						);
					}
				}

				// Clean up processing state when done
				if (currentStatus === "done" && processingMap.has(index)) {
					processingMap.delete(index);
					feedbackSet.delete(index);
				}

				// DEBUG: Log final state for this subnet
				console.log(`📊 Final subnet ${index} state:`, {
					status: currentStatus,
					hasFeedbackHistory: !!subnet.feedbackHistory?.length,
					dataMessagesCount: dataMessages.filter(
						(msg) => msg.subnetIndex === index
					).length,
					questionMessagesCount: questionMessages.filter(
						(msg) => msg.subnetIndex === index
					).length,
					feedbackMessagesCount: [
						...dataMessages.filter(
							(msg) =>
								msg.subnetIndex === index &&
								msg.sourceId?.includes("feedback")
						),
						...questionMessages.filter(
							(msg) =>
								msg.subnetIndex === index &&
								msg.sourceId?.includes("feedback")
						),
					].length,
				});
			});

			// DEBUG: Log state after all subnets processed
			console.log(`📊 After processing all subnets:`, {
				totalDataMessages: dataMessages.length,
				totalQuestionMessages: questionMessages.length,
				totalFeedbackMessages: [
					...dataMessages.filter((msg) =>
						msg.sourceId?.includes("feedback")
					),
					...questionMessages.filter((msg) =>
						msg.sourceId?.includes("feedback")
					),
				].length,
				feedbackDataMessages: dataMessages
					.filter((msg) => msg.sourceId?.includes("feedback"))
					.map((msg) => ({
						type: msg.type,
						sourceId: msg.sourceId,
						subnetIndex: msg.subnetIndex,
					})),
				feedbackQuestionMessages: questionMessages
					.filter((msg) => msg.sourceId?.includes("feedback"))
					.map((msg) => ({
						type: msg.type,
						sourceId: msg.sourceId,
						subnetIndex: msg.subnetIndex,
					})),
			});

			// Final safeguard: Remove any original data messages if feedback history exists for the same subnet
			console.log(
				`🔍 Starting safeguarding process for ${dataMessages.length} data messages:`,
				dataMessages.map((msg) => ({
					type: msg.type,
					sourceId: msg.sourceId,
					subnetIndex: msg.subnetIndex,
					content: msg.content?.slice(0, 30),
					hasFeedbackInSource: msg.sourceId?.includes("feedback"),
				}))
			);

			const safeguardedDataMessages = dataMessages.filter((msg) => {
				console.log(`🔍 Safeguarding message:`, {
					messageId: msg.id,
					type: msg.type,
					sourceId: msg.sourceId,
					subnetIndex: msg.subnetIndex,
					content: msg.content?.slice(0, 30),
					hasFeedbackInSource: msg.sourceId?.includes("feedback"),
				});

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
							console.log(
								`🚫 Filtering out original data message for subnet ${subnetIndex}`,
								{
									messageId: msg.id,
									sourceId: msg.sourceId,
									content: msg.content?.slice(0, 50),
								}
							);
							return false;
						}
					}
				}
				// For response messages from feedback history, always keep them
				if (
					msg.type === "response" &&
					msg.sourceId?.includes("feedback")
				) {
					console.log(`✅ Keeping feedback response message`, {
						messageId: msg.id,
						sourceId: msg.sourceId,
						content: msg.content?.slice(0, 50),
						subnetIndex: msg.subnetIndex,
					});
				}

				console.log(`🔍 Message ${msg.id} will be kept`);
				return true;
			});

			console.log(`🔍 Data messages after safeguarding:`, {
				originalCount: dataMessages.length,
				safeguardedCount: safeguardedDataMessages.length,
				filteredOut:
					dataMessages.length - safeguardedDataMessages.length,
				keptMessages: safeguardedDataMessages.map((msg) => ({
					type: msg.type,
					content: msg.content?.slice(0, 30),
					sourceId: msg.sourceId,
					subnetIndex: msg.subnetIndex,
				})),
			});

			// Apply the same safeguard to question messages
			const safeguardedQuestionMessages = questionMessages.filter(
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
								console.log(
									`🚫 Filtering out original question message for subnet ${subnetIndex}`,
									{
										messageId: msg.id,
										sourceId: msg.sourceId,
										content: msg.content?.slice(0, 50),
									}
								);
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

			// Sort messages chronologically to maintain natural chat flow
			const allMessages = [
				...safeguardedDataMessages,
				...safeguardedQuestionMessages,
			].sort((a, b) => {
				const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
				const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
				return timeA - timeB;
			});

			// CRITICAL DEBUG: Show final message array before returning
			console.log(`🔍 Final allMessages array before return:`, {
				totalMessages: allMessages.length,
				messageTypes: allMessages.map((msg, idx) => ({
					index: idx,
					type: msg.type,
					sourceId: msg.sourceId,
					content: msg.content?.slice(0, 50),
					hasFeedbackInSource: msg.sourceId?.includes("feedback"),
					subnetIndex: msg.subnetIndex,
					timestamp: msg.timestamp,
				})),
			});

			// CRITICAL DEBUG: Log what happened to feedback messages during safeguarding
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

			console.log(`🔍 Feedback messages safeguarding check:`, {
				beforeSafeguard: feedbackMessagesBeforeSafeguard.length,
				afterSafeguard: feedbackMessagesAfterSafeguard.length,
				lostMessages:
					feedbackMessagesBeforeSafeguard.length -
					feedbackMessagesAfterSafeguard.length,
				beforeMessages: feedbackMessagesBeforeSafeguard.map((msg) => ({
					type: msg.type,
					sourceId: msg.sourceId,
					content: msg.content?.slice(0, 30),
				})),
				afterMessages: feedbackMessagesAfterSafeguard.map((msg) => ({
					type: msg.type,
					sourceId: msg.sourceId,
					content: msg.content?.slice(0, 30),
				})),
			});

			console.log(`📊 Final message array for workflow ${workflowId}:`, {
				totalMessages: allMessages.length,
				messageTypes: allMessages.map((msg) => ({
					type: msg.type,
					sourceId: msg.sourceId,
					content: msg.content?.slice(0, 30),
					hasFeedbackInSource: msg.sourceId?.includes("feedback"),
					subnetIndex: msg.subnetIndex,
				})),
			});

			// DEBUG: Log final message summary before returning
			console.log(
				`📊 processSubnetData complete for workflow ${workflowId}:`,
				{
					totalDataMessages: dataMessages.length,
					totalQuestionMessages: questionMessages.length,
					totalMessages:
						dataMessages.length + questionMessages.length,
					subnetCount: subnetData.length,
					finalReturnedMessages: allMessages.length,
					messageTypes: {
						data: dataMessages.map((msg) => ({
							type: msg.type,
							content: msg.content?.slice(0, 50),
							sourceId: msg.sourceId,
						})),
						questions: questionMessages.map((msg) => ({
							type: msg.type,
							content: msg.content?.slice(0, 50),
							sourceId: msg.sourceId,
						})),
					},
				}
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
							content: "Processing with your feedback...",
							timestamp: new Date(),
							subnetStatus: "in_progress",
							toolName: subnet.toolName,
							subnetIndex: index,
							sourceId: `${sourceId}_processing_after_feedback`,
							isRegenerated: true,
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
								content: `Contacting ${subnet.toolName} agent...`,
								timestamp: new Date(),
								subnetStatus: "in_progress",
								toolName: subnet.toolName,
								subnetIndex: index,
								sourceId: `${sourceId}_processing`,
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

					// CRITICAL FIX: Always skip original subnet.data when feedbackHistory exists
					// This prevents showing old/stale data for new feedback questions
					let shouldSkipSubnetData = false;
					if (hasFeedbackHistory) {
						shouldSkipSubnetData = true;
						console.log(
							`🚫 Skipping original subnet.data for subnet ${index} - feedback history exists (${subnet.feedbackHistory.length} items)`
						);
					}

					if (subnet.data && !shouldSkipSubnetData) {
						const result = parseAgentResponse(subnet.data);
						content = result.content || "";

						try {
							const parsedData = JSON.parse(subnet.data);

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

	const getCachedSubnets = useCallback((workflowId: string) => {
		return useSubnetCacheStore.getState().getWorkflowSubnets(workflowId);
	}, []);

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
