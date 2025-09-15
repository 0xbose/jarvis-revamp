"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	type ColumnDef,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	Clock,
	CheckCircle,
	TimerIcon,
	Calendar,
	Repeat,
	Play,
	Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchScheduledTasks } from "@/controllers/schedule/schedule.query";
import { useWallet } from "@/hooks/use-wallet";
import { ScheduledTask } from "@/types/schedule";
import DataTable from "@/components/table/DataTable";
import DataPagination from "@/components/common/pagination";
import SearchBar from "@/components/common/search";
import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { QUERY_KEYS } from "@/utils/query-keys";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Helper functions
function getStatusBadge(status: string) {
	const statusConfig = {
		scheduled: {
			variant: "secondary",
			className: "bg-blue-500/20 text-blue-400",
			label: "Scheduled",
		},
		executing: {
			variant: "secondary",
			className: "bg-green-500/20 text-green-400",
			label: "Executing",
		},
		completed: {
			variant: "secondary",
			className: "bg-green-500/20 text-green-400",
			label: "Completed",
		},
		failed: {
			variant: "destructive",
			className: "bg-red-500/20 text-red-400",
			label: "Failed",
		},
	};

	const config =
		statusConfig[status as keyof typeof statusConfig] ||
		statusConfig.failed;
	return (
		<Badge variant={config.variant as any} className={config.className}>
			{config.label}
		</Badge>
	);
}

function getTaskTypeBadge(taskType: string, isRecurring: boolean) {
	if (isRecurring) {
		return (
			<Badge
				variant="outline"
				className="bg-purple-500/20 text-purple-400 border-purple-500/30"
			>
				<Repeat className="w-3 h-3 mr-1" />
				Recurring
			</Badge>
		);
	}
	return (
		<Badge
			variant="outline"
			className="bg-blue-500/20 text-blue-400 border-blue-500/30"
		>
			<Play className="w-3 h-3 mr-1" />
			One-time
		</Badge>
	);
}

function formatDateTime(dateString: string) {
	return new Date(dateString).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

function formatTimeUntil(dateString: string) {
	const now = new Date();
	const scheduled = new Date(dateString);
	const diffMs = scheduled.getTime() - now.getTime();

	if (diffMs < 0) return null;

	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMinutes < 1) return "Now";
	if (diffMinutes === 1) return "1 minute";
	if (diffMinutes < 60) return `${diffMinutes} minutes`;
	if (diffHours === 1) return "1 hour";
	if (diffHours < 24) return `${diffHours} hours`;
	if (diffDays === 1) return "1 day";
	return `${diffDays} days`;
}

