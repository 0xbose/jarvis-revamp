"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	type ColumnDef,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	Filter,
	Clock,
	CheckCircle,
	TimerIcon,
	EllipsisVertical,
	Trash,
	Settings,
	Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getHistory } from "@/controllers/requests/requests.query";
import { useWallet } from "@/hooks/use-wallet";
import { HistoryItem, WorkflowResponse } from "@/types";
import DataTable from "@/components/table/DataTable";
import DataPagination from "@/components/common/pagination";
import SearchBar from "@/components/common/search";
import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { STATUS_CONFIG } from "@/constants/status-config";
import { QUERY_KEYS } from "@/utils/query-keys";
import { deleteWorkflowRequest } from "@/controllers/requests/requests.mutation";
import { toast } from "sonner";

// Helper functions remain unchanged
function getStatusBadge(status: string) {
	const config =
		STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ||
		STATUS_CONFIG.failed;
	return (
		<Badge variant={config.variant as any} className={config.className}>
			{config.label}
		</Badge>
	);
}

function formatDuration(createdAt: string, updatedAt: string) {
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
}

const STATUS_OPTIONS = [
	"completed",
	"stopped",
	"awaiting_response",
	"failed",
	"in_progress",
	"waiting",
	"pending",
];

// Move all logic that uses useSearchParams into a suspense boundary
function WorkflowHistoryInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const currentPage = Number(searchParams.get("page") || "1");
	const searchTerm = searchParams.get("search") || "";
	const statusParam = searchParams.get("status") || "";
	const queryClient = useQueryClient();

	const [statusFilter, setStatusFilter] = useState<string[]>(
		statusParam ? [statusParam] : []
	);
	const [search, setSearch] = useState(searchTerm);
	const [deletingWorkflowId, setDeletingWorkflowId] = useState<string | null>(
		null
	);

	const pageSize = 10;
	const { skyBrowser, address } = useWallet();

	const updateSearchParams = (updates: Record<string, string | null>) => {
		const newParams = new URLSearchParams(searchParams);
		Object.entries(updates).forEach(([key, value]) => {
			if (value) newParams.set(key, value);
			else newParams.delete(key);
		});
		router.push(`/history?${newParams.toString()}`);
	};

	const {
		data: historyData,
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: [
			QUERY_KEYS.HISTORY,
			address,
			skyBrowser,
			currentPage,
			pageSize,
			statusFilter.length > 0 ? statusFilter[0] : undefined,
		],
		queryFn: async () => {
			if (!skyBrowser || !address) {
				return { workflows: [], pagination: { total: 0 } };
			}
			const web3Context = { address };
			const response = await getHistory(
				{
					page: currentPage,
					limit: pageSize,
					status:
						statusFilter.length > 0
							? (statusFilter[0] as
									| "in_progress"
									| "waiting"
									| "completed"
									| "pending"
									| "failed"
									| "stopped"
									| "awaiting_response")
							: undefined,
				},
				skyBrowser,
				web3Context
			);

			let newWorkflows: HistoryItem[] = [];
			let newTotalCount = 0;

			if (Array.isArray(response.workflows)) {
				newWorkflows = response.workflows.map((w: any) => ({
					...w,
					id: w.id || w.requestId,
				}));
				newTotalCount =
					response.pagination?.total || response.workflows.length;
			}

			return {
				workflows: newWorkflows,
				pagination: { total: newTotalCount },
			};
		},
		placeholderData: keepPreviousData,
		enabled: !!address && !!skyBrowser,
		gcTime: 1000 * 60 * 5, // 5 minutes ( garbage collection )
		staleTime: 1000 * 60 * 5, // 5 minutes ( keep previous data )
	});

	const workflows: HistoryItem[] = Array.isArray(
		(historyData as WorkflowResponse)?.workflows
	)
		? (historyData as WorkflowResponse).workflows
		: [];

	const totalCount: number =
		(historyData as WorkflowResponse)?.pagination?.total ??
		workflows.length;

	const handleSearch = (value: string) => {
		setSearch(value);
		updateSearchParams({ search: value || null, page: "1" });
	};

	const handleStatusFilterChange = (status: string, checked: boolean) => {
		const newStatusFilter = checked
			? [...statusFilter, status]
			: statusFilter.filter((s) => s !== status);
		setStatusFilter(newStatusFilter);
		updateSearchParams({
			status: newStatusFilter.length > 0 ? newStatusFilter[0] : null,
			page: "1",
		});
	};

	const handleClearFilters = () => {
		setStatusFilter([]);
		updateSearchParams({ status: null, page: "1" });
	};

	useEffect(() => {
		setSearch(searchTerm);
		setStatusFilter(statusParam ? [statusParam] : []);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchTerm, statusParam]);

	useEffect(() => {
		refetch();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [skyBrowser, address, currentPage, pageSize, statusFilter]);

	const filteredWorkflows = useMemo(() => {
		if (!search.trim()) return workflows;
		const lower = search.toLowerCase();
		return workflows.filter(
			(w) =>
				w.userPrompt?.toLowerCase().includes(lower) ||
				w.status?.toLowerCase().includes(lower)
		);
	}, [workflows, search]);

	const handleDelete = async (workflowId: string) => {
		if (deletingWorkflowId) return; // Prevent multiple clicks

		setDeletingWorkflowId(workflowId);
		try {
			await deleteWorkflowRequest(
				workflowId,
				skyBrowser,
				address ? { address } : undefined
			);
			queryClient.invalidateQueries({
				queryKey: [QUERY_KEYS.HISTORY, address],
			});
			toast.success("Workflow deleted successfully");
		} catch (error) {
			console.error("Failed to delete workflow:", error);
			toast.error("Failed to delete workflow");
		} finally {
			setDeletingWorkflowId(null);
		}
	};

	const columns: ColumnDef<HistoryItem>[] = [
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
					onClick={() => {
						const workflowId = row.original.requestId;
						const agentAddress = row.original.agentAddress;
						router.push(
							`/chat/agent/${agentAddress}?workflowId=${workflowId}`
						);
					}}
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
			cell: ({ row }) => getStatusBadge(row.original.status),
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
		{
			accessorKey: "action",
			header: () => (
				<div className="text-gray-400 font-semibold flex items-center gap-2 min-w-24">
					<Settings className="size-4" />
					<span>Action</span>
				</div>
			),
			cell: ({ row }) => {
				const isDeleting =
					deletingWorkflowId === row.original.requestId;
				return (
					<span className="text-sm text-gray-400">
						<button
							onClick={() => handleDelete(row.original.requestId)}
							disabled={isDeleting || !!deletingWorkflowId}
							className={`${
								isDeleting
									? "text-gray-500 cursor-not-allowed"
									: "text-red-400 hover:text-red-400/80"
							} transition-colors`}
						>
							{isDeleting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Trash className="size-4" />
							)}
						</button>
					</span>
				);
			},
		},
	];

	const hasActiveFilters = statusFilter.length > 0;
	const table = useReactTable({
		data: filteredWorkflows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const effectiveTotal = search.trim()
		? filteredWorkflows.length
		: totalCount;
	const maxPages = Math.ceil(effectiveTotal / pageSize);

	return (
		<div className="p-6">
			<div>
				<div className="mb-6">
					<h1 className="text-2xl font-semibold mb-4">History</h1>
					<div className="flex items-center justify-between">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									className="bg-background border border-border rounded-md text-gray-300"
								>
									<Filter className="w-4 h-4 mr-2" />
									Filter
									{hasActiveFilters && (
										<div className="bg-blue-600 px-2 py-0.5 rounded-md text-white flex items-center justify-center">
											{statusFilter.length}
										</div>
									)}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="bg-background border border-border rounded-md">
								<div className="p-2">
									<div className="text-sm font-medium text-gray-300 mb-2">
										Status
									</div>
									{STATUS_OPTIONS.map((status) => (
										<DropdownMenuCheckboxItem
											key={status}
											checked={statusFilter.includes(
												status
											)}
											onCheckedChange={(
												checked: boolean
											) =>
												handleStatusFilterChange(
													status,
													checked
												)
											}
											className="text-gray-300 hover:bg-background/50"
										>
											{status
												.replace("_", " ")
												.replace(/\b\w/g, (l) =>
													l.toUpperCase()
												)}
										</DropdownMenuCheckboxItem>
									))}
								</div>
								{hasActiveFilters && (
									<>
										<div className="border-t border-gray-700 my-1" />
										<DropdownMenuItem
											onClick={handleClearFilters}
											className="text-gray-300 hover:bg-background/50"
										>
											Clear filters
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
						<SearchBar
							value={search}
							onChange={setSearch}
							onSearch={handleSearch}
							className="w-64 bg-background border border-border rounded-md"
							placeholder="Search workflows..."
							debounceTime={300}
						/>
					</div>
				</div>
				{hasActiveFilters && (
					<div className="mb-4 text-sm text-gray-400">
						Filters applied:{" "}
						{statusFilter
							.map((s) =>
								s
									.replace("_", " ")
									.replace(/\b\w/g, (l) => l.toUpperCase())
							)
							.join(", ")}
					</div>
				)}
				<div className="space-y-4">
					<DataTable
						table={table}
						columns={columns}
						isLoading={isLoading || isFetching}
					/>
					<DataPagination
						maxPages={maxPages}
						total={effectiveTotal}
						currentLocation="/history"
					/>
				</div>
			</div>
		</div>
	);
}

export default function WorkflowHistory() {
	return (
		<Suspense
			fallback={
				<div className="p-6 text-gray-400">Loading history...</div>
			}
		>
			<WorkflowHistoryInner />
		</Suspense>
	);
}
