"use client";

import {
	type ColumnDef,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	Filter,
	Search,
	Clock,
	CheckCircle,
	XCircle,
	TimerIcon,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getHistory } from "@/controllers/requests";
import { useWallet } from "@/hooks/use-wallet";
import { HistoryItem } from "@/types";
import DataTable from "@/components/table/DataTable";
import DataPagination from "@/components/common/pagination";
import SearchBar from "@/components/common/search";

const getStatusBadge = (status: string) => {
	const statusConfig = {
		completed: {
			label: "Completed",
			variant: "default" as const,
			className: "bg-green-100 text-green-800 hover:bg-green-100",
		},
		stopped: {
			label: "Stopped",
			variant: "secondary" as const,
			className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
		},
		waiting_response: {
			label: "Waiting Response",
			variant: "secondary" as const,
			className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
		},
		failed: {
			label: "Failed",
			variant: "destructive" as const,
			className: "bg-red-100 text-red-800 hover:bg-red-100",
		},
		in_progress: {
			label: "In Progress",
			variant: "secondary" as const,
			className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
		},
		pending: {
			label: "Pending",
			variant: "secondary" as const,
			className: "bg-gray-100 text-gray-800 hover:bg-gray-100",
		},
	};

	const config =
		statusConfig[status as keyof typeof statusConfig] ||
		statusConfig.failed;

	return (
		<Badge variant={config.variant} className={config.className}>
			{config.label}
		</Badge>
	);
};

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

const formatLastUpdated = (updatedAt: string) => {
	const updated = new Date(updatedAt);
	const now = new Date();
	const diffMs = now.getTime() - updated.getTime();
	const diffMinutes = Math.floor(diffMs / (1000 * 60));

	if (diffMinutes < 1) return "Just now";
	if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours} hours ago`;

	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays} days ago`;
};

