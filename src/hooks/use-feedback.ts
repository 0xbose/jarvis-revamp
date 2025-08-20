import { useState } from "react";
import { ChatMsg } from "@/types/chat";
import { apiKeyManager } from "@/utils/api-key-manager";
import { useSubnetCacheStore } from "@/stores/subnet-cache-store";
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
}: UseFeedbackProps) => {
	const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
	const { updateSubnetStatus } = useSubnetCacheStore();

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
		// Generate unique IDs for this feedback session
		const sessionId = Date.now();
		const feedbackMessageId = `feedback_${sessionId}`;
		const submittingMessageId = `submitting_${sessionId}`;
		const successMessageId = `success_${sessionId}`;
		const errorMessageId = `error_${sessionId}`;
		
		try {
			setIsSubmittingFeedback(true);

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

			// Create feedback message with subnet context
			const feedbackMessage: ChatMsg = {
				id: feedbackMessageId,
				type: "answer",
				content: feedback,
				timestamp: new Date(),
				subnetIndex: subnetWithQuestionIndex,
				toolName:
					currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
						?.toolName,
				sourceId: `realtime_feedback_${subnetWithQuestionIndex}`,
			};

			// Always append feedback message to the end for natural chat flow
			setChatMessages((prev) => {
				const newMessages = [...prev];
				// Always append to end to maintain chronological chat order
				newMessages.push(feedbackMessage);
				return newMessages;
			});

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
				
				// Use the fallback subnet's question
				const submittingMessage: ChatMsg = {
					id: submittingMessageId,
					type: "response",
					content: "Submitting feedback...",
					timestamp: new Date(),
					subnetIndex: subnetWithQuestionIndex,
					toolName:
						currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
							?.toolName,
				};

				// Always append submitting message to end
				setChatMessages((prev) => {
					const newMessages = [...prev];
					newMessages.push(submittingMessage);
					return newMessages;
				});

				await submitFeedbackToAPI(
					fallbackSubnet.question.text,
					feedback
				);
			} else {
				// Use the original subnet's question
				const submittingMessage: ChatMsg = {
					id: submittingMessageId,
					type: "response",
					content: "Submitting feedback...",
					timestamp: new Date(),
					subnetIndex: subnetWithQuestionIndex,
					toolName:
						currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
							?.toolName,
				};

				// Always append submitting message to end
				setChatMessages((prev) => {
					const newMessages = [...prev];
					newMessages.push(submittingMessage);
					return newMessages;
				});

				await submitFeedbackToAPI(
					subnetWithQuestion.question.text,
					feedback
				);
			}

			// Remove the submitting message
			setChatMessages((prev) =>
				prev.filter((msg) => msg.id !== submittingMessageId)
			);

			const successMessage: ChatMsg = {
				id: successMessageId,
				type: "response",
				content:
					"Feedback submitted successfully. Resuming workflow...",
				timestamp: new Date(),
				subnetIndex: subnetWithQuestionIndex,
				toolName:
					currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
						?.toolName,
			};

			// Always append success message to end
			setChatMessages((prev) => {
				const newMessages = [...prev];
				newMessages.push(successMessage);
				return newMessages;
			});

			setPrompt("");

			setWorkflowStatus("running");
			setIsExecuting(true);
			setIsInFeedbackMode(false);

			if (resumePolling) {
				console.log("🔄 Resuming polling after feedback submission");

				setTimeout(() => {
					resumePolling();
				}, 1000);
			}
		} catch (error) {
			// Clean up all messages added during this feedback session
			setChatMessages((prev) =>
				prev.filter((msg) => 
					msg.id !== feedbackMessageId &&
					msg.id !== submittingMessageId &&
					msg.id !== successMessageId &&
					msg.id !== errorMessageId
				)
			);

			const errorMessage: ChatMsg = {
				id: errorMessageId,
				type: "response",
				content: `Error submitting feedback: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				timestamp: new Date(),
			};
			setChatMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsSubmittingFeedback(false);
		}
	};

	const handleFeedbackProceed = async (question: string, answer: string) => {
		// Generate unique IDs for this feedback session
		const sessionId = Date.now();
		const proceedMessageId = `proceed_${sessionId}`;
		const submittingMessageId = `submitting_${sessionId}`;
		const successMessageId = `success_${sessionId}`;
		const errorMessageId = `error_${sessionId}`;
		
		try {
			setIsSubmittingFeedback(true);

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

			// Create proceed message with subnet context
			const proceedMessage: ChatMsg = {
				id: proceedMessageId,
				type: "answer",
				content: "Proceeding with current result",
				timestamp: new Date(),
				subnetIndex: subnetWithQuestionIndex, // Link to specific subnet
				toolName:
					currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
						?.toolName,
				sourceId: `realtime_proceed_${subnetWithQuestionIndex}`,
			};

			// Always append proceed message to the end for natural chat flow
			setChatMessages((prev) => {
				const newMessages = [...prev];
				// Always append to end to maintain chronological chat order
				newMessages.push(proceedMessage);
				return newMessages;
			});

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
				
				// Use the fallback subnet's question
				const submittingMessage: ChatMsg = {
					id: submittingMessageId,
					type: "response",
					content: "Processing feedback...",
					timestamp: new Date(),
					subnetIndex: subnetWithQuestionIndex,
					toolName:
						currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
							?.toolName,
				};

				// Always append submitting message to end
				setChatMessages((prev) => {
					const newMessages = [...prev];
					newMessages.push(submittingMessage);
					return newMessages;
				});

				await submitFeedbackToAPI(question, "Yes, proceed");
			} else {
				// Use the original subnet's question
				const submittingMessage: ChatMsg = {
					id: submittingMessageId,
					type: "response",
					content: "Processing feedback...",
					timestamp: new Date(),
					subnetIndex: subnetWithQuestionIndex,
					toolName:
						currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
							?.toolName,
				};

				// Always append submitting message to end
				setChatMessages((prev) => {
					const newMessages = [...prev];
					newMessages.push(submittingMessage);
					return newMessages;
				});

				await submitFeedbackToAPI(question, "Yes, proceed");
			}

			// Remove the submitting message
			setChatMessages((prev) =>
				prev.filter((msg) => msg.id !== submittingMessageId)
			);

			const successMessage: ChatMsg = {
				id: successMessageId,
				type: "response",
				content:
					"Feedback processed successfully. Resuming workflow...",
				timestamp: new Date(),
				subnetIndex: subnetWithQuestionIndex,
				toolName:
					currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
						?.toolName,
			};

			// Always append success message to end
			setChatMessages((prev) => {
				const newMessages = [...prev];
				newMessages.push(successMessage);
				return newMessages;
			});

			setPrompt("");

			setWorkflowStatus("running");
			setIsExecuting(true);
			setIsInFeedbackMode(false);

			if (resumePolling) {
				console.log("🔄 Resuming polling after feedback submission");

				setTimeout(() => {
					resumePolling();
				}, 1000);
			}
		} catch (error) {
			// Clean up all messages added during this feedback session
			setChatMessages((prev) =>
				prev.filter((msg) => 
					msg.id !== proceedMessageId &&
					msg.id !== submittingMessageId &&
					msg.id !== successMessageId &&
					msg.id !== errorMessageId
				)
			);

			const errorMessage: ChatMsg = {
				id: errorMessageId,
				type: "response",
				content: `Error processing feedback: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				timestamp: new Date(),
			};
			setChatMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsSubmittingFeedback(false);
		}
	};

	const handleFeedbackResponse = async (feedback: string) => {
		// Generate unique IDs for this feedback session
		const sessionId = Date.now();
		const feedbackMessageId = `feedback_${sessionId}`;
		const submittingMessageId = `submitting_${sessionId}`;
		const successMessageId = `success_${sessionId}`;
		const errorMessageId = `error_${sessionId}`;
		
		try {
			setIsSubmittingFeedback(true);

			// Find the first subnet that has a question (for general feedback responses)
			const subnetWithQuestionIndex =
				currentWorkflowData?.subnets?.findIndex(
					(subnet: any) =>
						(subnet.status === "awaiting_response" ||
							(subnet.status === "pending" && subnet.question)) &&
						subnet.question
				);

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

			// Create feedback message with subnet context
			const feedbackMessage: ChatMsg = {
				id: feedbackMessageId,
				type: "answer",
				content: feedback,
				timestamp: new Date(),
				subnetIndex: subnetWithQuestionIndex,
				toolName:
					currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
						?.toolName,
				sourceId: `realtime_feedback_${subnetWithQuestionIndex}`,
			};

			// Always append feedback message to the end for natural chat flow
			setChatMessages((prev) => {
				const newMessages = [...prev];
				newMessages.push(feedbackMessage);
				return newMessages;
			});

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
				
				// Use the fallback subnet's question
				const submittingMessage: ChatMsg = {
					id: submittingMessageId,
					type: "response",
					content: "Submitting feedback...",
					timestamp: new Date(),
					subnetIndex: subnetWithQuestionIndex,
					toolName:
						currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
							?.toolName,
				};

				// Always append submitting message to end
				setChatMessages((prev) => {
					const newMessages = [...prev];
					newMessages.push(submittingMessage);
					return newMessages;
				});

				await submitFeedbackToAPI(
					fallbackSubnet.question.text,
					feedback
				);
			} else {
				// Use the original subnet's question
				const submittingMessage: ChatMsg = {
					id: submittingMessageId,
					type: "response",
					content: "Submitting feedback...",
					timestamp: new Date(),
					subnetIndex: subnetWithQuestionIndex,
					toolName:
						currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
							?.toolName,
				};

				// Always append submitting message to end
				setChatMessages((prev) => {
					const newMessages = [...prev];
					newMessages.push(submittingMessage);
					return newMessages;
				});

				await submitFeedbackToAPI(
					subnetWithQuestion.question.text,
					feedback
				);
			}

			// Remove the submitting message
			setChatMessages((prev) =>
				prev.filter((msg) => msg.id !== submittingMessageId)
			);

			const successMessage: ChatMsg = {
				id: successMessageId,
				type: "response",
				content:
					"Feedback submitted successfully. Resuming workflow...",
				timestamp: new Date(),
				subnetIndex: subnetWithQuestionIndex,
				toolName:
					currentWorkflowData?.subnets?.[subnetWithQuestionIndex]
						?.toolName,
			};

			// Always append success message to end
			setChatMessages((prev) => {
				const newMessages = [...prev];
				newMessages.push(successMessage);
				return newMessages;
			});

			setPrompt("");

			setWorkflowStatus("running");
			setIsExecuting(true);
			setIsInFeedbackMode(false);

			if (resumePolling) {
				console.log("🔄 Resuming polling after feedback submission");

				setTimeout(() => {
					resumePolling();
				}, 1000);
			}
		} catch (error) {
			// Clean up all messages added during this feedback session
			setChatMessages((prev) =>
				prev.filter((msg) => 
					msg.id !== feedbackMessageId &&
					msg.id !== submittingMessageId &&
					msg.id !== successMessageId &&
					msg.id !== errorMessageId
				)
			);

			const errorMessage: ChatMsg = {
				id: errorMessageId,
				type: "response",
				content: `Error submitting feedback: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				timestamp: new Date(),
			};
			setChatMessages((prev) => [...prev, errorMessage]);
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
