"use client";
import React, { useEffect, useState, useRef } from "react";
import { ChatMessagesGrouped } from "./chat-messages-grouped";
import { ChatMsg } from "@/types/chat";
import { useChatMessages } from "@/hooks/use-chat-messages";
import { useWorkflowExecution } from "@/hooks/use-workflow-execution";
import { useMessageGrouping } from "@/hooks/use-message-grouping";
import { useWallet } from "@/hooks/use-wallet";
import { useQueryClient } from "@tanstack/react-query";
import { getCachedChatMessages, setCachedChatMessages } from "@/utils/chat-utils";
import { AgentDetail, Agent } from "@/types";
import { Skeleton } from "../ui/skeleton";
import { apiKeyManager } from "@/utils/api-key-manager";
import { WORKFLOW_ENDPOINTS } from "@/config/constants";
import axios from "axios";

interface WorkflowPanelProps {
	workflowId: string;
	agentId: string;
	selectedAgent: AgentDetail | Agent | null;
	title: string;
	isReadOnly?: boolean;
	className?: string;
}

export function WorkflowPanel({
	workflowId,
	agentId,
	selectedAgent,
	title,
	isReadOnly = false,
	className = "",
}: WorkflowPanelProps) {
	const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
	const [isShowingCachedMessages, setIsShowingCachedMessages] = useState(false);
	const [completedFeedback, setCompletedFeedback] = useState<Set<number>>(new Set());
	const [pendingNotifications, setPendingNotifications] = useState<ChatMsg[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const { skyBrowser, address } = useWallet();
	const queryClient = useQueryClient();

	// Function to fetch workflow data directly from API
	const fetchWorkflowData = async (workflowId: string) => {
		console.log(`🔍 fetchWorkflowData called for: ${workflowId}`, {
			skyBrowser: !!skyBrowser,
			address: !!address,
			isReadOnly
		});

		if (!skyBrowser || !address) {
			console.warn("Cannot fetch workflow data: missing skyBrowser or address", {
				skyBrowser: !!skyBrowser,
				address: !!address
			});
			return null;
		}

		try {
			console.log(`🔍 Starting API fetch for workflow: ${workflowId}`);
			const apiKey = await apiKeyManager.getApiKey(skyBrowser, { address });
			
			if (!apiKey) {
				console.error("Failed to get API key for workflow data fetch");
				return null;
			}

			const statusEndpoint = `${WORKFLOW_ENDPOINTS.FULL_WORKFLOW_STATUS}/${workflowId}`;
			console.log(`🌐 Making API request to: ${statusEndpoint}`);
			
			const response = await axios.get(statusEndpoint, {
				headers: {
					"x-api-key": apiKey,
					"Content-Type": "application/json",
				},
			});

			const statusData = response.data;
			console.log(`✅ Successfully fetched workflow data for: ${workflowId}`, {
				hasSubnets: !!statusData.subnets,
				subnetCount: statusData.subnets?.length || 0,
				workflowStatus: statusData.workflowStatus,
				userPrompt: statusData.userPrompt?.substring(0, 50) + '...'
			});
			return statusData;
		} catch (error) {
			console.error(`❌ Error fetching workflow data for ${workflowId}:`, error);
			if (axios.isAxiosError(error)) {
				console.error('Response status:', error.response?.status);
				console.error('Response data:', error.response?.data);
			}
			return null;
		}
	};

	const {
		currentWorkflowData,
		workflowStatus,
		pollingStoppedAt,
		startPollingExistingWorkflow,
		refreshPolling,
	} = useWorkflowExecution({
		updateMessagesWithSubnetData: () => {}, // Simplified for read-only
		setChatMessages,
		setPrompt: () => {},
		setIsInFeedbackMode: () => {},
		resetFeedbackState: () => {},
		lastQuestionRef: useRef(null),
		setWorkflowId: () => {},
	});

	const { groupMessagesBySubnet } = useMessageGrouping();

	// Load cached messages for this specific workflow
	useEffect(() => {
		const loadWorkflowData = async () => {
			if (workflowId && queryClient) {
				setIsLoading(true);
				const cachedMessages = getCachedChatMessages(workflowId, queryClient);
				
				if (cachedMessages && cachedMessages.length > 0) {
					console.log(`📋 Loading cached messages for workflow panel: ${workflowId}`);
					
					const sortedCachedMessages = [...cachedMessages].sort((a, b) => {
						if (a.content === "Workflow executed successfully") return 1;
						if (b.content === "Workflow executed successfully") return -1;
						
						const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
						const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
						return timeA - timeB;
					});

					setIsShowingCachedMessages(true);
					setChatMessages(sortedCachedMessages);
					setIsLoading(false);
				} else {
					console.log(`📋 No cached messages found for workflow panel: ${workflowId}`, {
						skyBrowser: !!skyBrowser,
						address: !!address,
						isReadOnly,
						queryClient: !!queryClient
					});
					setIsShowingCachedMessages(false);
					
					// Try to fetch workflow data directly from API
					console.log(`🚀 Attempting to fetch workflow data from API for: ${workflowId}`);
					let workflowData = await fetchWorkflowData(workflowId);
					
					// If initial fetch failed due to wallet not being ready, retry after a delay
					if (!workflowData && (!skyBrowser || !address)) {
						console.log(`⏳ Wallet not ready, retrying fetch in 2 seconds for: ${workflowId}`);
						await new Promise(resolve => setTimeout(resolve, 2000));
						workflowData = await fetchWorkflowData(workflowId);
					}
					
					console.log(`📊 Workflow data fetch result for ${workflowId}:`, {
						hasData: !!workflowData,
						hasSubnets: !!(workflowData && workflowData.subnets),
						subnetCount: workflowData?.subnets?.length || 0
					});
					
					if (workflowData && workflowData.subnets) {
						console.log(`🔄 Converting workflow data to messages for: ${workflowId}`);
						
						// Convert workflow data to chat messages
						const messages: ChatMsg[] = [];
						
						// Add initial user message if available
						if (workflowData.userPrompt) {
							messages.push({
								id: `user-${workflowId}`,
								type: "user",
								content: workflowData.userPrompt,
								timestamp: new Date(),
							});
						}
						
						// Add subnet messages
						workflowData.subnets.forEach((subnet: any, index: number) => {
							if (subnet.output) {
								messages.push({
									id: `subnet-${workflowId}-${index}`,
									type: "workflow_subnet",
									content: subnet.output,
									timestamp: subnet.updatedAt ? new Date(subnet.updatedAt) : new Date(),
									subnetIndex: index,
									toolName: subnet.name || "Unknown Tool",
									subnetStatus: subnet.status || "done",
								});
							}
						});
						
						// Sort messages by timestamp
						const sortedMessages = messages.sort((a, b) => {
							const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
							const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
							return timeA - timeB;
						});
						
						setChatMessages(sortedMessages);
						
						// Cache the converted messages for future use
						setCachedChatMessages(workflowId, sortedMessages, queryClient);
					} else {
						console.warn(`⚠️ Could not load workflow data for: ${workflowId}`, {
							hasWorkflowData: !!workflowData,
							hasSubnets: !!(workflowData && workflowData.subnets),
							skyBrowser: !!skyBrowser,
							address: !!address
						});
						// Set empty messages array so we don't show loading forever
						setChatMessages([]);
					}
					
					setIsLoading(false);
				}

				// For read-only mode, we don't need continuous polling, just initial data fetch
				// For non-read-only mode, start polling as usual
				if (skyBrowser && address && !isReadOnly) {
					console.log(`🔄 Starting polling for workflow panel: ${workflowId} (readOnly: ${isReadOnly})`);
					startPollingExistingWorkflow(workflowId, skyBrowser, address);
				} else if (isReadOnly) {
					console.log(`📋 Read-only mode: relying on direct API fetch for: ${workflowId}`);
				}
			}
		};

		loadWorkflowData();
	}, [workflowId, queryClient, skyBrowser, address, isReadOnly]);

	// Additional effect to retry fetching when wallet becomes available
	useEffect(() => {
		const retryFetchIfNeeded = async () => {
			// Only retry if we're in read-only mode, have no messages, and wallet just became available
			if (isReadOnly && skyBrowser && address && chatMessages.length === 0 && !isLoading) {
				console.log(`🔄 Wallet became available, retrying fetch for: ${workflowId}`);
				setIsLoading(true);
				
				const workflowData = await fetchWorkflowData(workflowId);
				if (workflowData && workflowData.subnets) {
					console.log(`🔄 Retry successful, converting workflow data to messages for: ${workflowId}`);
					
					const messages: ChatMsg[] = [];
					
					if (workflowData.userPrompt) {
						messages.push({
							id: `user-${workflowId}`,
							type: "user",
							content: workflowData.userPrompt,
							timestamp: new Date(),
						});
					}
					
					workflowData.subnets.forEach((subnet: any, index: number) => {
						if (subnet.output) {
							messages.push({
								id: `subnet-${workflowId}-${index}`,
								type: "workflow_subnet",
								content: subnet.output,
								timestamp: subnet.updatedAt ? new Date(subnet.updatedAt) : new Date(),
								subnetIndex: index,
								toolName: subnet.name || "Unknown Tool",
								subnetStatus: subnet.status || "done",
							});
						}
					});
					
					const sortedMessages = messages.sort((a, b) => {
						const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
						const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
						return timeA - timeB;
					});
					
					setChatMessages(sortedMessages);
					setCachedChatMessages(workflowId, sortedMessages, queryClient);
				}
				
				setIsLoading(false);
			}
		};

		// Only run this retry logic if we have skyBrowser and address but no messages
		if (skyBrowser && address) {
			retryFetchIfNeeded();
		}
	}, [skyBrowser, address]); // Only depend on wallet availability

	// Dummy handlers for read-only mode
	const handleNotificationYes = async () => {};
	const handleNotificationNo = async () => {};
	const handleFeedbackProceed = async () => {};
	const handleFeedbackSubmit = async () => {};
	const handleRetrySubnet = async () => {};

	if (isLoading) {
		return (
			<div className={`h-full flex flex-col ${className}`}>
				<div className="p-4 border-b bg-muted/30">
					<Skeleton className="h-5 w-32 mb-2" />
					<Skeleton className="h-3 w-48" />
				</div>
				<div className="flex-1 p-4 space-y-4">
					{Array.from({ length: 3 }, (_, index) => (
						<div key={index} className="space-y-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-20 w-full" />
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className={`h-full flex flex-col ${className}`}>
			{/* Header */}
			{/* <div className="p-4 border-b bg-muted/30">
	
				<p className="text-xs text-muted-foreground truncate" title={workflowId}>
					{workflowId}
				</p>
			</div> */}

			{/* Messages */}
			<div className="flex-1 overflow-y-auto scrollbar-hide">
				<div className="p-4">
					{chatMessages.length > 0 ? (
						<ChatMessagesGrouped
							messages={chatMessages}
							urlWorkflowId={workflowId}
							currentWorkflowData={currentWorkflowData}
							workflowStatus={workflowStatus}
							completedFeedback={completedFeedback}
							pendingNotifications={pendingNotifications}
							pollingStoppedAt={pollingStoppedAt}
							onNotificationYes={handleNotificationYes}
							onNotificationNo={handleNotificationNo}
							onFeedbackProceed={handleFeedbackProceed}
							onFeedbackSubmit={handleFeedbackSubmit}
							onRefreshPolling={refreshPolling}
							isShowingCachedMessages={isShowingCachedMessages}
							selectedAgent={selectedAgent}
							isReadOnly={isReadOnly}
							onRetrySubnet={handleRetrySubnet}
						/>
					) : (
						<div className="flex items-center justify-center h-32 text-muted-foreground">
							<p className="text-sm">No messages found for this workflow</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
