"use client";
import React, {
	useState,
	useRef,
	useCallback,
	useEffect,
	useMemo,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
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
} from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../ui/tooltip";
import { Skeleton } from "../ui/skeleton";
import { useWallet } from "@/hooks/use-wallet";
import { useExecutionStatusStore } from "@/stores/execution-status-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHistory } from "@/controllers/requests";
import { prefetchChatData } from "@/utils/chat-utils";
import { STORAGE_KEYS } from "@/config/constants";

const CHAT_OPTIONS = [1, 5, 10, 15, 20] as const;

interface WorkflowItem {
	requestId: string;
	id?: string;
	agentId: string;
	status: string;
	userPrompt?: string;
	questionType?: string; // Add questionType field for awaiting_response statuses
}

const getWorkflowIcon = (status: string, questionType?: string) => {
	switch (status) {
		case "completed":
			return CheckCircle; 
		case "awaiting_response":
			// Different icons for different question types
			switch (questionType) {
				case "notification":
					return ShieldAlert; // Yellow shield for notifications
				case "feedback":
					return MessageCircle; // Blue message circle for feedback
				case "authentication":
					return Shield; // Blue shield for authentication
				default:
					return ShieldAlert; // Default to shield alert
			}
		case "stopped":
			return CircleStop; 
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
			// Different colors for different question types
			switch (questionType) {
				case "notification":
					return "text-yellow-700"; // Yellow for notifications
				case "feedback":
					return "text-blue-700"; // Blue for feedback
				case "authentication":
					return "text-blue-700"; // Blue for authentication
				default:
					return "text-yellow-700"; // Default to yellow
			}
		case "stopped":
			return "text-red-700"; 
		case "failed":
			return "text-red-700"; 
		case "in_progress":
			return "text-green-700"; 
		case "waiting":
			return "text-green-700"; 
		case "pending":
			return "text-green-700"; 
		default:
			return "text-gray-400"; 
	}
};

