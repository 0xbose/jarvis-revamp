"use client";
import ChatInput from "@/components/common/chat-input";
import { ChatMessage } from "@/components/common/chat-message";
import React, { useEffect, useState, useRef } from "react";
import { useGlobalStore } from "@/stores/global-store";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getAgentById } from "@/controllers/agents";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { AgentDetail } from "@/types";
import { useWorkflowExecutionStore } from "@/stores/workflow-execution-store";
import { useExecutionStatusStore } from "@/stores/execution-status-store";
import { Skeleton } from "@/components/ui/skeleton";
import ChatSkeleton from "@/components/common/chat-skeleton";
import { getOriginalPayload } from "@/controllers/requests";
import { Web3Context } from "@/types/wallet";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	setCachedChatMessages,
	getCachedChatMessages,
	clearChatCache,
} from "@/utils/chat-utils";

import { ChatMsg } from "@/types/chat";
import { useChatMessages } from "@/hooks/use-chat-messages";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useWorkflowExecution } from "@/hooks/use-workflow-execution";
import { useFeedback } from "@/hooks/use-feedback";

export default function AgentChatPage() {
	const {
		mode,
		setMode,
		prompt,
		setPrompt,
		selectedAgent,
		setSelectedAgent,
	} = useGlobalStore();
	const params = useParams();
	const router = useRouter();
	const searchParams = useSearchParams();
	const agentId = params.id as string;
	const urlWorkflowId = searchParams.get("workflowId");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isInFeedbackMode, setIsInFeedbackMode] = useState(false);
	const [isPolling, setIsPolling] = useState(false);
	const [isShowingCachedMessages, setIsShowingCachedMessages] =
		useState(false);
	const [hasCachedMessagesLoaded, setHasCachedMessagesLoaded] =
		useState(false);
	const { skyBrowser, address } = useWallet();
	const queryClient = useQueryClient();

	const { currentExecution } = useWorkflowExecutionStore();
	const { updateExecutionStatus } = useExecutionStatusStore();

	const {
		chatMessages,
		setChatMessages,
		safeSetChatMessages,
		setChatMessagesWithWorkflowCheck,
		pendingNotifications,
		setPendingNotifications,
		updateMessagesWithSubnetData,
		clearMessages,
		resetFeedbackState,
		setWorkflowId,
	} = useChatMessages();

	useEffect(() => {
		if (urlWorkflowId) {
			const cachedMessages = getCachedChatMessages(urlWorkflowId);
			if (cachedMessages && cachedMessages.length > 0) {
				console.log(
					`📋 Loading cached messages for workflow: ${urlWorkflowId}`
				);

				const sortedCachedMessages = [...cachedMessages].sort(
					(a, b) => {
						if (a.content === "Workflow executed successfully")
							return 1;
						if (b.content === "Workflow executed successfully")
							return -1;

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
					`🔄 Sorted ${cachedMessages.length} cached messages, completion message moved to end`
				);

				setIsShowingCachedMessages(true);
				setHasCachedMessagesLoaded(true);
				setChatMessagesWithWorkflowCheck(
					sortedCachedMessages,
					urlWorkflowId
				);

				// Set the workflow ID to ensure proper tracking
				setWorkflowId(urlWorkflowId);
			} else {
				console.log(
					`📋 No cached messages found for workflow: ${urlWorkflowId}`
				);
				setIsShowingCachedMessages(false);
				setHasCachedMessagesLoaded(false);
			}
		}
	}, [urlWorkflowId, setWorkflowId]);

	const {
		messagesEndRef,
		chatContainerRef,
		handleScroll,
		useScrollOnNewMessages,
	} = useChatScroll();

	const lastLoadedAgentId = useRef<string | null>(null);
	const hasAutoSubmittedRef = useRef(false);
	const lastQuestionRef = useRef<string | null>(null);
	const previousWorkflowId = useRef<string | null>(null);
	const isLoadingExistingWorkflow = useRef(false);

	useScrollOnNewMessages(chatMessages.length);

	const {
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
	} = useWorkflowExecution({
		updateMessagesWithSubnetData,
		setChatMessages,
		setPrompt,
		setIsInFeedbackMode,
		resetFeedbackState,
		lastQuestionRef,
		setWorkflowId,
	});

	useEffect(() => {
		if (urlWorkflowId && chatMessages.length > 0) {
			const currentWorkflowIdFromData =
				currentWorkflowData?.requestId ||
				currentWorkflowData?.workflowId;

			if (currentWorkflowIdFromData === urlWorkflowId) {
				console.log(
					`💾 Caching messages for workflow: ${urlWorkflowId}`
				);
				setCachedChatMessages(urlWorkflowId, chatMessages);
				queryClient.setQueryData(["chat", urlWorkflowId], chatMessages);
			} else {
				console.log(
					`⚠️ Not caching messages - workflow mismatch: ${currentWorkflowIdFromData} vs ${urlWorkflowId}`
				);
			}
		}
	}, [chatMessages, urlWorkflowId, queryClient, currentWorkflowData]);

	useEffect(() => {
		if (currentWorkflowData && urlWorkflowId) {
			const workflowId =
				currentWorkflowData.requestId || currentWorkflowData.workflowId;
			if (workflowId === urlWorkflowId) {
				const status = currentWorkflowData.workflowStatus;
				const shouldPoll =
					status === "in_progress" || status === "waiting_response";

				setIsPolling(shouldPoll);

				if (shouldPoll) {
					console.log(
						`🔄 Workflow ${urlWorkflowId} is active (${status}), polling will continue...`
					);
				} else {
					console.log(
						`🏁 Workflow ${urlWorkflowId} is not active (${status}), polling stopped`
					);
				}

				console.log(`🔍 Workflow status debug:`, {
					workflowId,
					workflowStatus: currentWorkflowData.workflowStatus,
					subnets: currentWorkflowData.subnets?.map((s: any) => ({
						toolName: s.toolName,
						status: s.status,
						hasQuestion: !!s.question,
						questionType: s.question?.type,
					})),
				});

				const shouldIncludeHistory =
					isLoadingExistingWorkflow.current &&
					!isShowingCachedMessages;

				// Skip processing if we're showing cached messages and this is the first update
				// This prevents duplication of already cached messages
				if (
					isShowingCachedMessages &&
					isLoadingExistingWorkflow.current
				) {
					console.log(
						`📋 Skipping subnet data processing - using cached messages for workflow: ${workflowId}`
					);

					// CRITICAL FIX: Initialize subnet cache with current data to prevent reprocessing
					// This ensures that when subsequent API calls come in, subnets aren't treated as "new"
					if (currentWorkflowData?.subnets) {
						console.log(
							`🔧 Initializing subnet cache with ${currentWorkflowData.subnets.length} subnets to prevent reprocessing`
						);
						// Process the subnet data once to initialize the cache, but don't generate messages
						updateMessagesWithSubnetData(
							currentWorkflowData,
							lastQuestionRef,
							{
								includeHistory: false, // Don't include history to avoid message generation
								isExistingWorkflow: true, // Mark as existing to avoid new message creation
								initializeCacheOnly: true, // Add a flag to indicate we only want to initialize cache
							}
						);
					}

					isLoadingExistingWorkflow.current = false;
					return;
				}

				if (isLoadingExistingWorkflow.current) {
					console.log(
						`📋 First update for existing workflow - including history: ${shouldIncludeHistory} (cached messages: ${isShowingCachedMessages})`
					);
					isLoadingExistingWorkflow.current = false;
				}

				updateMessagesWithSubnetData(
					currentWorkflowData,
					lastQuestionRef,
					{
						includeHistory: shouldIncludeHistory,
						isExistingWorkflow: shouldIncludeHistory,
					}
				);
			} else {
				console.warn(
					`⚠️ Skipping message update for different workflow: ${workflowId} vs ${urlWorkflowId}`
				);
			}
		}
	}, [currentWorkflowData, urlWorkflowId, isShowingCachedMessages]);

	useEffect(() => {
		return () => {
			if (currentWorkflowId) {
				console.log(
					`🛑 Component unmounting, stopping polling for workflow: ${currentWorkflowId}`
				);
				clearWorkflow();
			}

			updateExecutionStatus({
				isRunning: false,
				responseId: undefined,
				currentSubnet: undefined,
			});
		};
	}, [currentWorkflowId, clearWorkflow, updateExecutionStatus]);

	useEffect(() => {
		return () => {
			clearMessages();
			clearWorkflow();
		};
	}, []);

	useEffect(() => {
		const cleanupWorkflow = () => {
			if (currentWorkflowId && currentWorkflowId !== urlWorkflowId) {
				console.log(
					`🧹 Cleaning up previous workflow: ${currentWorkflowId}`
				);
				clearWorkflow();
			}
		};

		return () => {
			cleanupWorkflow();
		};
	}, [currentWorkflowId, urlWorkflowId, clearWorkflow]);

	useEffect(() => {
		if (isLoading || !skyBrowser || !address) return;

		if (urlWorkflowId && urlWorkflowId.trim().length > 0) {
			if (currentWorkflowId !== urlWorkflowId) {
				console.log(
					`🔄 Switching workflows: ${currentWorkflowId} -> ${urlWorkflowId}`
				);

				if (currentWorkflowId) {
					console.log(
						`🛑 Stopping polling for previous workflow: ${currentWorkflowId}`
					);
					clearWorkflow();

					// Remove artificial delay - execute immediately
					if (urlWorkflowId === searchParams.get("workflowId")) {
						console.log(
							`🔄 Switching to workflow: ${urlWorkflowId}`
						);

						const cachedMessages =
							getCachedChatMessages(urlWorkflowId);
						if (cachedMessages && cachedMessages.length > 0) {
							console.log(
								`📋 Loading cached messages for workflow: ${urlWorkflowId}`
							);

							clearMessages();
							resetFeedbackState();
							setChatMessages([]);
							setPendingNotifications([]);

							setIsShowingCachedMessages(true);
							setChatMessagesWithWorkflowCheck(
								cachedMessages,
								urlWorkflowId
							);
						} else {
							console.log(
								`📋 No cached messages found for workflow: ${urlWorkflowId} - keeping current state`
							);

							setIsShowingCachedMessages(false);
							resetFeedbackState();
						}

						startPollingExistingWorkflow(
							urlWorkflowId,
							skyBrowser,
							address
						);
					}
				} else {
					console.log(`🔄 Starting new workflow: ${urlWorkflowId}`);

					const cachedMessages = getCachedChatMessages(urlWorkflowId);
					if (cachedMessages && cachedMessages.length > 0) {
						console.log(
							`📋 Loading cached messages for workflow: ${urlWorkflowId}`
						);

						setChatMessages([]);
						setPendingNotifications([]);
						resetFeedbackState();

						setWorkflowId(urlWorkflowId);

						const sortedCachedMessages = [...cachedMessages].sort(
							(a, b) => {
								if (
									a.content ===
									"Workflow executed successfully"
								)
									return 1;
								if (
									b.content ===
									"Workflow executed successfully"
								)
									return -1;

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
							`🔄 Sorted ${cachedMessages.length} cached messages, completion message moved to end`
						);

						setIsShowingCachedMessages(true);
						setHasCachedMessagesLoaded(true);
						setChatMessagesWithWorkflowCheck(
							sortedCachedMessages,
							urlWorkflowId
						);

						isLoadingExistingWorkflow.current = false;
					} else {
						console.log(
							`📋 No cached messages found for workflow: ${urlWorkflowId} - keeping current state`
						);

						setIsShowingCachedMessages(false);
						setHasCachedMessagesLoaded(false);
						resetFeedbackState();

						isLoadingExistingWorkflow.current = true;
					}

					startPollingExistingWorkflow(
						urlWorkflowId,
						skyBrowser,
						address
					);
				}
			}
		} else if (currentWorkflowId && !urlWorkflowId && !isExecuting) {
			console.log(
				`🔄 No workflow ID in URL and not executing, clearing current workflow`
			);
			clearWorkflow();
			clearMessages();
			resetFeedbackState();

			setChatMessages([]);
			setPendingNotifications([]);
			setIsShowingCachedMessages(false);
			setHasCachedMessagesLoaded(false);
		}
	}, [
		isLoading,
		skyBrowser,
		address,
		urlWorkflowId,
		currentWorkflowId,
		isExecuting,
		clearWorkflow,
		clearMessages,
		resetFeedbackState,
		startPollingExistingWorkflow,
		searchParams,
	]);

	useEffect(() => {
		if (urlWorkflowId && urlWorkflowId !== previousWorkflowId.current) {
			console.log(
				`🔄 URL workflow changed from ${previousWorkflowId.current} to ${urlWorkflowId}`
			);

			if (previousWorkflowId.current) {
				console.log(`🗑️ Clearing messages for workflow change`);
				clearMessages();
				resetFeedbackState();

				setChatMessages([]);
				setPendingNotifications([]);
				setIsShowingCachedMessages(false);
			}

			previousWorkflowId.current = urlWorkflowId;
		}
	}, [urlWorkflowId, clearMessages, resetFeedbackState]);

	const {
		isSubmittingFeedback,
		handleFeedbackSubmit,
		handleFeedbackProceed,
		handleFeedbackResponse,
	} = useFeedback({
		currentWorkflowId,
		currentWorkflowData,
		skyBrowser,
		address,
		setChatMessages,
		setPrompt,
		setWorkflowStatus,
		setIsExecuting,
		setIsInFeedbackMode,
		resumePolling: () => {
			if (urlWorkflowId && skyBrowser && address) {
				console.log(
					`🔄 Resuming polling for workflow: ${urlWorkflowId}`
				);
				startPollingExistingWorkflow(
					urlWorkflowId,
					skyBrowser,
					address
				);
			}
		},
	});

	useEffect(() => {
		const extractOriginalPayload = async () => {
			if (urlWorkflowId && skyBrowser && address) {
				try {
					const originalPayload = await getOriginalPayload(
						urlWorkflowId,
						skyBrowser as SkyMainBrowser,
						{ address } as Web3Context
					);

					if (originalPayload?.originalRequestPayload?.prompt) {
						setChatMessages((prevMessages) => {
							const hasUserMessage = prevMessages.some(
								(msg) => msg.type === "user"
							);

							if (hasUserMessage) {
								return prevMessages;
							}

							const userMessage: ChatMsg = {
								id: `user_${urlWorkflowId}`,
								type: "user",
								content:
									originalPayload.originalRequestPayload
										.prompt,
								timestamp: new Date(0),
							};

							// Put user message at the beginning (chronologically first)
							const allMessages = [userMessage, ...prevMessages];

							console.log(
								`📝 Added user prompt to beginning of workflow ${urlWorkflowId}`
							);
							return allMessages;
						});
					}
				} catch (error) {
					console.error("Failed to extract original payload:", error);
				}
			}
		};

		extractOriginalPayload();
	}, [urlWorkflowId, skyBrowser, address]);

	const handleModeChange = (newMode: "chat" | "agent") => {
		if (newMode === "chat") {
			setSelectedAgent(null);
			router.push("/chat");
		} else {
			setMode(newMode);
		}
	};

	const handlePromptSubmit = async (
		message: string,
		selectedAgentId?: string
	) => {
		if (!message.trim() || !selectedAgent || !skyBrowser || !address)
			return;

		if (
			isInFeedbackMode ||
			currentWorkflowData?.workflowStatus === "waiting_response"
		) {
			await handleFeedbackResponse(message);
			return;
		}

		if (isExecuting) return;

		try {
			await executeNewWorkflow(
				selectedAgent as AgentDetail,
				message,
				address,
				skyBrowser,
				{ address }
			);
		} catch (error) {
			console.error("Error executing workflow:", error);
		}
	};

	const handleStopExecution = async () => {
		if (!skyBrowser || !address) return;
		await stopExecution(skyBrowser, address);
	};

	const handleResumeExecution = async () => {
		if (!skyBrowser || !address) return;
		await resumeExecution(skyBrowser, address);
	};

	const handleNotificationYes = async (notification: ChatMsg) => {
		setPendingNotifications((prev) =>
			prev.filter((n) => n.id !== notification.id)
		);
	};

	const handleNotificationNo = async (notification: ChatMsg) => {
		setPendingNotifications((prev) =>
			prev.filter((n) => n.id !== notification.id)
		);
		await handleStopExecution();
	};

	useEffect(() => {
		if (isExecuting && currentWorkflowId) {
			updateExecutionStatus({
				isRunning: true,
				responseId: currentWorkflowId,
			});
		} else if (!isExecuting) {
			updateExecutionStatus({
				isRunning: false,
				responseId: undefined,
				currentSubnet: undefined,
			});
		}
	}, [isExecuting, currentWorkflowId]);

	useEffect(() => {
		if (
			currentWorkflowData?.subnets &&
			Array.isArray(currentWorkflowData.subnets)
		) {
			const inProgressSubnet = currentWorkflowData.subnets.find(
				(subnet: any) => subnet.status === "in_progress"
			);

			if (inProgressSubnet) {
				updateExecutionStatus({
					currentSubnet: inProgressSubnet.toolName,
				});
			}
		}
	}, [currentWorkflowData]);

	useEffect(() => {
		if (isLoading) return;

		if (hasAutoSubmittedRef.current) {
			if (!prompt || prompt.trim().length === 0) {
				hasAutoSubmittedRef.current = false;
			} else {
				return;
			}
		}

		if (urlWorkflowId) return;
		if (isExecuting && currentWorkflowId) return;

		const canAutoSubmit =
			selectedAgent &&
			selectedAgent.id === agentId &&
			prompt &&
			prompt.trim().length > 0 &&
			skyBrowser &&
			address &&
			!isExecuting &&
			!isSubmittingFeedback &&
			chatMessages.length === 0;

		if (canAutoSubmit) {
			hasAutoSubmittedRef.current = true;
			// Remove artificial delay - execute immediately
			handlePromptSubmit(prompt);
		}
	}, [
		isLoading,
		selectedAgent?.id,
		agentId,
		prompt,
		skyBrowser,
		address,
		isExecuting,
		isSubmittingFeedback,
		chatMessages.length,
		urlWorkflowId,
		currentWorkflowId,
	]);

	useEffect(() => {
		let isMounted = true;
		const fetchAgent = async () => {
			if (
				!selectedAgent ||
				selectedAgent.id !== agentId ||
				lastLoadedAgentId.current !== agentId
			) {
				setIsLoading(true);
				try {
					const response = await getAgentById(agentId);
					const agent = response?.data;
					if (isMounted) {
						if (agent) {
							setSelectedAgent(agent);
							setError(null);
							lastLoadedAgentId.current = agentId;
						} else {
							setError("Agent not found");
						}
					}
				} catch (err) {
					console.error("Error fetching agent:", err);
					if (isMounted) setError("Failed to load agent");
				} finally {
					if (isMounted) setIsLoading(false);
				}
			} else {
				setIsLoading(false);
			}
		};

		fetchAgent();

		return () => {
			isMounted = false;
		};
	}, [agentId, selectedAgent]);

	if (isLoading) {
		return (
			<div className="relative w-10/12 max-w-7xl mx-auto h-full flex flex-col p-4">
				<ChatSkeleton />
				<div className="absolute bottom-4 left-0 right-0 px-4 space-y-2">
					<Skeleton className="h-6 w-24" />
					<div className="flex space-x-2">
						<Skeleton className="h-10 flex-1 rounded-md" />
						<Skeleton className="h-10 w-10 rounded-md" />
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<p className="text-red-500 mb-4">
						{error || "Agent not found"}
					</p>
					<Button onClick={() => router.push("/create")}>
						Go to Create Page
					</Button>
				</div>
			</div>
		);
	}

	const shouldShowSkeleton = () => {
		if (chatMessages.length === 0) {
			return false;
		}

		const hasNonUserMessages = chatMessages.some(
			(message) => message.type !== "user"
		);
		if (hasNonUserMessages) {
			return false;
		}

		const hasOnlyUserMessage =
			chatMessages.length === 1 && chatMessages[0].type === "user";

		const hasWorkflowActivity = currentWorkflowData?.subnets?.some(
			(subnet: any) =>
				subnet.status === "in_progress" ||
				subnet.status === "done" ||
				subnet.status === "completed" ||
				subnet.status === "waiting_response" ||
				subnet.data
		);

		return hasOnlyUserMessage && !hasWorkflowActivity;
	};

	return (
		<div className="relative w-full h-full flex flex-col">
			{chatMessages.length === 0 ? (
				<div className="w-10/12 max-w-7xl mx-auto p-4">
					<ChatSkeleton />
				</div>
			) : (
				<div>
					<div className="flex-1 p-4 pb-20 min-h-0 w-full overflow-y-auto scrollbar-hide h-[calc(100vh-10rem)]">
						<div
							ref={chatContainerRef}
							className=" flex flex-col gap-4 w-10/12 max-w-7xl mx-auto"
							onScroll={handleScroll}
						>
							{chatMessages
								.filter((message) => {
									const isWorkflowCompleted =
										currentWorkflowData?.workflowStatus ===
											"completed" ||
										currentWorkflowData?.workflowStatus ===
											"failed" ||
										currentWorkflowData?.workflowStatus ===
											"stopped" ||
										workflowStatus === "completed" ||
										workflowStatus === "failed" ||
										workflowStatus === "stopped";

									if (
										isWorkflowCompleted &&
										message.type === "question"
									) {
										return false;
									}

									return true;
								})
								// No sorting - maintain chronological order as messages arrive
								.map((message, index) => (
									<ChatMessage
										key={`${urlWorkflowId}-${message.id}`}
										message={message}
										isLast={
											index === chatMessages.length - 1
										}
										onNotificationYes={
											handleNotificationYes
										}
										onNotificationNo={handleNotificationNo}
										isPendingNotification={pendingNotifications.some(
											(n) => n.id === message.id
										)}
										onFeedbackSubmit={handleFeedbackSubmit}
										onFeedbackProceed={
											handleFeedbackProceed
										}
										showFeedbackButtons={(() => {
											// Quick early returns for better performance
											if (message.type !== "question") {
												console.log(
													`🚫 Feedback buttons hidden - message type: ${message.type}`
												);
												return false;
											}
											if (
												message.questionData?.type !==
												"feedback"
											) {
												console.log(
													`🚫 Feedback buttons hidden - question type: ${message.questionData?.type} (expected: feedback)`
												);
												return false;
											}

											// Check if this is a cached message that's no longer active
											// Only hide feedback buttons for cached messages if the workflow is not waiting for response
											if (isShowingCachedMessages) {
												const isWorkflowWaitingForResponse =
													currentWorkflowData?.workflowStatus ===
														"waiting_response" ||
													workflowStatus ===
														"waiting_response";

												const currentSubnetStatus =
													message.subnetIndex !==
													undefined
														? currentWorkflowData
																?.subnets?.[
																message
																	.subnetIndex
														  ]?.status
														: null;

												const isSubnetWaitingForResponse =
													message.subnetStatus ===
														"waiting_response" ||
													currentSubnetStatus ===
														"waiting_response";

												// If workflow or subnet is waiting for response, keep buttons active even for cached messages
												if (
													!isWorkflowWaitingForResponse &&
													!isSubnetWaitingForResponse
												) {
													console.log(
														`🚫 Feedback buttons hidden - cached message not waiting for response: workflow=${currentWorkflowData?.workflowStatus}, subnet=${currentSubnetStatus}`
													);
													return false;
												} else {
													console.log(
														`✅ Feedback buttons kept active for cached message - workflow or subnet waiting for response: workflow=${currentWorkflowData?.workflowStatus}, subnet=${currentSubnetStatus}`
													);
												}
											}

											// Check workflow completion status
											const isWorkflowComplete =
												currentWorkflowData?.workflowStatus ===
													"completed" ||
												currentWorkflowData?.workflowStatus ===
													"failed" ||
												currentWorkflowData?.workflowStatus ===
													"stopped" ||
												workflowStatus ===
													"completed" ||
												workflowStatus === "failed" ||
												workflowStatus === "stopped";

											if (isWorkflowComplete) {
												console.log(
													`🚫 Feedback buttons hidden - workflow complete: ${
														currentWorkflowData?.workflowStatus ||
														workflowStatus
													}`
												);
												return false;
											}

											// Check if waiting for response
											// For feedback questions, also check the current subnet status
											const currentSubnetStatus =
												message.subnetIndex !==
												undefined
													? currentWorkflowData
															?.subnets?.[
															message.subnetIndex
													  ]?.status
													: null;

											const isWaitingForResponse =
												message.subnetStatus ===
													"waiting_response" ||
												message.subnetStatus ===
													"pending" ||
												currentSubnetStatus ===
													"waiting_response" || // Check current subnet status
												currentWorkflowData?.workflowStatus ===
													"waiting_response" ||
												workflowStatus ===
													"waiting_response";

											if (
												message.type === "question" &&
												message.questionData?.type ===
													"feedback"
											) {
												console.log(
													`🔍 Feedback question waiting check:`,
													{
														messageId: message.id,
														messageSubnetStatus:
															message.subnetStatus,
														currentSubnetStatus,
														workflowStatus:
															currentWorkflowData?.workflowStatus ||
															workflowStatus,
														isWaitingForResponse,
														subnetIndex:
															message.subnetIndex,
													}
												);
											}

											if (!isWaitingForResponse) {
												console.log(
													`🚫 Feedback buttons hidden - not waiting for response. Message status: ${
														message.subnetStatus
													}, workflow status: ${
														currentWorkflowData?.workflowStatus ||
														workflowStatus
													}`,
													{
														messageId: message.id,
														messageType:
															message.type,
														questionType:
															message.questionData
																?.type,
														questionText:
															message.questionData?.text?.slice(
																0,
																30
															),
														subnetIndex:
															message.subnetIndex,
														toolName:
															message.toolName,
														actualSubnetStatus:
															currentWorkflowData
																?.subnets?.[
																message.subnetIndex ||
																	0
															]?.status,
													}
												);
												return false;
											}

											// Optimize subnet lookup and answer checking
											if (
												!message.questionData?.text ||
												!currentWorkflowData?.subnets
											) {
												console.log(
													`✅ Feedback buttons shown - no question text or subnets to check`
												);
												return true;
											}

											// Improved subnet matching logic
											const subnet =
												currentWorkflowData.subnets.find(
													(s: any) => {
														// Try multiple matching strategies
														const itemIdMatch =
															s.itemID ===
															(message.subnetIndex ??
																-1) +
																1;
														const toolNameMatch =
															s.toolName ===
															message.toolName;
														const indexMatch =
															currentWorkflowData.subnets.indexOf(
																s
															) ===
															message.subnetIndex;

														return (
															itemIdMatch ||
															toolNameMatch ||
															indexMatch
														);
													}
												);

											console.log(
												`🔍 Subnet lookup for feedback buttons:`,
												{
													messageSubnetIndex:
														message.subnetIndex,
													messageToolName:
														message.toolName,
													questionText:
														message.questionData?.text?.slice(
															0,
															50
														),
													foundSubnet: !!subnet,
													subnetItemID:
														subnet?.itemID,
													subnetToolName:
														subnet?.toolName,
													hasFeedbackHistory:
														!!subnet?.feedbackHistory,
													feedbackHistoryLength:
														subnet?.feedbackHistory
															?.length || 0,
												}
											);

											if (!subnet?.feedbackHistory) {
												console.log(
													`✅ Feedback buttons shown - no feedback history`
												);
												return true;
											}

											// Check for existing user answer (optimized)
											const hasExistingAnswer =
												subnet.feedbackHistory.some(
													(feedback: any) =>
														feedback.feedback_question ===
															message.questionData
																?.text &&
														feedback.user_answer?.trim()
												);

											console.log(
												`🔍 Existing answer check:`,
												{
													hasExistingAnswer,
													feedbackHistory:
														subnet.feedbackHistory.map(
															(f: any) => ({
																question:
																	f.feedback_question?.slice(
																		0,
																		30
																	),
																answer:
																	f.user_answer?.slice(
																		0,
																		20
																	) || "none",
															})
														),
												}
											);

											const shouldShow =
												!hasExistingAnswer;
											console.log(
												`${
													shouldShow ? "✅" : "🚫"
												} Feedback buttons ${
													shouldShow
														? "shown"
														: "hidden"
												} - existing answer: ${hasExistingAnswer}`
											);
											return shouldShow;
										})()}
										workflowStatus={workflowStatus}
									/>
								))}

							{shouldShowSkeleton() && (
								<div className="space-y-2">
									<div className="py-3 rounded-md space-y-2">
										<Skeleton className="h-4 w-36" />
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-20 w-full" />
										<div className="flex items-center space-x-2 mt-2">
											<Skeleton className="h-4 w-20 rounded" />
											<Skeleton className="h-4 w-12" />
										</div>
									</div>
									<div className="py-3 rounded-md space-y-2">
										<Skeleton className="h-4 w-36" />
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-20 w-full" />
										<div className="flex items-center space-x-2 mt-2">
											<Skeleton className="h-4 w-20 rounded" />
											<Skeleton className="h-4 w-12" />
										</div>
									</div>
								</div>
							)}

							<div ref={messagesEndRef} />
						</div>
					</div>
				</div>
			)}

			<div className="absolute bottom-4 left-0 right-0 px-4 w-10/12 max-w-7xl mx-auto">
				<ChatInput
					onSend={handlePromptSubmit}
					onStop={handleStopExecution}
					onResume={handleResumeExecution}
					mode={mode}
					setMode={handleModeChange}
					prompt={prompt}
					setPrompt={setPrompt}
					hideModeSelection={true}
					disableAgentSelection={true}
					isExecuting={
						(workflowStatus === "stopped" ? false : isExecuting) ||
						isSubmittingFeedback ||
						(workflowStatus === "stopped"
							? false
							: currentExecution?.workflowStatus ===
							  "in_progress") ||
						(workflowStatus === "stopped"
							? false
							: currentExecution?.workflowStatus === "pending") ||
						(workflowStatus === "stopped"
							? false
							: currentExecution?.workflowStatus ===
							  "waiting_response")
					}
					workflowStatus={
						workflowStatus === "stopped"
							? "stopped"
							: currentWorkflowData?.workflowStatus ===
							  "waiting_response"
							? "waiting_response"
							: workflowStatus === "pending"
							? undefined
							: workflowStatus
					}
				/>
			</div>
		</div>
	);
}
