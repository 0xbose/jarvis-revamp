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
		try {
			setIsSubmittingFeedback(true);

		
			const subnetWithQuestionIndex =
				currentWorkflowData?.subnets?.findIndex(
					(subnet: any) =>
						(subnet.status === "waiting_response" ||
							(subnet.status === "pending" && subnet.question)) &&
						subnet.question
				);

			if (
				subnetWithQuestionIndex !== undefined &&
				subnetWithQuestionIndex >= 0 &&
				currentWorkflowId
			) {
			
				updateSubnetStatus(
					currentWorkflowId,
					subnetWithQuestionIndex,
					"in_progress"
				);
			}

			const feedbackMessage: ChatMsg = {
				id: `feedback_${Date.now()}`,
				type: "answer",
				content: feedback,
				timestamp: new Date(),
			};

			setChatMessages((prev) => [...prev, feedbackMessage]);

			const submittingMessage: ChatMsg = {
				id: `submitting_${Date.now()}`,
				type: "response",
				content: "Submitting feedback...",
				timestamp: new Date(),
			};
			setChatMessages((prev) => [...prev, submittingMessage]);

			await submitFeedbackToAPI(question, feedback);

			setChatMessages((prev) =>
				prev.filter((msg) => msg.id !== submittingMessage.id)
			);

			const successMessage: ChatMsg = {
				id: `success_${Date.now()}`,
				type: "response",
				content:
					"Feedback submitted successfully. Resuming workflow...",
				timestamp: new Date(),
			};
			setChatMessages((prev) => [...prev, successMessage]);

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
			setChatMessages((prev) =>
				prev.filter((msg) => msg.content !== "Submitting feedback...")
			);

			const errorMessage: ChatMsg = {
				id: `error_${Date.now()}`,
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
		try {
			setIsSubmittingFeedback(true);

		
			const subnetWithQuestionIndex =
				currentWorkflowData?.subnets?.findIndex(
					(subnet: any) =>
						(subnet.status === "waiting_response" ||
							(subnet.status === "pending" && subnet.question)) &&
						subnet.question
				);

			if (
				subnetWithQuestionIndex !== undefined &&
				subnetWithQuestionIndex >= 0 &&
				currentWorkflowId
			) {
			
				updateSubnetStatus(
					currentWorkflowId,
					subnetWithQuestionIndex,
					"in_progress"
				);
			}

			const proceedMessage: ChatMsg = {
				id: `proceed_${Date.now()}`,
				type: "answer",
				content: "Proceeding with current result",
				timestamp: new Date(),
			};

			setChatMessages((prev) => [...prev, proceedMessage]);

			const submittingMessage: ChatMsg = {
				id: `submitting_${Date.now()}`,
				type: "response",
				content: "Processing feedback...",
				timestamp: new Date(),
			};
			setChatMessages((prev) => [...prev, submittingMessage]);

			await submitFeedbackToAPI(question, "Yes, proceed");

			setChatMessages((prev) =>
				prev.filter((msg) => msg.id !== submittingMessage.id)
			);

			const successMessage: ChatMsg = {
				id: `success_${Date.now()}`,
				type: "response",
				content:
					"Feedback processed successfully. Resuming workflow...",
				timestamp: new Date(),
			};
			setChatMessages((prev) => [...prev, successMessage]);

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
			setChatMessages((prev) =>
				prev.filter((msg) => msg.content !== "Processing feedback...")
			);

			const errorMessage: ChatMsg = {
				id: `error_${Date.now()}`,
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
		try {
			setIsSubmittingFeedback(true);

		
			const subnetWithQuestionIndex =
				currentWorkflowData?.subnets?.findIndex(
					(subnet: any) =>
						(subnet.status === "waiting_response" ||
							(subnet.status === "pending" && subnet.question)) &&
						subnet.question
				);

			if (
				subnetWithQuestionIndex !== undefined &&
				subnetWithQuestionIndex >= 0 &&
				currentWorkflowId
			) {
			
				updateSubnetStatus(
					currentWorkflowId,
					subnetWithQuestionIndex,
					"in_progress"
				);
			}

			const feedbackMessage: ChatMsg = {
				id: `feedback_${Date.now()}`,
				type: "answer",
				content: feedback,
				timestamp: new Date(),
			};

			setChatMessages((prev) => [...prev, feedbackMessage]);

			const subnetWithQuestion = currentWorkflowData?.subnets?.find(
				(subnet: any) =>
					(subnet.status === "waiting_response" ||
						(subnet.status === "pending" && subnet.question)) &&
					subnet.question
			);

			if (!subnetWithQuestion?.question?.text) {
				throw new Error("No question found to answer");
			}

			const submittingMessage: ChatMsg = {
				id: `submitting_${Date.now()}`,
				type: "response",
				content: "Submitting feedback...",
				timestamp: new Date(),
			};
			setChatMessages((prev) => [...prev, submittingMessage]);

			await submitFeedbackToAPI(
				subnetWithQuestion.question.text,
				feedback
			);

			setChatMessages((prev) =>
				prev.filter((msg) => msg.id !== submittingMessage.id)
			);

			const successMessage: ChatMsg = {
				id: `success_${Date.now()}`,
				type: "response",
				content:
					"Feedback submitted successfully. Resuming workflow...",
				timestamp: new Date(),
			};
			setChatMessages((prev) => [...prev, successMessage]);

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
			setChatMessages((prev) =>
				prev.filter((msg) => msg.content !== "Submitting feedback...")
			);

			const errorMessage: ChatMsg = {
				id: `error_${Date.now()}`,
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