export default function WorkflowHistory() {
	// URL state management
	const router = useRouter();
	const searchParams = useSearchParams();
	const currentPage = Number(searchParams.get("page") || "1");
	const searchTerm = searchParams.get("search") || "";
	const statusParam = searchParams.get("status") || "";

	// State management
	const [workflows, setWorkflows] = useState<HistoryItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [statusFilter, setStatusFilter] = useState<string[]>(
		statusParam ? [statusParam] : []
	);
	const pageSize = 10;
	const [totalCount, setTotalCount] = useState(0);
	const [search, setSearch] = useState(searchTerm);

	// Wallet hook
	const { skyBrowser, address } = useWallet();

	// Update URL params helper
	const updateSearchParams = (updates: Record<string, string | null>) => {
		const newParams = new URLSearchParams(searchParams);
		Object.entries(updates).forEach(([key, value]) => {
			if (value) {
				newParams.set(key, value);
			} else {
				newParams.delete(key);
			}
		});
		router.push(`/history?${newParams.toString()}`);
	};

	// Fetch history function
	const fetchHistory = useCallback(async () => {
		if (!skyBrowser || !address) {
			setWorkflows([]);
			setTotalCount(0);
			return;
		}

		try {
			setLoading(true);
			setError(null);

			const web3Context = { address };
			const response = await getHistory(
				{
					page: currentPage,
					limit: pageSize,
					status:
						statusFilter.length > 0
							? (statusFilter[0] as
									| "in_progress"
									| "completed"
									| "pending"
									| "failed"
									| "stopped"
									| "waiting_response")
							: undefined,
				},
				skyBrowser,
				web3Context
			);

			// Handle the response format
			let newWorkflows: HistoryItem[] = [];
			let newTotalCount = 0;

			if (response.workflows && Array.isArray(response.workflows)) {
				// New API format: direct workflows array with pagination object
				newWorkflows = response.workflows.map((workflow: any) => ({
					...workflow,
					id: workflow.id || workflow.requestId, // Ensure id field exists
				}));
				newTotalCount =
					response.pagination?.total || response.workflows.length;
			} else if (response.success && response.data?.requests) {
				// Legacy format: nested in data.requests
				newWorkflows = response.data.requests.map((workflow: any) => ({
					...workflow,
					id: workflow.id || workflow.requestId, // Ensure id field exists
				}));
				newTotalCount =
					response.data.pagination?.total ||
					response.data.totalCount ||
					response.data.requests.length;
			} else if (response.data?.requests) {
				// Another legacy format variation
				newWorkflows = response.data.requests.map((workflow: any) => ({
					...workflow,
					id: workflow.id || workflow.requestId, // Ensure id field exists
				}));
				newTotalCount =
					response.data.pagination?.total ||
					response.data.totalCount ||
					response.data.requests.length;
			}

			setWorkflows(newWorkflows);
			setTotalCount(newTotalCount);
		} catch (err) {
			console.error("Failed to fetch history:", err);
			setError(
				err instanceof Error ? err.message : "Failed to fetch history"
			);
		} finally {
			setLoading(false);
		}
	}, [skyBrowser, address, currentPage, pageSize, statusFilter]);

	// Handle search functionality
	const handleSearch = (value: string) => {
		setSearch(value);
		updateSearchParams({ search: value || null, page: "1" });
	};

	// Handle status filter changes
	const handleStatusFilterChange = (status: string, checked: boolean) => {
		let newStatusFilter: string[];
		if (checked) {
			newStatusFilter = [...statusFilter, status];
		} else {
			newStatusFilter = statusFilter.filter((s: string) => s !== status);
		}
		setStatusFilter(newStatusFilter);
		updateSearchParams({
			status: newStatusFilter.length > 0 ? newStatusFilter[0] : null,
			page: "1",
		});
	};

	// Handle clear filters
	const handleClearFilters = () => {
		setStatusFilter([]);
		updateSearchParams({ status: null, page: "1" });
	};

	// Sync local state with URL parameters
	useEffect(() => {
		setSearch(searchTerm);
		setStatusFilter(statusParam ? [statusParam] : []);
	}, [searchTerm, statusParam]);

	// Fetch history when dependencies change
	useEffect(() => {
		fetchHistory();
	}, [fetchHistory]);

	// Filter workflows based on search (client-side since API doesn't support search)
	const filteredWorkflows = React.useMemo(() => {
		if (!search.trim()) return workflows;

		return workflows.filter(
			(workflow) =>
				workflow.userPrompt
					?.toLowerCase()
					.includes(search.toLowerCase()) ||
				workflow.status?.toLowerCase().includes(search.toLowerCase())
		);
	}, [workflows, search]);

	const columns: ColumnDef<HistoryItem>[] = [
		{
			accessorKey: "userPrompt",
			header: () => (
				<div className="text-gray-400 font-semibold flex items-center gap-2 min-w-24">
					<Clock className="size-4" />
					<span>Workflow</span>
				</div>
			),
			cell: ({ row }) => (
				<div className="max-w-[300px]">
					<span className="text-sm text-gray-300 truncate block">
						{row.original.userPrompt || "Untitled workflow"}
					</span>
				</div>
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
					{formatLastUpdated(row.original.updatedAt)}
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
			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<div className="mb-6">
					<h1 className="text-2xl font-semibold mb-4">History</h1>

					<div className="flex items-center justify-between">
						{/* Filter Dropdown - Left Side */}
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
									{[
										"completed",
										"stopped",
										"waiting_response",
										"failed",
										"in_progress",
										"pending",
									].map((status: string) => (
										<DropdownMenuCheckboxItem
											key={status}
											checked={statusFilter.includes(
												status
											)}
											onCheckedChange={(
												checked: boolean
											) => {
												handleStatusFilterChange(
													status,
													checked
												);
											}}
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

						{/* Search - Right Side */}
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

				{/* Active Filters */}
				{hasActiveFilters && (
					<div className="mb-4 text-sm text-gray-400">
						Filters applied:{" "}
						{statusFilter
							.map((s: string) =>
								s
									.replace("_", " ")
									.replace(/\b\w/g, (l) => l.toUpperCase())
							)
							.join(", ")}
					</div>
				)}

				{/* Table */}
				<div className="space-y-4">
					<DataTable
						table={table}
						columns={columns}
						isLoading={loading}
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
