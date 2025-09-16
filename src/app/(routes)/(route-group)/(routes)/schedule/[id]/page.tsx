"use client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { fetchTaskDetails } from "@/controllers/schedule/schedule.query";
import { useWallet } from "@/hooks/use-wallet";
import { QUERY_KEYS } from "@/utils/query-keys";
import ScheduleInterface, {
	type ScheduleConfig as UIScheduleConfig,
} from "@/components/schedule/schedule-interface";
import { Textarea } from "@/components/ui/textarea";

type ScheduleConfig = UIScheduleConfig;

function ScheduleDetailInner() {
	const { skyBrowser, address } = useWallet();
	const params = useParams<{ id: string }>();
	const taskId = params.id;

	const { data, isLoading } = useQuery({
		queryKey: [QUERY_KEYS.TASK_DETAILS, taskId, skyBrowser, address],
		queryFn: () =>
			fetchTaskDetails({ taskId, skyBrowser, web3Context: { address } }),
		enabled: !!address && !!skyBrowser,
	});

	const task =
		(data as any)?.data?.task ||
		(data as any)?.task ||
		(data as any)?.data ||
		data ||
		{};

	const initialPrompt = useMemo(
		() => (task?.workflow?.prompt as string) || task?.originalPrompt || "",
		[task]
	);

	const [userPrompt, setUserPrompt] = useState<string>(initialPrompt);

	useEffect(() => {
		setUserPrompt(initialPrompt);
	}, [initialPrompt]);

	const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
	const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(
		null
	);

	const isReadOnly = useMemo(
		() => Boolean(task?.taskId || task?.scheduledTime),
		[task]
	);

	const initialConfig: Partial<ScheduleConfig> | undefined = useMemo(() => {
		if (!task) return undefined;

		const parseDateParts = (iso?: string) => {
			if (!iso) return undefined;
			const d = new Date(iso);
			if (Number.isNaN(d.getTime())) return undefined;
			const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
			// Round only the minutes to the nearest 5 without changing hour/day
			const rawMinute = d.getMinutes();
			let roundedMinute = Math.round(rawMinute / 5) * 5;
			if (roundedMinute === 60) {
				// Do not carry over to the next hour; clamp to 55
				roundedMinute = 55;
			}
			return {
				dateOnly: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
				hour: d.getHours(),
				minute: roundedMinute,
				dayOfMonth: d.getDate(),
				weekday: weekDays[d.getDay()],
			};
		};

		const isRecurring = Boolean(task?.isRecurring);
		const recurrenceType = task?.recurrenceType as
			| "minutes"
			| "hours"
			| "daily"
			| "weekly"
			| "monthly"
			| undefined;

		const parts = parseDateParts(
			task?.scheduledTime || task?.nextExecution
		);

		if (!isRecurring) {
			if (!parts) return undefined;
			return {
				type: "one-time",
				selectedDate: parts.dateOnly,
				hour: parts.hour ?? 9,
				minute: parts.minute ?? 0,
			} as Partial<ScheduleConfig>;
		}

		const weeklyDays: string[] =
			task?.recurrenceDays || task?.days || task?.selectedDays || [];

		const baseRecurring: Partial<ScheduleConfig> = {
			type: "recurring",
			scheduleType: recurrenceType as any,
			hour: parts?.hour ?? 9,
			minute: parts?.minute ?? 0,
		};

		if (recurrenceType === "minutes" || recurrenceType === "hours") {
			return {
				...baseRecurring,
				scheduleType: recurrenceType,
				interval: Number(task?.recurrenceInterval) || 1,
			};
		}

		if (recurrenceType === "weekly") {
			return {
				...baseRecurring,
				scheduleType: "weekly",
				selectedDays:
					Array.isArray(weeklyDays) && weeklyDays.length > 0
						? weeklyDays
						: parts?.weekday
						? [parts.weekday]
						: [],
			};
		}

		if (recurrenceType === "monthly") {
			return {
				...baseRecurring,
				scheduleType: "monthly",
				dayOfMonth: Number(task?.dayOfMonth) || parts?.dayOfMonth || 1,
			};
		}

		// default daily
		return {
			...baseRecurring,
			scheduleType: "daily",
		};
	}, [task]);

	return (
		<div className="p-6">
			<h1 className="text-xl font-semibold mb-4">Scheduled Task</h1>
			<div className="space-y-6">
				<div className="space-y-2">
					<h4 className="text-lg font-semibold text-foreground">
						Instructions
					</h4>
					<Textarea
						placeholder="Describe what this agent should do..."
						value={userPrompt}
						onChange={(e) => setUserPrompt(e.target.value)}
						rows={6}
						className="resize-none border border-border/80 bg-background focus:border-green-500 focus:ring-0 focus:ring-none text-base"
						readOnly={isReadOnly}
						disabled={isReadOnly}
					/>
				</div>

				<ScheduleInterface
					initialConfig={initialConfig}
					onScheduleChange={(config) => setScheduleConfig(config)}
					onGeneratedPromptChange={(prompt) =>
						setGeneratedPrompt(prompt)
					}
					isDisabled={isReadOnly}
				/>

				{!isLoading && !task && (
					<div className="text-sm text-red-500 mt-2">
						Failed to load task details
					</div>
				)}
			</div>
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