// Get animation classes for workflow status icons
const getWorkflowIconAnimation = (status: string, questionType?: string) => {
	switch (status) {
		case "in_progress":
		case "waiting":
			return "animate-spin"; 
		case "awaiting_response":
			// Different animations for different question types
			switch (questionType) {
				case "notification":
					return ""; // No animation for notifications
				case "feedback":
				case "authentication":
					return "animate-pulse"; // Pulse animation for user input needed
				default:
					return ""; // No animation for unknown types
			}
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
	}: {
		workflow: WorkflowItem;
		index: number;
		sidebarIsExpanded: boolean;
		handleMenuSelectOpenChange: (open: boolean) => void;
		onPrefetch: (workflowId: string) => void;
		isSelected: boolean;
		isRunning: boolean;
	}) => {
		const Icon = getWorkflowIcon(workflow.status, workflow.questionType);
		const iconColor = getWorkflowIconColor(workflow.status, workflow.questionType);
		const iconAnimation = getWorkflowIconAnimation(workflow.status, workflow.questionType);

		return (
			<SidebarMenuItem
				key={workflow.requestId || workflow.id || index}
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
							href={`/chat/agent/${workflow.agentId}?workflowId=${workflow.requestId}`}
							className="w-full flex items-center justify-center gap-x-1.5"
							onMouseEnter={() =>
								onPrefetch(
									workflow.requestId || workflow.id || ""
								)
							}
						>
							{Icon && <Icon className={`!size-[19px] ${iconColor} ${iconAnimation}`} />}
							{sidebarIsExpanded && (
								<div className="flex items-center !w-full flex-1 min-w-0">
									<div className="flex flex-col w-[140px] min-w-0">
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="text-sm text-ellipsis whitespace-nowrap overflow-hidden cursor-pointer">
														{workflow.userPrompt ||
															workflow.requestId}
													</span>
												</TooltipTrigger>
												<TooltipContent>
													<p className="max-w-xs">
														{workflow.userPrompt ||
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
								defaultValue="Left"
							>
								<SelectTrigger className="!border-none">
									<MoreVerticalIcon className="!size-4 flex-shrink-0" />
								</SelectTrigger>
								<SelectContent>
									{["Left", "Right"].map((side) => (
										<SelectItem key={side} value={side}>
											{side}
										</SelectItem>
									))}
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

const ChatSidebar = React.memo(() => {
	const [chatCount, setChatCount] = useState(() => {
		if (typeof window !== 'undefined') {
			try {
				const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_HISTORIES_COUNT);
				if (stored) {
					const parsedCount = Number(stored);	
					if (CHAT_OPTIONS.includes(parsedCount as any)) {
						return parsedCount;
					}
				}
			} catch (error) {
				console.warn('Failed to read chat count from local storage:', error);
			}
		}
		return 5; 
	});
	const [isExpanded, setIsExpanded] = useState(false);
	const [isSelectOpen, setIsSelectOpen] = useState(false);
	const [isMenuSelectOpen, setIsMenuSelectOpen] = useState(false);
	const [isPinned, setIsPinned] = useState(() => {
		if (typeof window !== 'undefined') {
			try {
				const stored = localStorage.getItem(STORAGE_KEYS.IS_PINNED);
				if (stored) {
					return stored === 'true';
				}
			} catch (error) {
				console.warn('Failed to read pin state from local storage:', error);
			}
		}
		return false; 
	});
	const sidebarRef = useRef<HTMLDivElement>(null);

	const { address, skyBrowser } = useWallet();
	const { isRunning } = useExecutionStatusStore();
	const queryClient = useQueryClient();

	const params = useParams();
	const searchParams = useSearchParams();
	const currentAgentId = params?.id as string;
	const currentWorkflowId = searchParams?.get("workflowId");

	const hasWallet = !!address;


	const hasActiveWorkflow = (workflows: WorkflowItem[]) => {
		const hasActiveHistoryWorkflow = workflows.some(
			(workflow) => {
				// Always poll for these active server states
				if (workflow.status === "in_progress" || 
					workflow.status === "waiting" || 
					workflow.status === "pending") {
					return true;
				}
				
				// For awaiting_response, only poll if it's a notification type
				if (workflow.status === "awaiting_response") {
					return workflow.questionType === "notification";
				}
				
				return false;
			}
		);

		const isCurrentWorkflowRunning = isRunning;

		return hasActiveHistoryWorkflow || isCurrentWorkflowRunning;
	};

	const { data, refetch, isRefetching, isLoading, error } = useQuery({
		queryKey: ["history", chatCount, address],
		queryFn: async () => {
			const response = await getHistory(
				{ limit: chatCount },
				skyBrowser || undefined,
				address ? { address } : undefined
			);

			if (response.workflows && Array.isArray(response.workflows)) {
				return response.workflows;
			} else if (response.success && response.data?.requests) {
				return response.data.requests;
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
				const activeHistoryWorkflows = workflows.filter(w => {
					if (w.status === "in_progress" || w.status === "waiting" || w.status === "pending") {
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
					reason: isRunning ? 'Current workflow running' : 'History workflows active',
					activeWorkflows: activeHistoryWorkflows.map(w => ({ 
						id: w.requestId, 
						status: w.status, 
						questionType: w.questionType 
					}))
				});
				
				return 60000; 
			}

			console.log('⏹️ Stopping polling - no active workflows or running workflow');
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
					console.log("🚀 Current workflow started, refetching history and enabling polling");
				} else {
					console.log("✅ Current workflow completed, fetching final history update");
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
			if (typeof window !== 'undefined') {
				try {
					localStorage.setItem(STORAGE_KEYS.SELECTED_HISTORIES_COUNT, newCount.toString());
				} catch (error) {
					console.warn('Failed to save chat count to local storage:', error);
				}
			}
		} else {
			console.warn('Invalid chat count selected:', newCount);
		}
	}, []);

	const handlePinStateChange = useCallback(() => {
		const newPinState = !isPinned;
		setIsPinned(newPinState);
		console.log('Pin state changed:', newPinState ? 'PINNED' : 'UNPINNED');
		
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem(STORAGE_KEYS.IS_PINNED, newPinState.toString());
				console.log('Pin state saved to local storage');
			} catch (error) {
				console.warn('Failed to save pin state to local storage:', error);
			}
		}
	}, [isPinned]);

	useEffect(() => {
		if (typeof window !== 'undefined') {
			try {
				const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_HISTORIES_COUNT);
				if (stored) {
					const storedCount = Number(stored);
					if (storedCount !== chatCount && CHAT_OPTIONS.includes(storedCount as any)) {
						console.log('Restoring chat count from local storage:', storedCount);
						setChatCount(storedCount);
					}
				}
			} catch (error) {
				console.warn('Failed to synchronize chat count with local storage:', error);
			}
		}
	}, []); 

	useEffect(() => {
		if (typeof window !== 'undefined') {
			try {
				const stored = localStorage.getItem(STORAGE_KEYS.IS_PINNED);
				if (stored) {
					const storedPinState = stored === 'true';
					if (storedPinState !== isPinned) {
						console.log('Restoring pin state from local storage:', storedPinState);
						setIsPinned(storedPinState);
					}
				}
			} catch (error) {
				console.warn('Failed to synchronize pin state with local storage:', error);
			}
		}
	}, []);

	const handleRefresh = useCallback(async () => {
		if (!isRefetching) {
			refetch();
		}
	}, [refetch, isRefetching]);

	return (
		<Sidebar
			ref={sidebarRef}
			collapsible="none"
			className={`rounded-lg transition-all duration-300 ease-in-out flex flex-col ${
				!sidebarIsExpanded
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
								sidebarIsExpanded
									? "justify-between"
									: "justify-center"
							}`}
						>
							<Label
								className={`text-sm font-medium transition-opacity duration-200 hidden text-primary-foreground ${
									sidebarIsExpanded && "block"
								}`}
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
											sidebarIsExpanded
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
								{sidebarIsExpanded && error && (
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

								<div
									onClick={handlePinStateChange}
									className={`!w-fit !h-7 px-2 flex items-center justify-center rounded-md transition-colors duration-200 ${
										sidebarIsExpanded ? "block" : "hidden"
									} ${isPinned ? "bg-accent text-accent-foreground" : ""}`}
								>
									<PinIcon className="!size-4 rotate-45" />
								</div>
							</div>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>

				<SidebarGroup>
					<SidebarMenu
						className={`gap-y-2 flex flex-col transition-all duration-100 px-0 overflow-y-auto scrollbar-hide hover:scrollbar-thin max-h-[calc(100vh-100px)] ${
							sidebarIsExpanded ? "items-start" : "items-center"
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
											currentAgentId ===
												workflow.agentId &&
											currentWorkflowId ===
												workflow.requestId;

										const isRunning =
											workflow.status === "in_progress" ||
											workflow.status === "waiting" ||
											workflow.status === "pending" ||
											(workflow.status === "awaiting_response" && workflow.questionType === "notification");

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
													sidebarIsExpanded
												}
												handleMenuSelectOpenChange={
													handleMenuSelectOpenChange
												}
												onPrefetch={
													handlePrefetchChatData
												}
												isSelected={isSelected}
												isRunning={isRunning}
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
