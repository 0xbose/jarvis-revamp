"use client";
import React, {
	useState,
	useRef,
	useCallback,
	useEffect,
	useMemo,
} from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
	Sidebar,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenu,
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
} from "../ui/sidebar";
import Link from "next/link";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";
import {
	MoreVerticalIcon,
	Clock,
	Loader2,
	RefreshCw,
	CheckCircle,
	XCircle,
	TimerIcon,
	PinIcon,
	ShieldAlert,
	CircleStop,
	MessageCircleX,
	LoaderCircle,
	ClockArrowUp,
	Shield,
	MessageCircle,
	CirclePause,
	MessageCircleMoreIcon,
} from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../ui/tooltip";
import { Skeleton } from "../ui/skeleton";
import { useWallet } from "@/hooks/use-wallet";
import { useExecutionStatusStore } from "@/stores";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHistory } from "@/controllers/requests/requests.query";
import { prefetchChatData } from "@/utils/chat-utils";
import { STORAGE_KEYS } from "@/config/constants";
import { QUERY_KEYS } from "@/utils/query-keys";
import { deleteWorkflowRequest } from "@/controllers/requests/requests.mutation";
import { deleteChatSession } from "@/controllers/chat/chat.mutations";

const CHAT_OPTIONS = [1, 5, 10, 15, 20] as const;

interface WorkflowItem {
	// Common
	type?: "workflow" | "chat";
	id?: string;
	userPrompt?: string;

	// Workflow-specific
	requestId?: string;
	agentId?: string;
	agentAddress?: string;
	agentIDFromCollection?: string;
	status?: string;
	questionType?: string;

	// Chat-specific
	chatId?: string;
	nftId?: string;
	firstMessage?: {
		role: string;
		content: string;
		timestamp: string;
	};
}

const getWorkflowIcon = (status: string) => {
	switch (status) {
		case "completed":
			return CheckCircle;
		case "awaiting_response":
			return ShieldAlert;
		case "stopped":
			return CirclePause;
		case "failed":
			return MessageCircleX;
		case "in_progress":
			return LoaderCircle;
		case "waiting":
			return LoaderCircle;
		case "pending":
			return ClockArrowUp;
		default:
			return Clock;
	}
};

const getWorkflowIconColor = (status: string, questionType?: string) => {
	switch (status) {
		case "completed":
			return "text-green-700";
		case "awaiting_response":
			return "text-yellow-500/90";
		case "stopped":
			return "text-gray-500";
		case "failed":
			return "text-red-500/90";
		case "in_progress":
			return "text-blue-700";
		case "waiting":
			return "text-blue-700";
		case "pending":
			return "text-blue-700";
		default:
			return "text-gray-400";
	}
};

const getWorkflowIconAnimation = (status: string) => {
	switch (status) {
		case "in_progress":
		case "waiting":
			return "animate-spin";
		default:
			return "";
	}
};

