"use client";

import React, { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
	type ColumnDef,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { Clock, CheckCircle, TimerIcon } from "lucide-react";
import { getHistoryByAgent } from "@/controllers/requests/requests.query";
import { QUERY_KEYS } from "@/utils/query-keys";
import { useWallet } from "@/hooks/use-wallet";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/table/DataTable";
import type { HistoryItem } from "@/types";
import { STATUS_CONFIG } from "@/constants/status-config";

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

// Memoized duration formatter to avoid recalculating on every render
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
						limit: 100, // fetch up to 100, no pagination UI
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
		staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
		gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
	});

	// Memoize the workflows data transformation to avoid recalculation on every render
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

	// Memoize the navigation handler to prevent unnecessary re-renders
	const handleWorkflowClick = useCallback(
		(workflowId: string, agentAddress: string) => {
			router.push(`/chat/agent/${agentAddress}?workflowId=${workflowId}`);
		},
		[router]
	);

	// Memoize columns definition to prevent recreation on every render
	const columns: ColumnDef<HistoryItem>[] = useMemo(
		() => [
			{
				accessorKey: "userPrompt",
				header: () => (
					<div className="text-gray-400 font-semibold flex items-center gap-2 w-[350px]">
						<Clock className="size-4" />
						<span>Workflow</span>
					</div>
				),
				cell: ({ row }) => (
					<button
						onClick={() =>
							handleWorkflowClick(
								row.original.requestId || "",
								row.original.agentAddress || ""
							)
						}
						className="text-sm text-gray-300 block hover:text-blue-400 transition-colors cursor-pointer text-left w-full max-w-[350px] overflow-hidden whitespace-nowrap text-ellipsis"
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
					<div className="text-gray-400 font-semibold flex items-center gap-2 min-w-24">
						<TimerIcon className="size-4" />
						<span>Last Updated</span>
					</div>
				),
				cell: ({ row }) => (
					<span className="text-sm text-gray-400">
						{new Date(row.original.updatedAt).toLocaleDateString(
							"en-US",
							{
								month: "short",
								day: "numeric",
								hour: "numeric",
								minute: "2-digit",
								hour12: true,
							}
						)}
					</span>
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
