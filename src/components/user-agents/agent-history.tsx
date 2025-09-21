"use client";

import React, { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	type ColumnDef,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { Clock, CheckCircle, TimerIcon, Trash, Settings } from "lucide-react";
import { getHistoryByAgent } from "@/controllers/requests/requests.query";
import { QUERY_KEYS } from "@/utils/query-keys";
import { useWallet } from "@/hooks/use-wallet";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/table/DataTable";
import type { HistoryItem } from "@/types";
import { STATUS_CONFIG } from "@/constants/status-config";
import { deleteWorkflowRequest } from "@/controllers/requests/requests.mutation";
import { toast } from "sonner";

// Memoized status badge component to prevent unnecessary re-renders
const StatusBadge = React.memo(({ status }: { status: string }) => {
	const config = useMemo(
		() =>
			STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ||
			STATUS_CONFIG.failed,
		[status]
	);

	return (
		<Badge variant={config.variant as any} className={config.className}>
			{config.label}
		</Badge>
	);
});

const formatDuration = (createdAt: string, updatedAt: string) => {
	const created = new Date(createdAt);
	const updated = new Date(updatedAt);
	const diffMs = updated.getTime() - created.getTime();
	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMinutes < 1) return "< 1 minute";
	if (diffMinutes === 1) return "1 minute";
	if (diffMinutes < 60) return `${diffMinutes} minutes`;
	if (diffHours === 1) return "1 hour";
	if (diffHours < 24) return `${diffHours} hours`;
	if (diffDays === 1) return "1 day";
	return `${diffDays} days`;
};

interface AgentHistoryProps {
	agentAddress: string;
	agentID: string;
}

function AgentHistory({ agentAddress, agentID }: AgentHistoryProps) {
	const { skyBrowser, address } = useWallet();
	const router = useRouter();
	const queryClient = useQueryClient();
	const {
		data: historyData,
		isLoading,
		isError,
		error,
	} = useQuery({
		queryKey: [QUERY_KEYS.AGENT_HISTORY, agentAddress, agentID],
		queryFn: async () => {
			if (!skyBrowser || !address) {
				return { workflows: [], pagination: { total: 0 } };
			}
			const web3Context = { address };

			try {
				const response = await getHistoryByAgent(
					{
						agentAddress,
						agentID,
						page: 1,
						limit: 100,
					},
					skyBrowser,
					web3Context
				);
				return response;
			} catch (error) {
				throw error;
			}
		},
		enabled: !!agentAddress && !!agentID && !!skyBrowser && !!address,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	});

	const workflows: HistoryItem[] = useMemo(
		() =>
			Array.isArray(historyData?.workflows)
				? historyData.workflows.map((w: any) => ({
						...w,
						id: w.id || w.requestId,
				  }))
				: [],
		[historyData?.workflows]
	);

	const handleWorkflowClick = useCallback(
		(
			workflowId: string,
			agentAddress: string,
			agentIDFromCollection: string
		) => {
			router.push(
				`/chat/agent/${agentAddress}?workflowId=${workflowId}&nftId=${agentIDFromCollection}`
			);
		},
		[router]
	);

	const handleDelete = async (workflowId: string) => {
		try {
			await deleteWorkflowRequest(
				workflowId,
				skyBrowser,
				address ? { address } : undefined
			);
			queryClient.invalidateQueries({
				queryKey: [QUERY_KEYS.HISTORY, agentAddress, agentID],
			});
			toast.success("Workflow deleted successfully");
		} catch (error) {
			console.error("Failed to delete workflow:", error);
		}
	};

	// Memoize columns definition to prevent recreation on every render
	const columns: ColumnDef<HistoryItem>[] = useMemo(
		() => [
			{
				accessorKey: "userPrompt",
				header: () => (
					<div className="text-gray-400 font-semibold flex items-center gap-2 w-40 md:w-[350px]">
						<Clock className="size-4" />
						<span>Workflow</span>
					</div>
				),
				cell: ({ row }) => (
					<button
						onClick={() =>
							handleWorkflowClick(
								row.original.requestId || "",
								row.original.agentAddress || "",
								row.original.agentIDFromCollection || ""
							)
						}
						className="text-sm text-gray-300 block hover:text-blue-400 transition-colors cursor-pointer text-left w-full max-w-40 md:max-w-[350px] overflow-hidden whitespace-nowrap text-ellipsis"
						title={row.original.userPrompt || "Untitled workflow"}
					>
						{row.original.userPrompt || "Untitled workflow"}
					</button>
				),
			},
			{
				accessorKey: "status",
				header: () => (
					<div className="text-gray-400 font-semibold flex items-center gap-2 min-w-24">
						<CheckCircle className="size-4" />
						<span>Status</span>
					</div>
				),
				cell: ({ row }) => <StatusBadge status={row.original.status} />,
			},
			{
				accessorKey: "updatedAt",
				header: () => (
					<div className="text-gray-400 font-semibold flex items-center gap-2 w-full min-w-24">
						<TimerIcon className="size-4" />
						<span>Last Updated</span>
					</div>
				),
				cell: ({ row }) => (
					<div className="text-sm text-gray-400 w-full flex">
						<span className="flex-1 truncate">
							{new Date(
								row.original.updatedAt
							).toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
								hour: "numeric",
								minute: "2-digit",
								hour12: true,
							})}
						</span>
					</div>
				),
			},
			{
				accessorKey: "duration",
				header: () => (
					<div className="text-gray-400 font-semibold flex items-center gap-2 min-w-24">
						<Clock className="size-4" />
						<span>Duration</span>
					</div>
				),
				cell: ({ row }) => (
					<span className="text-sm text-gray-400">
						{formatDuration(
							row.original.createdAt,
							row.original.updatedAt
						)}
					</span>
				),
			},
			{
				accessorKey: "action",
				header: () => (
					<div className="text-gray-400 font-semibold flex items-center gap-2 min-w-24">
						<Settings className="size-4" />
						<span>Action</span>
					</div>
				),
				cell: ({ row }) => (
					<span className="text-sm text-gray-400">
						<button
							onClick={() => handleDelete(row.original.requestId)}
							className="text-red-400 hover:text-red-400/80"
						>
							<Trash className="size-4" />
						</button>
					</span>
				),
			},
		],
		[handleWorkflowClick]
	);

	// Create table instance (useReactTable already handles memoization internally)
	const table = useReactTable({
		data: workflows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div>
			<DataTable table={table} columns={columns} isLoading={isLoading} />
		</div>
	);
}

// Export memoized component to prevent unnecessary re-renders when parent re-renders
export default React.memo(AgentHistory);
