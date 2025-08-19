import { useState, useCallback } from "react";
import { ChatMsg, WorkflowStatus } from "@/types/chat";
import { workflowExecutor } from "@/utils/workflow-executor";
import { useWorkflowExecutionStore } from "@/stores/workflow-execution-store";
import { useWorkflowExecutor } from "@/hooks/use-workflow-executor";
import { useSubnetCacheStore } from "@/stores/subnet-cache-store";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";
import { AgentDetail } from "@/types";

interface UseWorkflowExecutionProps {
	updateMessagesWithSubnetData: (
		data: any,
		lastQuestionRef: React.MutableRefObject<string | null>,
		options?: {
			includeHistory?: boolean;
			isExistingWorkflow?: boolean;
		}
	) => void;
	setChatMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
	setPrompt: (prompt: string) => void;
	setIsInFeedbackMode: (inMode: boolean) => void;
	resetFeedbackState: () => void;
	lastQuestionRef: React.MutableRefObject<string | null>;
	setWorkflowId?: (workflowId: string) => void;
}

export const useWorkflowExecution = ({
	updateMessagesWithSubnetData,
	setChatMessages,
	setPrompt,
	setIsInFeedbackMode,
	resetFeedbackState,
	lastQuestionRef,
	setWorkflowId,
}: UseWorkflowExecutionProps) => {
	const [isExecuting, setIsExecuting] = useState(false);
	const [currentWorkflowData, setCurrentWorkflowData] = useState<any>(null);
	const [workflowStatus, setWorkflowStatus] =
		useState<WorkflowStatus>("running");
	const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(
		null
	);

	const { setPollingStatus, stopCurrentExecution } =
		useWorkflowExecutionStore();
	const { executeAgentWorkflow } = useWorkflowExecutor();
	const { clearWorkflowCache } = useSubnetCacheStore();

	const createStatusUpdateHandler = useCallback(
		(isNewWorkflow = false, isExistingWorkflow = false) => {
			let isFirstUpdate = true;

			return (data: any) => {
				console.log("📊 Status update received:", data, {
					isNewWorkflow,
					isExistingWorkflow,
					isFirstUpdate,
				});
				setCurrentWorkflowData(data);

				const workflowId = data?.requestId || data?.workflowId;
				if (workflowId && !currentWorkflowId) {
					setCurrentWorkflowId(workflowId);
					workflowExecutor.setCurrentWorkflowId(workflowId);

					if (setWorkflowId) {
						setWorkflowId(workflowId);
					}
				}

				if (
					isNewWorkflow &&
					data?.userPrompt &&
					data.userPrompt.trim().length > 0
				) {
					setChatMessages((prevMessages) => {
						const hasUserMessage = prevMessages.some(
							(msg) => msg.type === "user"
						);
						if (!hasUserMessage) {
							const userMessage: ChatMsg = {
								id: `user_${Date.now()}`,
								type: "user",
								content: data.userPrompt,
								timestamp: new Date(0),
							};
							return [userMessage, ...prevMessages];
						}
						return prevMessages;
					});
				}

				const hasNonAuthFeedback = data.subnets?.some(
					(subnet: any) =>
						subnet.status === "waiting_response" &&
						subnet.question &&
						subnet.question.type !== "authentication"
				);

				const hasAuthenticationPending = data.subnets?.some(
					(subnet: any) =>
						subnet.status === "waiting_response" &&
						subnet.question?.type === "authentication"
				);

				if (data.workflowStatus === "completed") {
					setIsExecuting(false);
					setPollingStatus(false);
					setWorkflowStatus("completed");
					setIsInFeedbackMode(false);
					resetFeedbackState();

					setChatMessages((prev) => {
						const hasCompletionMessage = prev.some(
							(msg) =>
								msg.type === "response" &&
								msg.content === "Workflow executed successfully"
						);

						if (!hasCompletionMessage) {
							// Use a timestamp that's definitely after all other messages
							const latestTimestamp =
								prev.length > 0
									? Math.max(
											...prev.map((msg) =>
												msg.timestamp
													? new Date(
															msg.timestamp
													  ).getTime()
													: 0
											)
									  )
									: Date.now();

							const completionMessage: ChatMsg = {
								id: `completion_${Date.now()}`,
								type: "response",
								content: "Workflow executed successfully",
								timestamp: new Date(latestTimestamp + 1000), // 1 second after the latest message
							};
							return [...prev, completionMessage];
						}
						return prev;
					});
				} else if (data.workflowStatus === "failed") {
					setIsExecuting(false);
					setPollingStatus(false);
					setWorkflowStatus("failed");
					setIsInFeedbackMode(false);
					resetFeedbackState();

					setChatMessages((prev) => {
						const hasErrorMessage = prev.some(
							(msg) =>
								msg.type === "response" &&
								msg.content?.includes(
									"Workflow execution failed"
								)
						);

						if (!hasErrorMessage) {
							// Create a more detailed error message
							const failedSubnets =
								data.subnets?.filter(
									(subnet: any) => subnet.status === "failed"
								) || [];
							let errorContent =
								"❌ **Workflow execution failed**";

							if (failedSubnets.length > 0) {
								const failedSubnetNames = failedSubnets
									.map(
										(subnet: any) =>
											subnet.toolName || "Unknown subnet"
									)
									.join(", ");
								errorContent += `\n\nFailed subnets: ${failedSubnetNames}`;
							}

							if (data.error) {
								errorContent += `\n\nError: ${data.error}`;
							}

							const errorMessage: ChatMsg = {
								id: `error_${Date.now()}`,
								type: "response",
								content: errorContent,
								timestamp: new Date(),
							};
							return [...prev, errorMessage];
						}
						return prev;
					});
				} else if (data.workflowStatus === "stopped") {
					console.log("🛑 Workflow stopped, halting all operations");
					setIsExecuting(false);
					setPollingStatus(false);
					setWorkflowStatus("stopped");
					setIsInFeedbackMode(false);
					resetFeedbackState();

					if (data.requestId && !currentWorkflowId) {
						setCurrentWorkflowId(data.requestId);
					}

					workflowExecutor.handleExternalStatusChange("stopped");
					workflowExecutor.forceStopPollingForWorkflow(
						data.requestId || currentWorkflowId || ""
					);
					stopCurrentExecution();
				} else if (data.workflowStatus === "in_progress") {
					setIsExecuting(true);
					setPollingStatus(true);
					setWorkflowStatus("in_progress");
					setIsInFeedbackMode(false);
				} else if (data.workflowStatus === "waiting_response") {
					if (hasNonAuthFeedback) {
						setIsExecuting(true);
						setPollingStatus(false);
						setWorkflowStatus("waiting_response");
						setIsInFeedbackMode(true);
					} else if (hasAuthenticationPending) {
						setIsExecuting(true);
						setPollingStatus(true);
						setWorkflowStatus("waiting_response");
						setIsInFeedbackMode(false);
					} else {
						setIsExecuting(true);
						setPollingStatus(true);
						setWorkflowStatus("waiting_response");
						setIsInFeedbackMode(true);
					}
				} else if (data.workflowStatus === "pending") {
					setIsExecuting(true);
					setPollingStatus(true);
					setWorkflowStatus("pending");
					setIsInFeedbackMode(false);
				}
			};
		},
		[
			currentWorkflowId,
			updateMessagesWithSubnetData,
			lastQuestionRef,
			setChatMessages,
			setPollingStatus,
			stopCurrentExecution,
			setIsInFeedbackMode,
			resetFeedbackState,
			setWorkflowId,
		]
	);

	const startPollingExistingWorkflow = useCallback(
		async (
			workflowId: string,
			skyBrowser: SkyMainBrowser,
			address: string
		) => {
			if (!skyBrowser || !address) {
				console.warn(
					"Cannot start polling: missing skyBrowser or address",
					{ skyBrowser: !!skyBrowser, address: !!address }
				);
				return;
			}

			try {
				setIsExecuting(true);
				setPollingStatus(true);

				setWorkflowStatus("pending");
				setCurrentWorkflowId(workflowId);

				workflowExecutor.setCurrentWorkflowId(workflowId);

				if (setWorkflowId) {
					setWorkflowId(workflowId);
				}

				const onStatusUpdate = createStatusUpdateHandler(false, true);

				const success =
					await workflowExecutor.startPollingExistingWorkflow(
						workflowId,
						skyBrowser,
						{ address },
						onStatusUpdate
					);

				if (!success) {
					throw new Error(
						"Failed to start polling for existing workflow"
					);
				}
			} catch (error) {
				console.error(
					"Error starting polling for existing workflow:",
					error
				);
				setIsExecuting(false);
				setPollingStatus(false);
				setWorkflowStatus("failed");
			}
		},
		[setPollingStatus, createStatusUpdateHandler, setWorkflowId]
	);

	const executeNewWorkflow = useCallback(
		async (
			selectedAgent: AgentDetail,
			message: string,
			address: string,
			skyBrowser: SkyMainBrowser,
			web3Context: Web3Context
		) => {
			try {
				setIsExecuting(true);
				setPollingStatus(true);
				setWorkflowStatus("running");
				setIsInFeedbackMode(false);
				resetFeedbackState();

				setCurrentWorkflowData(null);
				lastQuestionRef.current = null;

				const userMessage: ChatMsg = {
					id: `user_${Date.now()}`,
					type: "user",
					content: message,
					timestamp: new Date(0),
				};
				setChatMessages([userMessage]);

				const onStatusUpdate = createStatusUpdateHandler(true, false);

				const workflowId = await executeAgentWorkflow(
					selectedAgent as any,
					message,
					address,
					skyBrowser,
					web3Context,
					onStatusUpdate
				);

				setCurrentWorkflowId(workflowId);
				workflowExecutor.setCurrentWorkflowId(workflowId);

				if (setWorkflowId) {
					setWorkflowId(workflowId);
				}

				const currentUrl = new URL(window.location.href);
				currentUrl.searchParams.set("workflowId", workflowId);
				window.history.replaceState({}, "", currentUrl.toString());

				setPrompt("");
				return workflowId;
			} catch (error) {
				console.error("Error executing workflow:", error);
				setIsExecuting(false);
				setPollingStatus(false);
				setWorkflowStatus("failed");
				throw error;
			}
		},
		[
			setPollingStatus,
			setIsInFeedbackMode,
			resetFeedbackState,
			setChatMessages,
			lastQuestionRef,
			createStatusUpdateHandler,
			executeAgentWorkflow,
			setPrompt,
			setWorkflowId,
		]
	);

	const stopExecution = useCallback(
		async (skyBrowser: SkyMainBrowser, address: string) => {
			if (!skyBrowser || !address || !currentWorkflowId) {
				console.warn("Cannot stop execution: missing required data");
				return;
			}

			try {
				const success = await workflowExecutor.emergencyStop(
					skyBrowser,
					{ address },
					"User requested emergency stop",
					currentWorkflowId
				);

				if (success) {
					setIsExecuting(false);
					setPollingStatus(false);
					setWorkflowStatus("stopped");
					stopCurrentExecution();
				} else {
					console.error("❌ Failed to emergency stop workflow");
				}
			} catch (error) {
				console.error("Error during emergency stop:", error);
				setIsExecuting(false);
				setPollingStatus(false);
				setWorkflowStatus("stopped");
				stopCurrentExecution();
			}
		},
		[currentWorkflowId, setPollingStatus, stopCurrentExecution]
	);

	const resumeExecution = useCallback(
		async (skyBrowser: SkyMainBrowser, address: string) => {
			if (!skyBrowser || !address || !currentWorkflowId) {
				console.warn("Cannot resume execution: missing required data");
				return;
			}

			try {
				const newStatusCallback = (data: any) => {
					setCurrentWorkflowData(data);

					if (data?.requestId && !currentWorkflowId) {
						setCurrentWorkflowId(data.requestId);
						workflowExecutor.setCurrentWorkflowId(data.requestId);
					}
				};

				workflowExecutor.setCurrentStatusCallback(newStatusCallback);

				const success = await workflowExecutor.resumeWorkflow(
					skyBrowser,
					{ address },
					currentWorkflowId
				);

				if (success) {
					setIsExecuting(true);
					setPollingStatus(true);
					setWorkflowStatus("running");
				} else {
					console.error("❌ Failed to resume workflow");
				}
			} catch (error) {
				console.error("Error during workflow resume:", error);
				setIsExecuting(true);
				setPollingStatus(true);
				setWorkflowStatus("running");
			}
		},
		[currentWorkflowId, setPollingStatus]
	);

	const clearWorkflow = useCallback(() => {
		if (currentWorkflowId) {
			clearWorkflowCache(currentWorkflowId);
		}

		if (currentWorkflowId) {
			workflowExecutor.forceStopPollingForWorkflow(currentWorkflowId);
		}

		setCurrentWorkflowId(null);
		setCurrentWorkflowData(null);
		setIsExecuting(false);
		setPollingStatus(false);
		setWorkflowStatus("running");
		setIsInFeedbackMode(false);
		resetFeedbackState();
		workflowExecutor.clearCurrentWorkflow();
	}, [
		setPollingStatus,
		setIsInFeedbackMode,
		resetFeedbackState,
		currentWorkflowId,
		clearWorkflowCache,
	]);

	return {
		isExecuting,
		setIsExecuting,
		currentWorkflowData,
		setCurrentWorkflowData,
		workflowStatus,
		setWorkflowStatus,
		currentWorkflowId,
		setCurrentWorkflowId,
		startPollingExistingWorkflow,
		executeNewWorkflow,
		stopExecution,
		resumeExecution,
		clearWorkflow,
	};
};
