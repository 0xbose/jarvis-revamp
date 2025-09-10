"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useGlobalStore } from "@/stores/global-store";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { useWorkflowExecutionStore } from "@/stores/workflow-execution-store";
import { Skeleton } from "@/components/ui/skeleton";
import ChatSkeleton from "@/components/common/chat-skeleton";
import { getOriginalPayload } from "@/controllers/requests/requests.query";
import { Web3Context } from "@/types/wallet";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	setCachedChatMessages,
	getCachedChatMessages,
} from "@/utils/chat-utils";
import { getAgentDetailByCollectionAndNftId } from "@/controllers/agents/agents.query";
import { ChatMsg } from "@/types/chat";
import { useChatMessages } from "@/hooks/use-chat-messages";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useWorkflowExecution } from "@/hooks/use-workflow-execution";
import { useFeedback } from "@/hooks/use-feedback";
import { ChatMessagesContainer } from "@/components/common/chat-messages-container";
import { ComparisonView } from "@/components/common/comparison-view";
import { QUERY_KEYS } from "@/utils/query-keys";

function AgentChatPageContent() {
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
	const agentAddress = params.agentAddress as string;
	const nftId = searchParams.get("nftId") as string;
	const urlWorkflowId = searchParams.get("workflowId");
	const compareWorkflowId = searchParams.get("compare");
	const isComparisonMode = !!compareWorkflowId;
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isInFeedbackMode, setIsInFeedbackMode] = useState(false);
	const [isShowingCachedMessages, setIsShowingCachedMessages] =
		useState(false);

	const { skyBrowser, address } = useWallet();
	const queryClient = useQueryClient();

	// Function to refetch chat sidebar history data
	const refetchHistory = () => {
		console.log(
			"🔄 Refetching chat sidebar history after feedback submission"
		);
		queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.HISTORY] });
	};

	const { currentExecution, updateExecutionStatus } =
		useWorkflowExecutionStore();

	const {
		chatMessages,
		setChatMessages,
		setChatMessagesWithWorkflowCheck,
		pendingNotifications,
		setPendingNotifications,
		updateMessagesWithSubnetData,
		clearMessages,
		resetFeedbackState,
		setWorkflowId,
	} = useChatMessages();

	useEffect(() => {
		if (urlWorkflowId && queryClient) {
			const cachedMessages = getCachedChatMessages(
				urlWorkflowId,
				queryClient
			);
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
			}
		}

		// Also preload cached messages for comparison workflow if in comparison mode
		if (compareWorkflowId && queryClient && isComparisonMode) {
			const compareMessages = getCachedChatMessages(
				compareWorkflowId,
				queryClient
			);
			if (compareMessages && compareMessages.length > 0) {
				console.log(
					`📋 Preloading cached messages for comparison workflow: ${compareWorkflowId}`
				);
			} else {
				console.log(
					`📋 No cached messages found for comparison workflow: ${compareWorkflowId}`
				);
			}
		}
	}, [
		urlWorkflowId,
		compareWorkflowId,
		isComparisonMode,
		setWorkflowId,
		queryClient,
	]);

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
		pollingStoppedAt,
		startPollingExistingWorkflow,
		executeNewWorkflow,
		stopExecution,
		resumeExecution,
		clearWorkflow,
		refreshPolling,
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
				setCachedChatMessages(urlWorkflowId, chatMessages, queryClient);
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

				// Ensure workflow status is synchronized with currentWorkflowData
				if (status !== workflowStatus) {
					console.log(
						`🔄 Syncing workflow status: ${workflowStatus} -> ${status}`
					);
					setWorkflowStatus(status);
				}

				const shouldPoll =
					status === "in_progress" ||
					status === "waiting" ||
					status === "awaiting_response";

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

				if (
					isShowingCachedMessages &&
					isLoadingExistingWorkflow.current
				) {
					console.log(
						`📋 Skipping subnet data processing - using cached messages for workflow: ${workflowId}`
					);

					if (currentWorkflowData?.subnets) {
						console.log(
							`🔧 Initializing subnet cache with ${currentWorkflowData.subnets.length} subnets to prevent reprocessing`
						);
						updateMessagesWithSubnetData(
							currentWorkflowData,
							lastQuestionRef,
							{
								includeHistory: false,
								isExistingWorkflow: true,
								initializeCacheOnly: true,
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
	}, [
		currentWorkflowData,
		urlWorkflowId,
		isShowingCachedMessages,
		workflowStatus,
		setWorkflowStatus,
	]);

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

	// Consolidated workflow initialization effect - prevents multiple API calls
	useEffect(() => {
		if (isLoading || !skyBrowser || !address || !queryClient) return;

		if (urlWorkflowId && urlWorkflowId.trim().length > 0) {
			// Prevent duplicate initialization
			if (currentWorkflowId === urlWorkflowId) {
				console.log(
					`🔄 Already initialized workflow: ${urlWorkflowId}`
				);
				return;
			}

			console.log(`🔄 Initializing workflow: ${urlWorkflowId}`);

			// Clear previous workflow if different
			if (currentWorkflowId && currentWorkflowId !== urlWorkflowId) {
				console.log(
					`🛑 Stopping polling for previous workflow: ${currentWorkflowId}`
				);
				clearWorkflow();
			}

			// Check for cached messages first
			const cachedMessages = getCachedChatMessages(
				urlWorkflowId,
				queryClient
			);
			if (cachedMessages && cachedMessages.length > 0) {
				console.log(
					`📋 Loading cached messages for workflow: ${urlWorkflowId}`
				);

				clearMessages();
				resetFeedbackState();
				setChatMessages([]);
				setPendingNotifications([]);

				setIsShowingCachedMessages(true);
				setChatMessagesWithWorkflowCheck(cachedMessages, urlWorkflowId);

				// Set the workflow ID to ensure proper tracking
				setWorkflowId(urlWorkflowId);
				isLoadingExistingWorkflow.current = false;
			} else {
				console.log(
					`📋 No cached messages found for workflow: ${urlWorkflowId}`
				);
				setIsShowingCachedMessages(false);
				resetFeedbackState();
				isLoadingExistingWorkflow.current = true;
			}

			// Start polling only once
			startPollingExistingWorkflow(urlWorkflowId, skyBrowser, address);
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
		queryClient,
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
		handleRetrySubnet,
		retryingSubnetIndex,
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
		refetchHistory,
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
		setPrompt("");
		if (!message.trim() || !selectedAgent || !skyBrowser || !address)
			return;

		if (
			isInFeedbackMode ||
			currentWorkflowData?.workflowStatus === "awaiting_response"
		) {
			console.log(
				"🔄 Handling feedback response for agent:",
				selectedAgent.name,
				"message:",
				message
			);
			await handleFeedbackResponse(message);
			return;
		}

		if (isExecuting) return;

		console.log(
			"🚀 Starting new workflow for agent:",
			selectedAgent.name,
			"message:",
			message
		);
		try {
			await executeNewWorkflow(
				selectedAgent as any, // Type assertion to handle different agent types
				message,
				address,
				skyBrowser,
				{ address }
			);
		} catch (error) {
			console.error(
				"Error executing workflow for agent:",
				selectedAgent.name,
				error
			);
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
		console.log(
			"✅ Notification Yes for agent:",
			selectedAgent?.name,
			"notification:",
			notification.id,
			"tool:",
			notification.toolName
		);
		setPendingNotifications((prev) =>
			prev.filter((n) => n.id !== notification.id)
		);
		// Refetch sidebar history after notification response
		refetchHistory();
	};

	const handleNotificationNo = async (notification: ChatMsg) => {
		console.log(
			"❌ Notification No for agent:",
			selectedAgent?.name,
			"notification:",
			notification.id,
			"tool:",
			notification.toolName
		);
		setPendingNotifications((prev) =>
			prev.filter((n) => n.id !== notification.id)
		);
		await handleStopExecution();
		// Refetch sidebar history after notification response
		refetchHistory();
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
				(subnet: any) =>
					subnet.status === "in_progress" ||
					subnet.status === "waiting"
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
			(("collection_address" in selectedAgent &&
				selectedAgent.collection_address === agentAddress) ||
				("collection_id" in selectedAgent &&
					selectedAgent.collection_id === agentAddress) ||
				("nft_address" in selectedAgent &&
					selectedAgent.nft_address === agentAddress)) &&
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
		agentAddress,
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
				!(
					("collection_address" in selectedAgent &&
						selectedAgent.collection_address === agentAddress) ||
					("collection_id" in selectedAgent &&
						selectedAgent.collection_id === agentAddress) ||
					("nft_address" in selectedAgent &&
						selectedAgent.nft_address === agentAddress)
				) ||
				lastLoadedAgentId.current !== agentAddress
			) {
				setIsLoading(true);
				try {
					// If nftId is not in URL, try to get it from the original payload
					let currentNftId = nftId;
					if (
						!currentNftId &&
						urlWorkflowId &&
						skyBrowser &&
						address
					) {
						try {
							const originalPayload = await getOriginalPayload(
								urlWorkflowId,
								skyBrowser as SkyMainBrowser,
								{ address } as Web3Context
							);
							currentNftId =
								originalPayload?.originalRequestPayload
									?.accountNFT?.nftID;
							console.log(
								"🔍 Extracted nftId from original payload:",
								currentNftId
							);
						} catch (payloadError) {
							console.warn(
								"Failed to get nftId from original payload:",
								payloadError
							);
						}
					}

					if (!currentNftId) {
						throw new Error(
							"nftId is required but not found in URL or original payload"
						);
					}

					console.log("🔄 Fetching agent with params:", {
						agentAddress,
						currentNftId,
						urlWorkflowId,
						hasSkyBrowser: !!skyBrowser,
						hasAddress: !!address,
					});

					const response = await getAgentDetailByCollectionAndNftId(
						agentAddress,
						currentNftId
					);
					console.log("🔄 Fetching agent:", response);
					const agent = response;
					if (isMounted) {
						if (agent) {
							setSelectedAgent(agent);
							setError(null);
							lastLoadedAgentId.current = agentAddress;
						} else {
							setError("Agent not found");
						}
					}
				} catch (err: any) {
					console.error("Error fetching agent:", err);
					if (isMounted) {
						// Provide more specific error messages
						if (err.response?.status === 404) {
							setError(
								`Agent not found: ${agentAddress}/${"unknown"}`
							);
						} else if (err.response?.status === 401) {
							setError(
								"Authentication failed - please check your API key"
							);
						} else if (err.response?.status === 403) {
							setError(
								"Access denied - insufficient permissions"
							);
						} else if (err.message?.includes("nftId is required")) {
							setError("NFT ID is required but not found");
						} else {
							setError(
								`Failed to load agent: ${
									err.message || "Unknown error"
								}`
							);
						}
					}
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
	}, [
		agentAddress,
		selectedAgent,
		nftId,
		urlWorkflowId,
		skyBrowser,
		address,
	]);

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
				subnet.status === "awaiting_response" ||
				subnet.data
		);

		return hasOnlyUserMessage && !hasWorkflowActivity;
	};

	// Show comparison view if compare parameter is present
	if (isComparisonMode && compareWorkflowId && urlWorkflowId) {
		return (
			<ComparisonView
				agentId={agentAddress}
				primaryWorkflowId={urlWorkflowId}
				compareWorkflowId={compareWorkflowId}
				selectedAgent={selectedAgent as any}
			/>
		);
	}

	return (
		<ChatMessagesContainer
			// Core data
			chatMessages={chatMessages}
			urlWorkflowId={urlWorkflowId || undefined}
			currentWorkflowData={currentWorkflowData}
			workflowStatus={workflowStatus}
			completedFeedback={new Set()}
			pendingNotifications={pendingNotifications}
			pollingStoppedAt={pollingStoppedAt}
			isShowingCachedMessages={isShowingCachedMessages}
			selectedAgent={selectedAgent as any}
			// Callbacks
			onNotificationYes={handleNotificationYes}
			onNotificationNo={handleNotificationNo}
			onFeedbackProceed={handleFeedbackProceed}
			onFeedbackSubmit={handleFeedbackSubmit}
			onRefreshPolling={refreshPolling}
			onSend={handlePromptSubmit}
			onStop={handleStopExecution}
			onResume={handleResumeExecution}
			onRetrySubnet={handleRetrySubnet}
			// Chat input state
			mode={mode}
			setMode={handleModeChange}
			prompt={prompt}
			setPrompt={setPrompt}
			// Execution state
			isExecuting={isExecuting}
			isSubmittingFeedback={isSubmittingFeedback}
			currentExecution={currentExecution}
			retryingSubnetIndex={retryingSubnetIndex}
			// UI options
			showChatInput={true}
			showSkeleton={true}
			shouldShowSkeleton={shouldShowSkeleton}
			isReadOnly={false}
			// Scroll handling
			chatContainerRef={chatContainerRef}
			messagesEndRef={messagesEndRef}
			handleScroll={handleScroll}
		/>
	);
}

export default function AgentChatPage() {
	return (
		<Suspense fallback={<ChatSkeleton />}>
			<AgentChatPageContent />
		</Suspense>
	);
}
