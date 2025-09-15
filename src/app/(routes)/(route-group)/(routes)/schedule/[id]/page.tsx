"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import React, { Suspense } from "react";
import { fetchTaskDetails } from "@/controllers/schedule/schedule.query";
import { useWallet } from "@/hooks/use-wallet";
import { QUERY_KEYS } from "@/utils/query-keys";

function ScheduleDetailInner() {
	const { skyBrowser, address } = useWallet();
	const params = useParams<{ id: string }>();
	const taskId = params.id;

	const { data } = useSuspenseQuery({
		queryKey: [QUERY_KEYS.TASK_DETAILS, taskId],
		queryFn: () =>
			fetchTaskDetails({ taskId, skyBrowser, web3Context: { address } }),
	});

	return (
		<div className="p-6">
			<h1 className="text-xl font-semibold mb-4">
				Scheduled Task Details
			</h1>
			<pre className="text-sm bg-muted p-4 rounded-md overflow-auto">
				{JSON.stringify(data, null, 2)}
			</pre>
		</div>
	);
}
export default function ScheduleDetailPage() {
	return (
		<Suspense
			fallback={
				<div className="p-6 text-gray-400">
					Loading scheduled tasks...
				</div>
			}
		>
			<ScheduleDetailInner />
		</Suspense>
	);
}
