import { useState } from "react";
import { ChatMsg } from "@/types/chat";
import { apiKeyManager } from "@/utils/api-key-manager";
import { useSubnetCache } from "./use-subnet-cache";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { API_CONFIG } from "@/config/constants";

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
	const [retryingSubnetIndex, setRetryingSubnetIndex] = useState<
		number | null
	>(null);

	// Use the subnet cache hook for subnet operations
	const { updateSubnetStatus } = useSubnetCache();

	const submitFeedbackToAPI = async ({
		question,
		answer,
	}: {
		question?: string;
		answer: string;
	}) => {
		console.log(`🔍 submitFeedbackToAPI called with:`, {
			question,
			answer,
		});
		console.log(`🔍 Required data check:`, {
			currentWorkflowId: !!currentWorkflowId,
			skyBrowser: !!skyBrowser,
			address: !!address,
		});

		if (!currentWorkflowId || !skyBrowser || !address) {
			console.error(`❌ Missing required data:`, {
				currentWorkflowId,
				skyBrowser: !!skyBrowser,
				address,
			});
			throw new Error("Missing required data for feedback submission");
		}

		const nftUserAgentUrl = API_CONFIG.NFT_USER_AGENT_URL;
		console.log(`🔍 NFT User Agent URL:`, nftUserAgentUrl);

		if (!nftUserAgentUrl) {
			console.error(`❌ Feedback submission endpoint not configured`);
			throw new Error("Feedback submission endpoint not configured");
		}

		console.log(`🔑 Getting API key...`);
		const apiKey = await apiKeyManager.getApiKey(skyBrowser, { address });
		console.log(`🔑 API key result:`, apiKey ? "Success" : "Failed");

		if (!apiKey) {
			console.error(
				`❌ Failed to authenticate feedback submission - no API key`
			);
			throw new Error("Failed to authenticate feedback submission");
		}

		const contextPayload = {
			workflowId: currentWorkflowId,
			answer: answer,
			question: question || undefined,
		};

		const response = await fetch(`${nftUserAgentUrl}/natural-request`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
			},
			body: JSON.stringify(contextPayload),
		});

		console.log(
			`📥 Response status:`,
			response.status,
			response.statusText
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`❌ API request failed:`, {
				status: response.status,
				statusText: response.statusText,
				errorText,
			});
			throw new Error(
				`Failed to submit feedback: ${response.status} ${response.statusText}`
			);
		}

		const responseData = await response.json();
		console.log(`✅ API request successful:`, responseData);
		return responseData;
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
		const subnetWithQuestionIndex = currentWorkflowData?.subnets?.findIndex(
			(subnet: any) => {
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
			}
		);

		// Create retry handler for this specific feedback submission
		const retrySubmission = async () => {
			// Remove the failed message and retry
			setChatMessages((prev) =>
				prev.filter((msg) => msg.id !== feedbackAnswerId)
			);
			await handleFeedbackSubmit(question, answer, feedback);
		};

		// Create feedback answer message showing what's being sent
		const feedbackAnswerMessage: ChatMsg = {
			id: feedbackAnswerId,
			type: "answer",
			content: feedback,
			timestamp: new Date(),
			isFeedbackAnswer: true,
			subnetIndex:
				subnetWithQuestionIndex >= 0
					? subnetWithQuestionIndex
					: undefined,
			toolName:
				subnetWithQuestionIndex >= 0
					? currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
							?.toolName
					: undefined,
			feedbackSubmissionState: {
				status: "sending",
				feedbackText: feedback,
				retryHandler: retrySubmission,
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
			const subnetWithQuestion =
				currentWorkflowData?.subnets?.[subnetWithQuestionIndex];

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

				await submitFeedbackToAPI({
					question: fallbackSubnet.question.text,
					answer: feedback,
				});
			} else {
				// Use the original subnet's question
				await submitFeedbackToAPI({
					question: subnetWithQuestion.question.text,
					answer: feedback,
				});
			}

			setPrompt("");

			// Refetch chat sidebar history after successful feedback submission
			if (refetchHistory) {
				console.log(
					"🔄 Refetching chat sidebar history after successful feedback submission"
				);
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
									error:
										error instanceof Error
											? error.message
											: "Failed to submit feedback",
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
		const subnetWithQuestionIndex = currentWorkflowData?.subnets?.findIndex(
			(subnet: any) => {
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
			}
		);

		// Create retry handler for this specific feedback submission
		const retrySubmission = async () => {
			// Remove the failed message and retry
			setChatMessages((prev) =>
				prev.filter((msg) => msg.id !== proceedAnswerId)
			);
			await handleFeedbackProceed(question, answer);
		};

		// Create feedback answer message showing "Yes, proceed"
		const proceedAnswerMessage: ChatMsg = {
			id: proceedAnswerId,
			type: "answer",
			content: "Yes, proceed",
			timestamp: new Date(),
			isFeedbackAnswer: true,
			subnetIndex:
				subnetWithQuestionIndex >= 0
					? subnetWithQuestionIndex
					: undefined,
			toolName:
				subnetWithQuestionIndex >= 0
					? currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
							?.toolName
					: undefined,
			feedbackSubmissionState: {
				status: "sending",
				feedbackText: "Yes, proceed",
				retryHandler: retrySubmission,
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

			const subnetWithQuestion =
				currentWorkflowData?.subnets?.[subnetWithQuestionIndex];

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

				await submitFeedbackToAPI({
					question: question,
					answer: "Yes, proceed",
				});
			} else {
				await submitFeedbackToAPI({
					question: question,
					answer: "Yes, proceed",
				});
			}

			setPrompt("");

			if (refetchHistory) {
				refetchHistory();
			}

			setWorkflowStatus("running");
			setIsExecuting(true);
			setIsInFeedbackMode(false);

			if (resumePolling) {
				setTimeout(() => {
					resumePolling();
				}, 1000);
			}

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

			setChatMessages((prev) =>
				prev.map((msg) =>
					msg.id === proceedAnswerId
						? {
								...msg,
								feedbackSubmissionState: {
									...msg.feedbackSubmissionState!,
									status: "failed" as const,
									error:
										error instanceof Error
											? error.message
											: "Failed to proceed with feedback",
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
		const subnetWithQuestionIndex = currentWorkflowData?.subnets?.findIndex(
			(subnet: any) =>
				(subnet.status === "awaiting_response" ||
					(subnet.status === "pending" && subnet.question)) &&
				subnet.question
		);

		// Create retry handler for this specific feedback submission
		const retrySubmission = async () => {
			// Remove the failed message and retry
			setChatMessages((prev) =>
				prev.filter((msg) => msg.id !== responseAnswerId)
			);
			await handleFeedbackResponse(feedback);
		};

		// Create feedback answer message showing the response
		const responseAnswerMessage: ChatMsg = {
			id: responseAnswerId,
			type: "answer",
			content: feedback,
			timestamp: new Date(),
			isFeedbackAnswer: true,
			subnetIndex:
				subnetWithQuestionIndex >= 0
					? subnetWithQuestionIndex
					: undefined,
			toolName:
				subnetWithQuestionIndex >= 0
					? currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
							?.toolName
					: undefined,
			feedbackSubmissionState: {
				status: "sending",
				feedbackText: feedback,
				retryHandler: retrySubmission,
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
			const subnetWithQuestion =
				currentWorkflowData?.subnets?.[subnetWithQuestionIndex];

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

				await submitFeedbackToAPI({
					question: fallbackSubnet.question.text,
					answer: feedback,
				});
			} else {
				// Use the original subnet's question
				await submitFeedbackToAPI({
					question: subnetWithQuestion.question.text,
					answer: feedback,
				});
			}

			setPrompt("");

			// Refetch chat sidebar history after successful feedback response
			if (refetchHistory) {
				refetchHistory();
			}

			setWorkflowStatus("running");
			setIsExecuting(true);
			setIsInFeedbackMode(false);

			if (resumePolling) {
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
									error:
										error instanceof Error
											? error.message
											: "Failed to submit feedback response",
								},
						  }
						: msg
				)
			);
		} finally {
			setIsSubmittingFeedback(false);
		}
	};

	const handleRetrySubnet = async (subnetIndex: number) => {
		// Get the subnet data for the specified index
		const subnet = currentWorkflowData?.subnets?.[subnetIndex];
		if (!subnet) {
			throw new Error(`Subnet at index ${subnetIndex} not found`);
		}

		try {
			setRetryingSubnetIndex(subnetIndex);
			setIsSubmittingFeedback(true);

			setChatMessages((prev) =>
				prev.map((msg) =>
					msg.subnetIndex === subnetIndex
						? { ...msg, subnetStatus: "pending" as const }
						: msg
				)
			);

			// Update subnet status to pending in frontend cache
			if (currentWorkflowId) {
				updateSubnetStatus(currentWorkflowId, subnetIndex, "pending");
			} else {
				console.warn(
					`⚠️ No currentWorkflowId available for subnet retry`
				);
			}

			// Send retry request to backend via natural-request endpoint
			if (currentWorkflowId && skyBrowser && address) {
				try {
					await submitFeedbackToAPI({
						answer: `Please retry ${subnet.toolName || ""} agent`,
					});
				} catch (apiError) {
					console.warn(
						`⚠️ Backend retry request failed, but continuing with frontend retry:`,
						apiError
					);
					// Continue with frontend retry even if backend request fails
				}
			} else {
				console.warn(
					`⚠️ Missing required data for backend retry request:`,
					{
						currentWorkflowId: !!currentWorkflowId,
						skyBrowser: !!skyBrowser,
						address: !!address,
					}
				);
			}

			// Set workflow status to trigger re-execution
			setWorkflowStatus("in_progress");
			setIsExecuting(true);
			setIsInFeedbackMode(false);

			// Resume polling to monitor the retry execution
			if (resumePolling) {
				setTimeout(() => {
					resumePolling();
				}, 1000);
			} else {
				console.warn("⚠️ No resumePolling function available");
			}
		} catch (error) {
			console.error("❌ Error retrying subnet:", error);

			// Show user-friendly error message
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to retry subnet";
			console.error(`❌ Subnet retry failed: ${errorMessage}`);

			// Reset subnet status back to failed
			setChatMessages((prev) =>
				prev.map((msg) =>
					msg.subnetIndex === subnetIndex
						? { ...msg, subnetStatus: "failed" as const }
						: msg
				)
			);

			throw error;
		} finally {
			setRetryingSubnetIndex(null);
			setIsSubmittingFeedback(false);
		}
	};

	return {
		isSubmittingFeedback,
		handleFeedbackSubmit,
		handleFeedbackProceed,
		handleFeedbackResponse,
		handleRetrySubnet,
		retryingSubnetIndex,
	};
};
