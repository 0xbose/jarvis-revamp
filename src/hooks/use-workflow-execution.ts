import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMsg, WorkflowStatus } from "@/types/chat";
import { WorkflowExecutionPayload, AgentDetail } from "@/types";
import { workflowExecutor } from "@/utils/workflow-executor";
import { useWorkflowExecutionStore, useExecutionStatusStore, useUIStore } from "@/stores";
import { useQueryClient } from "@tanstack/react-query";
import { useSubnetCache } from "./use-subnet-cache";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";
import { STATUS } from "@/config/constants";

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
	const [pollingStoppedAt, setPollingStoppedAt] = useState<Date | null>(null);
	const hasTimeoutMessageRef = useRef(false);

	const {
		setPollingStatus,
		stopCurrentExecution,
		setPollingTimeoutStatus,
		setRefreshUIStatus,
		setPollingTimers,
	} = useWorkflowExecutionStore();
	
	// Add executor store hooks
	const { updateExecutionStatus } = useExecutionStatusStore();
	const { updateTestStatus } = useUIStore();
	
	const queryClient = useQueryClient();
	
	// Use the subnet cache hook for subnet operations
	const { clearWorkflowCache, clearWorkflowTracking } = useSubnetCache();

	// Add executor functions directly in this hook
	const executeWorkflow = useCallback(
		async (
			payload: WorkflowExecutionPayload,
			skyBrowser: SkyMainBrowser,
			web3Context: Web3Context,
			onStatusUpdate?: (data: any) => void
		) => {
			try {
				updateExecutionStatus({ isRunning: true });
				updateTestStatus({
					isRunning: true,
					status: STATUS.PROCESSING,
				});

				const requestId = await workflowExecutor.executeWorkflow(
					payload,
					skyBrowser,
					web3Context,
					(statusData) => {
						console.log("📡 Workflow status update:", statusData);

						if (
							statusData.workflowStatus === "completed" ||
							statusData.workflowStatus === "failed"
						) {
							updateExecutionStatus({ isRunning: false });
							updateTestStatus({
								isRunning: false,
								status:
									statusData.workflowStatus === "completed"
										? STATUS.TEST_COMPLETED
										: STATUS.FAILED,
							});
						}

						if (
							statusData.workflowStatus === "in_progress" ||
							statusData.workflowStatus === "waiting"
						) {
							updateExecutionStatus({
								currentSubnet: statusData.currentSubnet,
							});
						}

						if (onStatusUpdate) {
							onStatusUpdate(statusData);
						}
					}
				);

				updateExecutionStatus({ responseId: requestId });
				return requestId;
			} catch (error: unknown) {
				updateExecutionStatus({ isRunning: false });
				updateTestStatus({ isRunning: false, status: STATUS.FAILED });
				throw error;
			}
		},
		[updateExecutionStatus, updateTestStatus]
	);

	const executeAgentWorkflow = useCallback(
		async (
			agentDetail: AgentDetail,
			userPrompt: string,
			userAddress: string,
			skyBrowser: SkyMainBrowser,
			web3Context: Web3Context,
			onStatusUpdate?: (data: any) => void
		) => {
			try {
				updateExecutionStatus({ isRunning: true });
				updateTestStatus({
					isRunning: true,
					status: STATUS.PROCESSING,
				});

				const requestId = await workflowExecutor.executeAgentWorkflow(
					agentDetail,
					userPrompt,
					userAddress,
					skyBrowser,
					web3Context,
					(statusData) => {
						console.log(
							"📡 Agent workflow status update:",
							statusData
						);

						if (
							statusData.workflowStatus === "completed" ||
							statusData.workflowStatus === "failed"
						) {
							updateExecutionStatus({ isRunning: false });
							updateTestStatus({
								isRunning: false,
								status:
									statusData.workflowStatus === "completed"
										? STATUS.TEST_COMPLETED
										: STATUS.FAILED,
							});
						}

						if (
							statusData.workflowStatus === "in_progress" ||
							statusData.workflowStatus === "waiting"
						) {
							updateExecutionStatus({
								currentSubnet: statusData.currentSubnet,
							});
						}

						if (onStatusUpdate) {
							onStatusUpdate(statusData);
						}
					}
				);

				updateExecutionStatus({ responseId: requestId });
				return requestId;
			} catch (error: unknown) {
				updateExecutionStatus({ isRunning: false });
				updateTestStatus({ isRunning: false, status: STATUS.FAILED });
				throw error;
			}
		},
		[updateExecutionStatus, updateTestStatus]
	);

	const createStatusUpdateHandler = useCallback(
		(isNewWorkflow = false, isExistingWorkflow = false) => {
			let isFirstUpdate = true;

			return (data: any) => {
				console.log("📊 Status update received:", data, {
					isNewWorkflow,
					isExistingWorkflow,
					isFirstUpdate,
					workflowStatus: data?.workflowStatus,
				});
				setCurrentWorkflowData(data);

				// Process subnet data and update messages
				if (data.subnets && data.subnets.length > 0) {
					console.log(
						`🔄 Processing subnet data in status update handler:`,
						{
							subnetCount: data.subnets.length,
							isExistingWorkflow,
							workflowStatus: data.workflowStatus,
						}
					);

					updateMessagesWithSubnetData(data, lastQuestionRef, {
						includeHistory: isExistingWorkflow,
						isExistingWorkflow,
					});
				}

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

				const hasUserInputRequired = data.subnets?.some(
					(subnet: any) =>
						subnet.status === "awaiting_response" &&
						subnet.question &&
						subnet.question.type !== "notification"
				);

				const hasNotificationQuestion = data.subnets?.some(
					(subnet: any) =>
						subnet.status === "awaiting_response" &&
						subnet.question?.type === "notification"
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

							// Don't add completion message - it clutters the subnet history
							// const completionMessage: ChatMsg = {
							// 	id: `completion_${Date.now()}`,
							// 	type: "response",
							// 	content: "Workflow executed successfully",
							// 	timestamp: new Date(latestTimestamp + 1000), // 1 second after the latest message
							// };
							// return [...prev, completionMessage];
							return prev;
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
				} else if (
					data.workflowStatus === "in_progress" ||
					data.workflowStatus === "waiting"
				) {
					setIsExecuting(true);
					setPollingStatus(true);
					setPollingStoppedAt(null); // Clear stopped time when polling resumes
					setWorkflowStatus("in_progress");
					setIsInFeedbackMode(false);
				} else if (data.workflowStatus === "awaiting_response") {
					if (hasUserInputRequired) {
						setIsExecuting(true);
						setPollingStatus(false);
						setPollingStoppedAt(new Date()); // Record when polling stopped
						setWorkflowStatus("awaiting_response");
						setIsInFeedbackMode(true);
					} else if (hasNotificationQuestion) {
						setIsExecuting(true);
						setPollingStatus(true);
						setPollingStoppedAt(null); // Clear stopped time when polling resumes
						setWorkflowStatus("awaiting_response");
						setIsInFeedbackMode(false);
					} else {
						setIsExecuting(true);
						setPollingStatus(true);
						setPollingStoppedAt(null); // Clear stopped time when polling resumes
						setWorkflowStatus("awaiting_response");
						setIsInFeedbackMode(true);
					}
				} else if (data.workflowStatus === "pending") {
					setIsExecuting(true);
					setPollingStatus(true);
					setPollingStoppedAt(null); // Clear stopped time when polling resumes
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
			clearWorkflowTracking(currentWorkflowId);
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
		queryClient,
	]);

	const refreshPolling = useCallback(() => {
		if (!currentWorkflowId) {
			console.warn("⚠️ Cannot refresh polling - no current workflow ID");
			return;
		}

		console.log(`🔄 Refreshing polling for workflow: ${currentWorkflowId}`);

		// Clear the polling stopped timestamp
		setPollingStoppedAt(null);

		// Resume polling with the current status handler
		const statusHandler = createStatusUpdateHandler(false, true);
		if (statusHandler) {
			// Get API key and resume polling
			// This will be handled by the workflow executor
			workflowExecutor.refreshPolling();

			// Update polling status
			setPollingStatus(true);
		} else {
			console.error("❌ Cannot refresh polling - no API key available");
		}
	}, [currentWorkflowId, createStatusUpdateHandler, setPollingStatus]);

	// Monitor workflow executor for timeout and refresh UI status
	useEffect(() => {
		if (!isExecuting) {
			setPollingTimeoutStatus(false);
			setRefreshUIStatus(false);
			setPollingTimers(0, 0);
			return;
		}

		const interval = setInterval(() => {
			// Check if polling has timed out
			const isTimedOut = workflowExecutor.isPollingTimedOut();
			setPollingTimeoutStatus(isTimedOut);

			// Check if refresh UI should be shown (based on polling duration only)
			const shouldShowRefresh =
				workflowExecutor.shouldShowRefreshUIWithStatus();
			setRefreshUIStatus(shouldShowRefresh);

			// Update timer values
			const duration = workflowExecutor.getPollingDuration();
			const timeSinceChange = workflowExecutor.getTimeSinceStatusChange();
			setPollingTimers(duration, timeSinceChange);

			// If polling has timed out, show refresh UI message
			// But only if we're actually polling and not in awaiting_response status
			if (
				isTimedOut &&
				!hasTimeoutMessageRef.current &&
				workflowExecutor.shouldShowRefreshUIWithStatus()
			) {
				console.log(
					"⏰ Polling timeout detected, showing refresh UI message"
				);
				console.log("🔍 Debug: Timeout conditions", {
					isTimedOut,
					hasTimeoutMessage: hasTimeoutMessageRef.current,
					shouldShowRefreshUI:
						workflowExecutor.shouldShowRefreshUIWithStatus(),
					workflowStatus: workflowExecutor.getCurrentWorkflowStatus(),
					isPolling: workflowExecutor.isPolling(),
					pollingDuration: workflowExecutor.getPollingDuration(),
				});
				hasTimeoutMessageRef.current = true;

				const timeoutMessage: ChatMsg = {
					id: `timeout_${Date.now()}`,
					type: "response",
					content:
						"Polling has been running for more than 5 minutes. Click refresh to continue monitoring the workflow.",
					timestamp: new Date(),
					isTimeoutMessage: true,
					showRefreshButton: true,
				};

				console.log(
					"📝 Adding refresh UI message to chat:",
					timeoutMessage
				);
				console.log("🔍 Message properties:", {
					isTimeoutMessage: timeoutMessage.isTimeoutMessage,
					showRefreshButton: timeoutMessage.showRefreshButton,
					type: timeoutMessage.type,
				});
				setChatMessages((prev) => [...prev, timeoutMessage]);
			}

			// If polling is refreshed and we have a timeout message, remove it
			if (!isTimedOut && hasTimeoutMessageRef.current) {
				console.log(
					"🔄 Polling refreshed, removing refresh UI message"
				);
				hasTimeoutMessageRef.current = false;
				setChatMessages((prev) =>
					prev.filter((msg) => !msg.isTimeoutMessage)
				);
			}

			// Also remove timeout message if status changes to awaiting_response
			if (
				hasTimeoutMessageRef.current &&
				workflowExecutor.getCurrentWorkflowStatus() ===
					"awaiting_response"
			) {
				console.log(
					"🔄 Status changed to awaiting_response, removing refresh UI message"
				);
				hasTimeoutMessageRef.current = false;
				setChatMessages((prev) =>
					prev.filter((msg) => !msg.isTimeoutMessage)
				);
			}
		}, 1000); // Check every second

		return () => clearInterval(interval);
	}, [
		isExecuting,
		setPollingTimeoutStatus,
		setRefreshUIStatus,
		setPollingTimers,
		setChatMessages,
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
		pollingStoppedAt,
		startPollingExistingWorkflow,
		executeNewWorkflow,
		stopExecution,
		resumeExecution,
		clearWorkflow,
		refreshPolling,
		executeWorkflow,
		executeAgentWorkflow,
	};
};