const WorkflowItem = React.memo(
	({
		workflow,
		index,
		sidebarIsExpanded,
		handleMenuSelectOpenChange,
		onPrefetch,
		isSelected,
		isRunning,
		currentAgentId,
		currentWorkflowId,
		handleDelete,
	}: {
		workflow: WorkflowItem;
		index: number;
		sidebarIsExpanded: boolean;
		handleMenuSelectOpenChange: (open: boolean) => void;
		onPrefetch: (workflowId: string) => void;
		isSelected: boolean;
		isRunning: boolean;
		currentAgentId?: string;
		currentWorkflowId?: string | null;
		handleDelete: (item: WorkflowItem) => void;
	}) => {
		const router = useRouter();
		const queryClient = useQueryClient();
		const Icon =
			workflow.type === "chat"
				? MessageCircleMoreIcon
				: getWorkflowIcon(workflow.status as string);
		const iconColor =
			workflow.type === "chat"
				? "text-gray-400"
				: getWorkflowIconColor(workflow.status as string);
		const iconAnimation =
			workflow.type === "chat"
				? ""
				: getWorkflowIconAnimation(workflow.status as string);

		const isCompleted = workflow.status === "completed";

		const handleMenuSelect = (value: string) => {
			const workflowId = workflow.requestId || workflow.id || "";
			const agentAddress = workflow.agentAddress;

			// Debug logging
			console.log("🔍 Chat Sidebar Debug:", {
				workflowId,
				agentAddress,
				agentIDFromCollection: workflow.agentIDFromCollection,
				workflow: workflow,
			});

			switch (value) {
				case "delete":
					handleDelete(workflow);
					break;
				case "Left":
					// Navigate to single workflow view
					router.push(
						`/chat/agent/${agentAddress}?workflowId=${workflowId}&nftId=${workflow.agentIDFromCollection}`
					);
					break;
				default:
					break;
			}
		};

		return (
			<SidebarMenuItem
				key={
					workflow.requestId ||
					workflow.id ||
					workflow.chatId ||
					index
				}
				className="w-full"
			>
				<SidebarMenuButton
					asChild
					className={`p-1 w-full ${
						isSelected
							? "bg-muted-foreground/10 border-l-2 rounded-sm border-primary"
							: ""
					}`}
				>
					<div
						className={`w-full font-medium hover:text-primary-foreground transition-colors duration-150 ${
							isSelected ? "text-primary-foreground" : ""
						}`}
					>
						<Link
							href={
								workflow.type === "chat" && workflow.chatId
									? `/chat?chatId=${workflow.chatId}`
									: `/chat/agent/${workflow.agentAddress}?workflowId=${workflow.requestId}&nftId=${workflow.agentIDFromCollection}`
							}
							className="w-full flex items-center justify-center gap-x-1.5"
							onClick={() => {
								// Clear cache for the chat being navigated to
								if (
									workflow.type === "chat" &&
									workflow.chatId
								) {
									console.log(
										"🔄 Clearing cache for chat:",
										workflow.chatId
									);
									queryClient.removeQueries({
										queryKey: [
											"chat-messages",
											workflow.chatId,
										],
									});
								}
							}}
							onMouseEnter={() => {
								// Debug logging
								console.log("🔍 Link Debug:", {
									href:
										workflow.type === "chat" &&
										workflow.chatId
											? `/chat?chatId=${workflow.chatId}`
											: `/chat/agent/${workflow.agentAddress}?workflowId=${workflow.requestId}&nftId=${workflow.agentIDFromCollection}`,
									agentIDFromCollection:
										workflow.agentIDFromCollection,
									workflow: workflow,
								});
								if (workflow.type !== "chat") {
									onPrefetch(
										workflow.requestId || workflow.id || ""
									);
								}
							}}
						>
							{Icon && (
								<Icon
									className={`!size-[19px] ${iconColor} ${iconAnimation}`}
									strokeWidth={1.5}
								/>
							)}
							{sidebarIsExpanded && (
								<div className="flex items-center !w-full flex-1 min-w-0">
									<div className="flex flex-col w-[140px] min-w-0">
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="text-sm text-ellipsis whitespace-nowrap overflow-hidden cursor-pointer">
														{workflow.type ===
														"chat"
															? workflow
																	.firstMessage
																	?.content ||
															  workflow.chatId
															: workflow.userPrompt ||
															  workflow.requestId}
													</span>
												</TooltipTrigger>
												<TooltipContent>
													<p className="z-[99999] max-w-xs text-ellipsis whitespace-nowrap overflow-hidden">
														{workflow.type ===
														"chat"
															? workflow
																	.firstMessage
																	?.content ||
															  workflow.chatId
															: workflow.userPrompt ||
															  workflow.requestId}
													</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</div>
									<div className="flex-1" />
								</div>
							)}
						</Link>
						{sidebarIsExpanded && (
							<Select
								onOpenChange={handleMenuSelectOpenChange}
								onValueChange={handleMenuSelect}
							>
								<SelectTrigger className="!border-none [&_.lucide-chevron-down]:hidden">
									<MoreVerticalIcon
										className="!size-4 flex-shrink-0"
										strokeWidth={1.5}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem
										value="delete"
										className="cursor-pointer text-red-500 bg-red-500/20 focus:bg-red-500/20 focus:text-red-500"
									>
										Delete
									</SelectItem>
									{/* <SelectItem value="Left">
										View
									</SelectItem>
									{isCompleted && currentWorkflowId && currentWorkflowId !== (workflow.requestId || workflow.id) && (
										<SelectItem value="Compare">
											Compare
										</SelectItem>
									)} */}
								</SelectContent>
							</Select>
						)}
					</div>
				</SidebarMenuButton>
			</SidebarMenuItem>
		);
	}
);

WorkflowItem.displayName = "WorkflowItem";