// Filters removed
function ScheduledTasksInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const currentPage = Number(searchParams.get("page") || "1");
	const searchTerm = searchParams.get("search") || "";
	const queryClient = useQueryClient();

	const [search, setSearch] = useState(searchTerm);

	const pageSize = 10;
	const { skyBrowser, address } = useWallet();

	const updateSearchParams = (updates: Record<string, string | null>) => {
		const newParams = new URLSearchParams(searchParams);
		Object.entries(updates).forEach(([key, value]) => {
			if (value) newParams.set(key, value);
			else newParams.delete(key);
		});
		router.push(`/schedule?${newParams.toString()}`);
	};

	const {
		data: scheduledTasksData,
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: [
			QUERY_KEYS.SCHEDULED_TASKS,
			address,
			skyBrowser,
			currentPage,
			pageSize,
		],
		queryFn: async () => {
			if (!skyBrowser || !address) {
				return { tasks: [], totalTasks: 0 };
			}
			const web3Context = { address };
			const response = await fetchScheduledTasks({
				skyBrowser,
				web3Context,
			});

			let tasks: ScheduledTask[] = [];
			let totalTasks = 0;

			if (response?.success && response?.data?.tasks) {
				tasks = response.data.tasks.map((task: any) => ({
					...task,
					id: task.taskId,
				}));
				totalTasks = response.data.totalTasks || tasks.length;
			}

			queryClient.invalidateQueries({
				queryKey: [QUERY_KEYS.HISTORY, address],
			});

			return {
				tasks,
				totalTasks,
			};
		},
		placeholderData: keepPreviousData,
		enabled: !!address && !!skyBrowser,
		gcTime: 1000 * 60 * 5, // 5 minutes
		staleTime: 1000 * 60 * 5, // 5 minutes
	});

	const tasks: ScheduledTask[] = Array.isArray(
		(scheduledTasksData as any)?.tasks
	)
		? (scheduledTasksData as any).tasks
		: [];

	const totalCount: number =
		(scheduledTasksData as any)?.totalTasks ?? tasks.length;

	const handleSearch = (value: string) => {
		setSearch(value);
		updateSearchParams({ search: value || null, page: "1" });
	};

	useEffect(() => {
		setSearch(searchTerm);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchTerm]);

	useEffect(() => {
		refetch();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [skyBrowser, address, currentPage, pageSize]);

	const filteredTasks = useMemo(() => {
		if (!search.trim()) return tasks;
		const lower = search.toLowerCase();
		return tasks.filter(
			(task) =>
				task.originalPrompt?.toLowerCase().includes(lower) ||
				task.status?.toLowerCase().includes(lower) ||
				task.taskType?.toLowerCase().includes(lower)
		);
	}, [tasks, search]);

	const columns: ColumnDef<ScheduledTask>[] = [
		{
			accessorKey: "originalPrompt",
			header: () => (
				<div className="text-gray-400 font-semibold flex items-center gap-2 w-[350px]">
					<Calendar className="size-4" />
					<span>Task</span>
				</div>
			),
			cell: ({ row }) => (
				<Link
					href={`/schedule/${row.original.taskId}`}
					className="text-sm text-gray-300 block text-left w-full max-w-[350px] overflow-hidden whitespace-nowrap text-ellipsis"
					title={row.original.originalPrompt || "Untitled task"}
				>
					{row.original.originalPrompt || "Untitled task"}
				</Link>
			),
		},
		{
			accessorKey: "taskType",
			header: () => (
				<div className="text-gray-400 font-semibold flex items-center gap-2 min-w-24">
					<Repeat className="size-4" />
					<span>Type</span>
				</div>
			),
			cell: ({ row }) =>
				getTaskTypeBadge(
					row.original.taskType,
					row.original.isRecurring
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
			accessorKey: "scheduledTime",
			header: () => (
				<div className="text-gray-400 font-semibold flex items-center gap-2 min-w-32">
					<TimerIcon className="size-4" />
					<span>Scheduled</span>
				</div>
			),
			cell: ({ row }) => (
				<div className="!text-sm text-gray-400 space-y-1">
					<div>{formatDateTime(row.original.scheduledTime)}</div>
					<div className="!text-xs text-gray-500 h-4">
						{formatTimeUntil(row.original.scheduledTime)}
					</div>
				</div>
			),
		},
		{
			accessorKey: "recurrence",
			header: () => (
				<div className="text-gray-400 font-semibold flex items-center gap-2 min-w-24">
					<Clock className="size-4" />
					<span>Recurrence</span>
				</div>
			),
			cell: ({ row }) => {
				if (!row.original.isRecurring) {
					return (
						<span className="text-sm text-gray-500">One-time</span>
					);
				}
				return (
					<div className="text-sm text-gray-500 capitalize">
						<div>{row.original.recurrenceType}</div>
						{/* {row.original.recurrenceInterval && (
							<div className="text-xs text-gray-500">
								Every {row.original.recurrenceInterval}
							</div>
						)} */}
					</div>
				);
			},
		},
	];

	const table = useReactTable({
		data: filteredTasks,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const effectiveTotal = search.trim() ? filteredTasks.length : totalCount;
	const maxPages = Math.ceil(effectiveTotal / pageSize);

	return (
		<div className="p-6">
			<div className="relative border-b border-border/40">
				<div className="flex flex-col lg:flex-row items-start justify-between gap-8">
					<div className="space-y-3 pb-4">
						<h1 className="text-3xl font-semibold text-foreground tracking-tight">
							Scheduled Tasks
						</h1>
						<p className="text-muted-foreground text-base max-w-2xl">
							View and manage your scheduled tasks.
						</p>
					</div>
				</div>
			</div>
			<div className="pt-6">
				<div className="mb-6 flex items-center justify-between">
					<div className="w-full flex items-center justify-between gap-x-4">
						<SearchBar
							value={search}
							onChange={setSearch}
							onSearch={handleSearch}
							className="w-64 bg-background rounded-md ml-0"
							placeholder="Search tasks..."
							debounceTime={300}
						/>
						<Button
							type="button"
							className="bg-green-500 hover:bg-green-500/90 text-black cursor-pointer"
							onClick={() => router.push("/schedule/create")}
						>
							<Plus className="size-4" />
							Schedule
						</Button>
					</div>
				</div>
				<div className="space-y-4">
					<DataTable
						table={table}
						columns={columns}
						isLoading={isLoading || isFetching}
					/>
					<DataPagination
						maxPages={maxPages}
						total={effectiveTotal}
						currentLocation="/schedule"
					/>
				</div>
			</div>
		</div>
	);
}

export default function ScheduledTasks() {
	return (
		<Suspense
			fallback={
				<div className="p-6 text-gray-400">
					Loading scheduled tasks...
				</div>
			}
		>
			<ScheduledTasksInner />
		</Suspense>
	);
}
