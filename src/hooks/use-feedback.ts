import { useState } from "react";
import { ChatMsg } from "@/types/chat";
import { apiKeyManager } from "@/utils/api-key-manager";
import { useQueryClient } from "@tanstack/react-query";
import { useSubnetCache } from "./use-subnet-cache";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";

interface UseFeedbackProps {
	currentWorkflowId: string | null;
	currentWorkflowData: any;
	skyBrowser: SkyMainBrowser | null;
	address: string | null;
	setChatMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
	setPrompt: (prompt: string) => void;
	setWorkflowStatus: (status: any) => void;
	setIsExecuting: (executing: boolean) => void;
	setIsInFeedbackMode: (inMode: boolean) => void;
	resumePolling?: () => void;
	refetchHistory?: () => void;
}

export const useFeedback = ({
	currentWorkflowId,
	currentWorkflowData,
	skyBrowser,
	address,
	setChatMessages,
	setPrompt,
	setWorkflowStatus,
	setIsExecuting,
	setIsInFeedbackMode,
	resumePolling,
	refetchHistory,
}: UseFeedbackProps) => {
	const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
	const queryClient = useQueryClient();
	
	// Use the subnet cache hook for subnet operations
	const { updateSubnetStatus } = useSubnetCache();

	const submitFeedbackToAPI = async (question: string, answer: string) => {
		if (!currentWorkflowId || !skyBrowser || !address) {
			throw new Error("Missing required data for feedback submission");
		}

		const nftUserAgentUrl = process.env.NEXT_PUBLIC_NFT_USER_AGENT_URL;
		if (!nftUserAgentUrl) {
			throw new Error("Feedback submission endpoint not configured");
		}

		const apiKey = await apiKeyManager.getApiKey(skyBrowser, { address });
		if (!apiKey) {
			throw new Error("Failed to authenticate feedback submission");
		}

		const contextPayload = {
			workflowId: currentWorkflowId,
			answer: answer,
			question: question,
		};

		const response = await fetch(`${nftUserAgentUrl}/natural-request`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
			},
			body: JSON.stringify(contextPayload),
		});

		if (!response.ok) {
			throw new Error(
				`Failed to submit feedback: ${response.status} ${response.statusText}`
			);
		}

		return await response.json();
	};

	const handleFeedbackSubmit = async (
		question: string,
		answer: string,
		feedback: string
	) => {
		// Generate unique ID for this feedback answer
		const sessionId = Date.now();
		const feedbackAnswerId = `feedback_answer_${sessionId}`;
		
		// Find the subnet that has the SPECIFIC question being answered
		const subnetWithQuestionIndex =
			currentWorkflowData?.subnets?.findIndex((subnet: any) => {
				// Check if the subnet has the question directly
				if (subnet.question?.text === question) {
					return true;
				}

				// Check if the question is in the feedbackHistory
				if (
					subnet.feedbackHistory &&
					subnet.feedbackHistory.length > 0
				) {
					return subnet.feedbackHistory.some(
						(feedback: any) =>
							feedback.feedback_question === question
					);
				}

				return false;
			});

		// Create retry handler for this specific feedback submission
		const retrySubmission = async () => {
			// Remove the failed message and retry
			setChatMessages((prev) => prev.filter(msg => msg.id !== feedbackAnswerId));
			await handleFeedbackSubmit(question, answer, feedback);
		};

		// Create feedback answer message showing what's being sent
		const feedbackAnswerMessage: ChatMsg = {
			id: feedbackAnswerId,
			type: "answer",
			content: feedback,
			timestamp: new Date(),
			isFeedbackAnswer: true,
			subnetIndex: subnetWithQuestionIndex >= 0 ? subnetWithQuestionIndex : undefined,
			toolName: subnetWithQuestionIndex >= 0 ? currentWorkflowData?.subnets?.[subnetWithQuestionIndex]?.toolName : undefined,
			feedbackSubmissionState: {
				status: "sending",
				feedbackText: feedback,
				retryHandler: retrySubmission
			},
		};

		// Add feedback answer message to show user what's being sent
		setChatMessages((prev) => {
			const newMessages = [...prev];
			newMessages.push(feedbackAnswerMessage);

			return newMessages;
		});
		
		try {
			setIsSubmittingFeedback(true);

			if (
				subnetWithQuestionIndex !== undefined &&
				subnetWithQuestionIndex >= 0 &&
				currentWorkflowId
			) {
				// Update subnet status to in_progress
				updateSubnetStatus(
					currentWorkflowId,
					subnetWithQuestionIndex,
					"in_progress"
				);
			}

			// Use the subnet we already found instead of searching again
			const subnetWithQuestion = currentWorkflowData?.subnets?.[subnetWithQuestionIndex];
			
			// If we couldn't find the specific subnet, fall back to finding any subnet with a question
			if (!subnetWithQuestion?.question?.text) {
				const fallbackSubnet = currentWorkflowData?.subnets?.find(
					(subnet: any) =>
						(subnet.status === "awaiting_response" ||
							(subnet.status === "pending" && subnet.question)) &&
						subnet.question?.text
				);
				
				if (!fallbackSubnet?.question?.text) {
					throw new Error("No question found to answer");
				}
			
				await submitFeedbackToAPI(
					fallbackSubnet.question.text,
					feedback
				);
			} else {
				// Use the original subnet's question
				await submitFeedbackToAPI(
					subnetWithQuestion.question.text,
					feedback
				);
			}

			// Don't add success message - it clutters the subnet history
			// const successMessage: ChatMsg = {
			// 	id: successMessageId,
			// 	type: "response",
			// 	content:
			// 		"Feedback submitted successfully. Resuming workflow...",
			// 	timestamp: new Date(),
			// 	subnetIndex: subnetWithQuestionIndex,
			// 	toolName:
			// 		currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
			// 			?.toolName,
			// };

			// Always append success message to end
			// setChatMessages((prev) => {
			// 	const newMessages = [...prev];
			// 	newMessages.push(successMessage);
			// 	return newMessages;
			// });

			setPrompt("");

			// Refetch chat sidebar history after successful feedback submission
			if (refetchHistory) {
				console.log("🔄 Refetching chat sidebar history after successful feedback submission");
				refetchHistory();
			}

			setWorkflowStatus("running");
			setIsExecuting(true);
			setIsInFeedbackMode(false);

			if (resumePolling) {
				console.log("🔄 Resuming polling after feedback submission");

				setTimeout(() => {
					resumePolling();
				}, 1000);
			}

			// Update feedback answer message to show success (remove submission state to show as normal answer)
			setChatMessages((prev) =>
				prev.map((msg) =>
					msg.id === feedbackAnswerId
						? {
								...msg,
								feedbackSubmissionState: undefined,
						  }
						: msg
				)
			);
		} catch (error) {
			console.error("Error submitting feedback:", error);
			
			// Update feedback answer message to show error with retry option
			setChatMessages((prev) =>
				prev.map((msg) =>
					msg.id === feedbackAnswerId
						? {
								...msg,
								feedbackSubmissionState: {
									...msg.feedbackSubmissionState!,
									status: "failed" as const,
									error: error instanceof Error ? error.message : "Failed to submit feedback",
								},
						  }
						: msg
				)
			);
		} finally {
			setIsSubmittingFeedback(false);
		}
	};

	const handleFeedbackProceed = async (question: string, answer: string) => {
		// Generate unique ID for this feedback answer
		const sessionId = Date.now();
		const proceedAnswerId = `proceed_answer_${sessionId}`;
		
		// Find the subnet that has the SPECIFIC question being answered
		const subnetWithQuestionIndex =
			currentWorkflowData?.subnets?.findIndex((subnet: any) => {
				// Check if the subnet has the question directly
				if (subnet.question?.text === question) {
					return true;
				}

				// Check if the question is in the feedbackHistory
				if (
					subnet.feedbackHistory &&
					subnet.feedbackHistory.length > 0
				) {
					return subnet.feedbackHistory.some(
						(feedback: any) =>
							feedback.feedback_question === question
					);
				}

				return false;
			});

		// Create retry handler for this specific feedback submission
		const retrySubmission = async () => {
			// Remove the failed message and retry
			setChatMessages((prev) => prev.filter(msg => msg.id !== proceedAnswerId));
			await handleFeedbackProceed(question, answer);
		};

		// Create feedback answer message showing "Yes, proceed"
		const proceedAnswerMessage: ChatMsg = {
			id: proceedAnswerId,
			type: "answer",
			content: "Yes, proceed",
			timestamp: new Date(),
			isFeedbackAnswer: true,
			subnetIndex: subnetWithQuestionIndex >= 0 ? subnetWithQuestionIndex : undefined,
			toolName: subnetWithQuestionIndex >= 0 ? currentWorkflowData?.subnets?.[subnetWithQuestionIndex]?.toolName : undefined,
			feedbackSubmissionState: {
				status: "sending",
				feedbackText: "Yes, proceed",
				retryHandler: retrySubmission
			},
		};

		// Add feedback answer message to show user what's being sent
		setChatMessages((prev) => {
			const newMessages = [...prev];
			newMessages.push(proceedAnswerMessage);

			return newMessages;
		});
		
		try {
			setIsSubmittingFeedback(true);

			if (
				subnetWithQuestionIndex !== undefined &&
				subnetWithQuestionIndex >= 0 &&
				currentWorkflowId
			) {
				// Update subnet status to in_progress
				updateSubnetStatus(
					currentWorkflowId,
					subnetWithQuestionIndex,
					"in_progress"
				);
			}

			// Don't add proceed message - it clutters the subnet history
			// const proceedMessage: ChatMsg = {
			// 	id: proceedMessageId,
			// 	type: "answer",
			// 	content: "Proceeding with current result",
			// 	timestamp: new Date(),
			// 	subnetIndex: subnetWithQuestionIndex, // Link to specific subnet
			// 	toolName:
			// 		currentWorkflowData?.subnets?.[subnetQuestionIndex]
			// 			?.toolName,
			// 	sourceId: `realtime_proceed_${subnetWithQuestionIndex}`,
			// };

			// Always append proceed message to the end for natural chat flow
			// setChatMessages((prev) => {
			// 	const newMessages = [...prev];
			// 	// Always append to end to maintain chronological chat order
			// 	newMessages.push(proceedMessage);
			// 	return newMessages;
			// });

			// Use the subnet we already found instead of searching again
			const subnetWithQuestion = currentWorkflowData?.subnets?.[subnetWithQuestionIndex];
			
			// If we couldn't find the specific subnet, fall back to finding any subnet with a question
			if (!subnetWithQuestion?.question?.text) {
				const fallbackSubnet = currentWorkflowData?.subnets?.find(
					(subnet: any) =>
						(subnet.status === "awaiting_response" ||
							(subnet.status === "pending" && subnet.question)) &&
						subnet.question?.text
				);
				
				if (!fallbackSubnet?.question?.text) {
					throw new Error("No question found to answer");
				}
				
				// Don't add processing message - it clutters the subnet history
				// const submittingMessage: ChatMsg = {
				// 	id: submittingMessageId,
				// 	type: "response",
				// 	content: "Processing feedback...",
				// 	timestamp: new Date(),
				// 	subnetIndex: subnetWithQuestionIndex,
				// 	toolName:
				// 		currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
				// 			?.toolName,
				// };

				// Always append submitting message to end
				// setChatMessages((prev) => {
				// 	const newMessages = [...prev];
				// 	newMessages.push(submittingMessage);
				// 	return newMessages;
				// });

				await submitFeedbackToAPI(question, "Yes, proceed");
			} else {
				// Don't add processing message - it clutters the subnet history
				// const submittingMessage: ChatMsg = {
				// 	id: submittingMessageId,
				// 	type: "response",
				// 	content: "Processing feedback...",
				// 	timestamp: new Date(),
				// 	subnetIndex: subnetWithQuestionIndex,
				// 	toolName:
				// 		currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
				// 			?.toolName,
				// };

				// Always append submitting message to end
				// setChatMessages((prev) => {
				// 	const newMessages = [...prev];
				// 	newMessages.push(submittingMessage);
				// 	return newMessages;
				// });

				await submitFeedbackToAPI(question, "Yes, proceed");
			}


			// Don't add success message - it clutters the subnet history
			// const successMessage: ChatMsg = {
			// 	id: successMessageId,
			// 	type: "response",
			// 	content:
			// 		"Feedback processed successfully. Resuming workflow...",
			// 	timestamp: new Date(),
			// 	subnetIndex: subnetWithQuestionIndex,
			// 	toolName:
			// 		currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
			// 			?.toolName,
			// };

			// Always append success message to end
			// setChatMessages((prev) => {
			// 	const newMessages = [...prev];
			// 	newMessages.push(successMessage);
			// 	return newMessages;
			// });

			setPrompt("");

			// Refetch chat sidebar history after successful feedback processing
			if (refetchHistory) {
				console.log("🔄 Refetching chat sidebar history after successful feedback processing");
				refetchHistory();
			}

			setWorkflowStatus("running");
			setIsExecuting(true);
			setIsInFeedbackMode(false);

			if (resumePolling) {
				console.log("🔄 Resuming polling after feedback submission");

				setTimeout(() => {
					resumePolling();
				}, 1000);
			}

			// Update feedback answer message to show success (remove submission state to show as normal answer)
			setChatMessages((prev) =>
				prev.map((msg) =>
					msg.id === proceedAnswerId
						? {
								...msg,
								feedbackSubmissionState: undefined,
						  }
						: msg
				)
			);
		} catch (error) {
			console.error("Error proceeding with feedback:", error);
			
			// Update feedback answer message to show error with retry option
			setChatMessages((prev) =>
				prev.map((msg) =>
					msg.id === proceedAnswerId
						? {
								...msg,
								feedbackSubmissionState: {
									...msg.feedbackSubmissionState!,
									status: "failed" as const,
									error: error instanceof Error ? error.message : "Failed to proceed with feedback",
								},
						  }
						: msg
				)
			);
		} finally {
			setIsSubmittingFeedback(false);
		}
	};

	const handleFeedbackResponse = async (feedback: string) => {
		// Generate unique ID for this feedback answer
		const sessionId = Date.now();
		const responseAnswerId = `response_answer_${sessionId}`;
		
		// Find the first subnet that has a question (for general feedback responses)
		const subnetWithQuestionIndex =
			currentWorkflowData?.subnets?.findIndex(
				(subnet: any) =>
					(subnet.status === "awaiting_response" ||
						(subnet.status === "pending" && subnet.question)) &&
					subnet.question
			);

		// Create retry handler for this specific feedback submission
		const retrySubmission = async () => {
			// Remove the failed message and retry
			setChatMessages((prev) => prev.filter(msg => msg.id !== responseAnswerId));
			await handleFeedbackResponse(feedback);
		};

		// Create feedback answer message showing the response
		const responseAnswerMessage: ChatMsg = {
			id: responseAnswerId,
			type: "answer",
			content: feedback,
			timestamp: new Date(),
			isFeedbackAnswer: true,
			subnetIndex: subnetWithQuestionIndex >= 0 ? subnetWithQuestionIndex : undefined,
			toolName: subnetWithQuestionIndex >= 0 ? currentWorkflowData?.subnets?.[subnetWithQuestionIndex]?.toolName : undefined,
			feedbackSubmissionState: {
				status: "sending",
				feedbackText: feedback,
				retryHandler: retrySubmission
			},
		};

		// Add feedback answer message to show user what's being sent
		setChatMessages((prev) => {
			const newMessages = [...prev];
			newMessages.push(responseAnswerMessage);

			return newMessages;
		});
		
		try {
			setIsSubmittingFeedback(true);

			if (
				subnetWithQuestionIndex !== undefined &&
				subnetWithQuestionIndex >= 0 &&
				currentWorkflowId
			) {
				// Update subnet status to in_progress
				updateSubnetStatus(
					currentWorkflowId,
					subnetWithQuestionIndex,
					"in_progress"
				);
			}

			// Use the subnet we already found instead of searching again
			const subnetWithQuestion = currentWorkflowData?.subnets?.[subnetWithQuestionIndex];
			
			// If we couldn't find the specific subnet, fall back to finding any subnet with a question
			if (!subnetWithQuestion?.question?.text) {
				const fallbackSubnet = currentWorkflowData?.subnets?.find(
					(subnet: any) =>
						(subnet.status === "awaiting_response" ||
							(subnet.status === "pending" && subnet.question)) &&
						subnet.question?.text
				);
				
				if (!fallbackSubnet?.question?.text) {
					throw new Error("No question found to answer");
				}
				
				// Don't add submitting message - it clutters the subnet history
				// const submittingMessage: ChatMsg = {
				// 	id: submittingMessageId,
				// 	type: "response",
				// 	content: "Submitting feedback...",
				// 	timestamp: new Date(),
				// 	subnetIndex: subnetWithQuestionIndex,
				// 	toolName:
				// 		currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
				// 			?.toolName,
				// };

				// Always append submitting message to end
				// setChatMessages((prev) => {
				// 	const newMessages = [...prev];
				// 	newMessages.push(submittingMessage);
				// 	return newMessages;
				// });

				await submitFeedbackToAPI(
					fallbackSubnet.question.text,
					feedback
				);
			} else {
				// Use the original subnet's question
				await submitFeedbackToAPI(
					subnetWithQuestion.question.text,
					feedback
				);
			}


			// Don't add success message - it clutters the subnet history
			// const successMessage: ChatMsg = {
			// 	id: successMessageId,
			// 	type: "response",
			// 	content:
			// 		"Feedback submitted successfully. Resuming workflow...",
			// 	timestamp: new Date(),
			// 	subnetIndex: subnetWithQuestionIndex,
			// 	toolName:
			// 		currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
			// 			?.toolName,
			// };

			// Always append success message to end
			// setChatMessages((prev) => {
			// 	const newMessages = [...prev];
			// 	newMessages.push(successMessage);
			// 	return newMessages;
			// });

			setPrompt("");

			// Refetch chat sidebar history after successful feedback response
			if (refetchHistory) {
				console.log("🔄 Refetching chat sidebar history after successful feedback response");
				refetchHistory();
			}

			setWorkflowStatus("running");
			setIsExecuting(true);
			setIsInFeedbackMode(false);

			if (resumePolling) {
				console.log("🔄 Resuming polling after feedback submission");

				setTimeout(() => {
					resumePolling();
				}, 1000);
			}

			// Update feedback answer message to show success (remove submission state to show as normal answer)
			setChatMessages((prev) =>
				prev.map((msg) =>
					msg.id === responseAnswerId
						? {
								...msg,
								feedbackSubmissionState: undefined,
						  }
						: msg
				)
			);
		} catch (error) {
			console.error("Error submitting feedback response:", error);
			
			// Update feedback answer message to show error with retry option
			setChatMessages((prev) =>
				prev.map((msg) =>
					msg.id === responseAnswerId
						? {
								...msg,
								feedbackSubmissionState: {
									...msg.feedbackSubmissionState!,
									status: "failed" as const,
									error: error instanceof Error ? error.message : "Failed to submit feedback response",
								},
						  }
						: msg
				)
			);
		} finally {
			setIsSubmittingFeedback(false);
		}
	};

	return {
		isSubmittingFeedback,
		handleFeedbackSubmit,
		handleFeedbackProceed,
		handleFeedbackResponse,
	};
};