const ChatSidebar = React.memo(({ isMobile }: { isMobile?: boolean }) => {
	const [chatCount, setChatCount] = useState(() => {
		if (typeof window !== "undefined") {
			try {
				const stored = localStorage.getItem(
					STORAGE_KEYS.SELECTED_HISTORIES_COUNT
				);
				if (stored) {
					const parsedCount = Number(stored);
					if (CHAT_OPTIONS.includes(parsedCount as any)) {
						return parsedCount;
					}
				}
			} catch (error) {
				console.warn(
					"Failed to read chat count from local storage:",
					error
				);
			}
		}
		return 5;
	});
	const [isExpanded, setIsExpanded] = useState(false);
	const [isSelectOpen, setIsSelectOpen] = useState(false);
	const [isMenuSelectOpen, setIsMenuSelectOpen] = useState(false);
	const [isPinned, setIsPinned] = useState(() => {
		if (typeof window !== "undefined") {
			try {
				const stored = localStorage.getItem(STORAGE_KEYS.IS_PINNED);
				if (stored) {
					return stored === "true";
				}
			} catch (error) {
				console.warn(
					"Failed to read pin state from local storage:",
					error
				);
			}
		}
		return false;
	});
	const sidebarRef = useRef<HTMLDivElement>(null);

	const { address, skyBrowser } = useWallet();
	const { executionStatus } = useExecutionStatusStore();
	const { isRunning } = executionStatus;
	const queryClient = useQueryClient();

	const params = useParams();
	const searchParams = useSearchParams();
	const currentAgentAddress = params?.agentAddress as string;
	const currentWorkflowId = searchParams?.get("workflowId");
	const currentChatId = searchParams?.get("chatId");

	const hasWallet = !!address;

	const hasActiveWorkflow = (workflows: WorkflowItem[]) => {
		const hasActiveHistoryWorkflow = workflows.some((workflow) => {
			if (
				workflow.status === "in_progress" ||
				workflow.status === "waiting" ||
				workflow.status === "pending"
			) {
				return true;
			}

			if (workflow.status === "awaiting_response") {
				return workflow.questionType === "notification";
			}

			return false;
		});

		const isCurrentWorkflowRunning = isRunning;

		return hasActiveHistoryWorkflow || isCurrentWorkflowRunning;
	};

	const { data, refetch, isRefetching, isLoading, error } = useQuery({
		queryKey: [QUERY_KEYS.HISTORY, address],
		queryFn: async () => {
			const response = await getHistory(
				{ limit: chatCount },
				skyBrowser || undefined,
				address ? { address } : undefined
			);

			if (response.workflows && Array.isArray(response.workflows)) {
				return response.workflows;
			}
			return [];
		},
		enabled: !!address && !!skyBrowser,
		refetchOnMount: false,
		refetchOnWindowFocus: (query) => {
			const workflows = query.state.data as WorkflowItem[] | undefined;
			if (!workflows) return false;
			return hasActiveWorkflow(workflows);
		},

		refetchInterval: (query) => {
			const workflows = query.state.data as WorkflowItem[] | undefined;
			if (!workflows) return false;

			if (hasActiveWorkflow(workflows)) {
				const activeHistoryWorkflows = workflows.filter((w) => {
					if (
						w.status === "in_progress" ||
						w.status === "waiting" ||
						w.status === "pending"
					) {
						return true;
					}
					if (w.status === "awaiting_response") {
						return w.questionType === "notification";
					}
					return false;
				});

				console.log(`🔄 Polling active:`, {
					activeHistoryWorkflows: activeHistoryWorkflows.length,
					currentWorkflowRunning: isRunning,
					reason: isRunning
						? "Current workflow running"
						: "History workflows active",
					activeWorkflows: activeHistoryWorkflows.map((w) => ({
						id: w.requestId,
						status: w.status,
						questionType: w.questionType,
					})),
				});

				return 60000;
			}

			return false;
		},
		staleTime: 1000 * 60 * 5,
		gcTime: 1000 * 60 * 30,
		refetchOnReconnect: false,
	});

	const handlePrefetchChatData = useCallback(
		(workflowId: string) => {
			prefetchChatData(workflowId, queryClient);
		},
		[queryClient]
	);

	const history = data || [];

	const visibleItems = useMemo(() => {
		return hasWallet && history.length > 0
			? history.slice(0, chatCount)
			: [];
	}, [hasWallet, history, chatCount]);

	const sidebarIsExpanded = useMemo(() => {
		return isPinned || isExpanded;
	}, [isPinned, isExpanded]);

	const shouldShowError = useMemo(() => {
		return error && sidebarIsExpanded;
	}, [error, sidebarIsExpanded]);

	const shouldShowLoading = useMemo(() => {
		return isLoading && history.length === 0;
	}, [isLoading, history.length]);

	useEffect(() => {
		if (hasWallet && isRunning !== undefined) {
			const timeoutId = setTimeout(() => {
				if (isRunning) {
					console.log(
						"🚀 Current workflow started, refetching history and enabling polling"
					);
				} else {
					console.log(
						"✅ Current workflow completed, fetching final history update"
					);
				}
				refetch();
			}, 100);

			return () => clearTimeout(timeoutId);
		}
	}, [isRunning, hasWallet, refetch]);

	const handleMouseEnter = useCallback(() => {
		if (!isPinned) {
			setIsExpanded(true);
		}
	}, [isPinned]);

	const handleMouseLeave = useCallback(() => {
		if (!isPinned && !isSelectOpen && !isMenuSelectOpen) {
			setIsExpanded(false);
		}
	}, [isPinned, isSelectOpen, isMenuSelectOpen]);

	const createSelectHandler = useCallback(
		(setterFn: (open: boolean) => void, otherSelectOpen: boolean) => {
			return (open: boolean) => {
				setterFn(open);

				if (open) {
					if (!isPinned) setIsExpanded(true);
				} else {
					setTimeout(() => {
						if (
							sidebarRef.current &&
							!sidebarRef.current.matches(":hover") &&
							!otherSelectOpen &&
							!isPinned
						) {
							setIsExpanded(false);
						}
					}, 50);
				}
			};
		},
		[isPinned]
	);

	const handleSelectOpenChange = useMemo(
		() => createSelectHandler(setIsSelectOpen, isMenuSelectOpen),
		[createSelectHandler, isMenuSelectOpen]
	);

	const handleMenuSelectOpenChange = useMemo(
		() => createSelectHandler(setIsMenuSelectOpen, isSelectOpen),
		[createSelectHandler, isSelectOpen]
	);

	const handleChatCountChange = useCallback((value: string) => {
		const newCount = Number(value);
		if (CHAT_OPTIONS.includes(newCount as any)) {
			setChatCount(newCount);
			if (typeof window !== "undefined") {
				try {
					localStorage.setItem(
						STORAGE_KEYS.SELECTED_HISTORIES_COUNT,
						newCount.toString()
					);
				} catch (error) {
					console.warn(
						"Failed to save chat count to local storage:",
						error
					);
				}
			}
		} else {
			console.warn("Invalid chat count selected:", newCount);
		}
	}, []);

	const handlePinStateChange = useCallback(() => {
		const newPinState = !isPinned;
		setIsPinned(newPinState);
		console.log("Pin state changed:", newPinState ? "PINNED" : "UNPINNED");

		if (typeof window !== "undefined") {
			try {
				localStorage.setItem(
					STORAGE_KEYS.IS_PINNED,
					newPinState.toString()
				);
				console.log("Pin state saved to local storage");
			} catch (error) {
				console.warn(
					"Failed to save pin state to local storage:",
					error
				);
			}
		}
	}, [isPinned]);

	useEffect(() => {
		if (typeof window !== "undefined") {
			try {
				const stored = localStorage.getItem(
					STORAGE_KEYS.SELECTED_HISTORIES_COUNT
				);
				if (stored) {
					const storedCount = Number(stored);
					if (
						storedCount !== chatCount &&
						CHAT_OPTIONS.includes(storedCount as any)
					) {
						console.log(
							"Restoring chat count from local storage:",
							storedCount
						);
						setChatCount(storedCount);
					}
				}
			} catch (error) {
				console.warn(
					"Failed to synchronize chat count with local storage:",
					error
				);
			}
		}
	}, []);

	useEffect(() => {
		if (typeof window !== "undefined") {
			try {
				const stored = localStorage.getItem(STORAGE_KEYS.IS_PINNED);
				if (stored) {
					const storedPinState = stored === "true";
					if (storedPinState !== isPinned) {
						console.log(
							"Restoring pin state from local storage:",
							storedPinState
						);
						setIsPinned(storedPinState);
					}
				}
			} catch (error) {
				console.warn(
					"Failed to synchronize pin state with local storage:",
					error
				);
			}
		}
	}, []);

	const handleRefresh = useCallback(async () => {
		if (!isRefetching) {
			refetch();
		}
	}, [refetch, isRefetching]);

	const handleDelete = async (item: WorkflowItem) => {
		try {
			if (item.type === "chat" && item.chatId) {
				await deleteChatSession({
					chatId: item.chatId,
					skyBrowser,
					web3Context: address ? { address } : undefined,
				});
			} else if (item.requestId) {
				await deleteWorkflowRequest(
					item.requestId,
					skyBrowser,
					address ? { address } : undefined
				);
			}
			queryClient.invalidateQueries({
				queryKey: [QUERY_KEYS.HISTORY, chatCount, address],
			});
		} catch (error) {
			console.error("Failed to delete item:", error);
		}
	};

	return (
		<Sidebar
			ref={sidebarRef}
			collapsible="none"
			// On mobile, always expanded by default
			className={`rounded-lg transition-all duration-300 ease-in-out flex flex-col ${
				isMobile
					? "!w-full"
					: !sidebarIsExpanded
					? "w-[calc(var(--sidebar-width-icon)+5px)]!"
					: "!w-56"
			}`}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<SidebarContent className="w-full overflow-hidden z-50">
				<SidebarHeader>
					<SidebarMenu className="w-full px-1">
						<SidebarMenuItem
							className={`flex items-center gap-x-2 w-full transition-all duration-200 ${
								isMobile || sidebarIsExpanded
									? "justify-between"
									: "justify-center"
							}`}
						>
							<Label
								className={`text-sm font-medium transition-opacity duration-200 ${
									isMobile
										? "block"
										: "hidden " +
										  (sidebarIsExpanded ? "block" : "")
								} text-primary-foreground`}
							>
								Recents
							</Label>
							<div className="flex items-center gap-x-2">
								<Select
									onOpenChange={handleSelectOpenChange}
									value={chatCount.toString()}
									onValueChange={handleChatCountChange}
								>
									<SelectTrigger
										className={`!w-fit !h-7 px-[3.5px] py-0 !gap-x-1 bg-background border-0 text-sm rounded-md ${
											isMobile || sidebarIsExpanded
												? "px-[6px]"
												: "px-[3.5px]"
										}`}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{CHAT_OPTIONS.map((count) => (
											<SelectItem
												key={count}
												value={count.toString()}
											>
												{count}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{(isMobile || sidebarIsExpanded) && error && (
									<button
										onClick={handleRefresh}
										disabled={isRefetching}
										className="p-1 hover:bg-accent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
										title="Refresh history"
									>
										<RefreshCw
											className={`h-3 w-3 ${
												isRefetching
													? "animate-spin"
													: ""
											}`}
										/>
									</button>
								)}

								{!isMobile && (
									<div
										onClick={handlePinStateChange}
										className={`!w-fit !h-7 px-2 flex items-center justify-center rounded-md transition-colors duration-200 ${
											sidebarIsExpanded
												? "block"
												: "hidden"
										} ${
											isPinned
												? "bg-accent text-accent-foreground"
												: ""
										}`}
									>
										<PinIcon className="!size-4 rotate-45" />
									</div>
								)}
							</div>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>

				<SidebarGroup>
					<SidebarMenu
						className={`-pt-2 -mt-2.5 md:-mt-0 md:-pt-0 gap-y-2 flex flex-col transition-all duration-100 px-0 overflow-y-auto scrollbar-hide hover:scrollbar-thin max-h-[calc(100vh-100px)] ${
							isMobile || sidebarIsExpanded
								? "items-start"
								: "items-center"
						}`}
					>
						{shouldShowLoading ? (
							<div className="w-full flex flex-col gap-2">
								{Array.from({ length: 3 }, (_, index) => (
									<Skeleton
										key={index}
										className="h-6 w-full bg-background/50 rounded-md"
									/>
								))}
							</div>
						) : (
							<>
								{shouldShowError && (
									<div className="px-2 py-1 text-xs text-red-500">
										Failed to load history:{" "}
										{error?.message || "Unknown error"}
									</div>
								)}
								{visibleItems.map(
									(workflow: WorkflowItem, index: number) => {
										const isSelected =
											workflow.type === "chat"
												? currentChatId ===
												  workflow.chatId
												: currentAgentAddress ===
														workflow.agentAddress &&
												  currentWorkflowId ===
														workflow.requestId;

										const isRunning =
											workflow.status === "in_progress" ||
											workflow.status === "waiting" ||
											workflow.status === "pending" ||
											(workflow.status ===
												"awaiting_response" &&
												workflow.questionType ===
													"notification");

										return (
											<WorkflowItem
												key={
													workflow.requestId ||
													workflow.id ||
													index
												}
												workflow={workflow}
												index={index}
												sidebarIsExpanded={
													isMobile
														? true
														: sidebarIsExpanded
												}
												handleMenuSelectOpenChange={
													handleMenuSelectOpenChange
												}
												onPrefetch={
													handlePrefetchChatData
												}
												isSelected={isSelected}
												isRunning={isRunning}
												currentAgentId={
													currentAgentAddress
												}
												currentWorkflowId={
													currentWorkflowId
												}
												handleDelete={handleDelete}
											/>
										);
									}
								)}
							</>
						)}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
});

ChatSidebar.displayName = "ChatSidebar";

export default ChatSidebar;
