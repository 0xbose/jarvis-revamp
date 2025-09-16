"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Calendar,
	Clock,
	RefreshCw,
	Check,
	ChevronLeft,
	ChevronRight,
	Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "../ui/label";

export interface ScheduleConfig {
	type?: "one-time" | "recurring";
	scheduleType?: "minutes" | "hours" | "daily" | "weekly" | "monthly";
	interval?: number;
	hour: number;
	minute: number;
	selectedDate?: Date;
	selectedDays?: string[];
	dayOfMonth?: number;
}

interface ScheduleInterfaceProps {
	onScheduleChange: (config: ScheduleConfig) => void;
	onGeneratedPromptChange: (prompt: string) => void;
	initialConfig?: Partial<ScheduleConfig>;
	isDisabled?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => {
	const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
	const period = i < 12 ? "AM" : "PM";
	return { value: i, label: `${hour}:00 ${period}` };
});

const MINUTES = Array.from({ length: 60 }, (_, i) => ({
	value: i,
	label: i.toString().padStart(2, "0"),
}));

const DAYS = [
	{ value: "Mon", label: "Mon" },
	{ value: "Tue", label: "Tue" },
	{ value: "Wed", label: "Wed" },
	{ value: "Thu", label: "Thu" },
	{ value: "Fri", label: "Fri" },
	{ value: "Sat", label: "Sat" },
	{ value: "Sun", label: "Sun" },
];

const INTERVAL_OPTIONS = {
	minutes: [5, 10, 15, 30, 45, 60],
	hours: [1, 2, 3, 6, 12, 24],
};

const DAY_OF_MONTH_OPTIONS = Array.from({ length: 31 }, (_, i) => {
	const day = i + 1;
	const suffix =
		day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th";
	return { value: day, label: `${day}${suffix}` };
});

function getDefaultFutureDate() {
	const now = new Date();
	const future = new Date(now.getTime() + 6 * 60 * 60 * 1000);
	const minutes = future.getMinutes();
	const roundedMinutes = Math.ceil(minutes / 5) * 5;
	if (roundedMinutes === 60) {
		future.setHours(future.getHours() + 1);
		future.setMinutes(0);
	} else {
		future.setMinutes(roundedMinutes);
	}
	future.setSeconds(0, 0);
	return future;
}

export default function ScheduleInterface({
	onScheduleChange,
	onGeneratedPromptChange,
	initialConfig,
	isDisabled,
}: ScheduleInterfaceProps) {
	const getInitialConfig = () => {
		const defaultDate = getDefaultFutureDate();
		return {
			type: undefined,
			hour: defaultDate.getHours(),
			minute: defaultDate.getMinutes(),
			selectedDate: new Date(
				defaultDate.getFullYear(),
				defaultDate.getMonth(),
				defaultDate.getDate()
			),
			selectedDays: [],
			dayOfMonth: 1,
		};
	};

	const [config, setConfig] = useState<ScheduleConfig>(
		() =>
			({
				...getInitialConfig(),
				...(initialConfig || {}),
			} as ScheduleConfig)
	);

	const [showDatePicker, setShowDatePicker] = useState(false);

	useEffect(() => {
		if (!initialConfig) return;
		setConfig((prev) => ({ ...prev, ...initialConfig } as ScheduleConfig));
	}, [initialConfig]);

	useEffect(() => {
		onScheduleChange(config);
		onGeneratedPromptChange(generateSchedulePrompt(config));
	}, [config]);

	const handleTypeChange = (type: "one-time" | "recurring") => {
		if (isDisabled) return;
		if (type === "one-time") {
			const defaultDate = getDefaultFutureDate();
			updateConfig({
				type: "one-time",
				hour: defaultDate.getHours(),
				minute: defaultDate.getMinutes(),
				selectedDate: new Date(
					defaultDate.getFullYear(),
					defaultDate.getMonth(),
					defaultDate.getDate()
				),
			});
		} else {
			updateConfig({ type: "recurring", scheduleType: "daily" });
		}
	};

	const updateConfig = (updates: Partial<ScheduleConfig>) => {
		if (isDisabled) return;
		setConfig((prev) => ({ ...prev, ...updates }));
	};

	const generateSchedulePrompt = (c: ScheduleConfig): string => {
		if (!c.type) return "";
		if (c.type === "one-time") {
			const baseDate = c.selectedDate || new Date();
			const localDateTime = new Date(baseDate);
			localDateTime.setHours(c.hour, c.minute, 0, 0);
			const utcYear = localDateTime.getUTCFullYear();
			const utcMonth = localDateTime.getUTCMonth();
			const utcDay = localDateTime.getUTCDate();
			const utcHour = localDateTime
				.getUTCHours()
				.toString()
				.padStart(2, "0");
			const utcMinute = localDateTime
				.getUTCMinutes()
				.toString()
				.padStart(2, "0");
			const utcDateStr = new Date(
				Date.UTC(utcYear, utcMonth, utcDay)
			).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
				timeZone: "UTC",
			});
			return `Schedule this task once on ${utcDateStr} at ${utcHour}:${utcMinute} UTC`;
		}
		switch (c.scheduleType) {
			case "minutes":
				return `Schedule this task every ${c.interval} minutes`;
			case "hours":
				return `Schedule this task every ${c.interval} hour${
					c.interval !== 1 ? "s" : ""
				}`;
			case "daily": {
				const localRef = new Date();
				localRef.setHours(c.hour, c.minute, 0, 0);
				const hh = localRef.getUTCHours().toString().padStart(2, "0");
				const mm = localRef.getUTCMinutes().toString().padStart(2, "0");
				return `Schedule this task daily at ${hh}:${mm} UTC`;
			}
			case "weekly": {
				const days = c.selectedDays?.join(", ") || "selected days";
				const localRef = new Date();
				localRef.setHours(c.hour, c.minute, 0, 0);
				const hh = localRef.getUTCHours().toString().padStart(2, "0");
				const mm = localRef.getUTCMinutes().toString().padStart(2, "0");
				return `Schedule this task weekly on ${days} at ${hh}:${mm} UTC`;
			}
			case "monthly": {
				const localRef = new Date();
				localRef.setHours(c.hour, c.minute, 0, 0);
				const monthlyTime = `${localRef
					.getUTCHours()
					.toString()
					.padStart(2, "0")}:${localRef
					.getUTCMinutes()
					.toString()
					.padStart(2, "0")} UTC`;
				const dayOfMonth =
					DAY_OF_MONTH_OPTIONS.find((d) => d.value === c.dayOfMonth)
						?.label || "1st";
				return `Schedule this task monthly on the ${dayOfMonth} at ${monthlyTime}`;
			}
			default:
				return "Schedule this task as scheduled";
		}
	};

	const isDateInPast = useMemo(() => {
		if (config.type !== "one-time" || !config.selectedDate) return false;
		const now = new Date();
		const selectedDateTime = new Date(config.selectedDate);
		selectedDateTime.setHours(config.hour, config.minute, 0, 0);
		return selectedDateTime < now;
	}, [config.selectedDate, config.hour, config.minute, config.type]);

	const formatSelectedDate = () => {
		if (!config.selectedDate) return "Select date";
		const date = config.selectedDate;
		const time =
			HOURS.find((h) => h.value === config.hour)?.label || "9:00 AM";
		return `${date.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		})}, ${time}`;
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-y-0.5">
				<h5 className="text-base font-medium text-foreground">
					Schedule
				</h5>
				<span className="text-muted-foreground">
					When should your agent run?
				</span>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<button
					onClick={() => handleTypeChange("one-time")}
					className={cn(
						"flex items-center gap-3 p-6 rounded-lg border text-left group transition-all duration-200",
						config.type === "one-time"
							? "border-green-500/80 bg-green-100/10"
							: "border-border/50 hover:border-green-500/70 bg-card/20"
					)}
					disabled={!!isDisabled}
				>
					<Calendar
						className={`h-5 w-5 group-hover:text-green-500/70 ${
							config.type === "one-time"
								? "text-green-600"
								: "text-muted-foreground"
						}`}
					/>
					<div className="flex-1">
						<div className="font-medium text-foreground">
							One Time
						</div>
						<div className="text-sm text-muted-foreground">
							Run only
						</div>
					</div>
					{config.type === "one-time" && (
						<Check className="h-5 w-5 text-green-600" />
					)}
				</button>

				<button
					onClick={() => handleTypeChange("recurring")}
					className={cn(
						"flex items-center gap-3 p-6 rounded-lg border text-left group transition-all duration-200",
						config.type === "recurring"
							? "border-green-500/80 bg-green-100/10"
							: "border-border/50 hover:border-green-500/70 bg-card/20"
					)}
					disabled={!!isDisabled}
				>
					<RefreshCw
						className={`h-5 w-5 group-hover:text-green-500/70 ${
							config.type === "recurring"
								? "text-green-600"
								: "text-muted-foreground"
						}`}
					/>
					<div className="flex-1">
						<div className="font-medium text-foreground">
							Recurring
						</div>
						<div className="text-sm text-muted-foreground">
							Repeat automatically
						</div>
					</div>
					{config.type === "recurring" && (
						<Check className="h-5 w-5 text-green-600" />
					)}
				</button>
			</div>

			{/* One Time Configuration */}
			{config.type === "one-time" && (
				<div className="space-y-4">
					<h5 className="font-medium text-foreground">
						Custom date & time
					</h5>

					<Dialog
						open={isDisabled ? false : showDatePicker}
						onOpenChange={isDisabled ? () => {} : setShowDatePicker}
					>
						<DialogTrigger asChild>
							<Button
								variant="outline"
								className="w-full h-12 justify-between bg-card/50 border-border/50 hover:bg-card/30"
								disabled={!!isDisabled}
							>
								<div className="flex items-center gap-2">
									<Calendar className="h-4 w-4" />
									<span className="text-foreground">
										{formatSelectedDate()}
									</span>
								</div>
								<span className="text-muted-foreground text-sm">
									Change
								</span>
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-md">
							<DialogHeader>
								<DialogTitle>Select Date & Time</DialogTitle>
							</DialogHeader>
							<DateTimePicker
								selectedDate={config.selectedDate || new Date()}
								selectedHour={config.hour}
								selectedMinute={config.minute}
								onDateTimeChange={(date, hour, minute) => {
									const now = new Date();
									const selectedDateTime = new Date(date);
									selectedDateTime.setHours(
										hour,
										minute,
										0,
										0
									);
									if (selectedDateTime < now) {
										return;
									}
									updateConfig({
										selectedDate: date,
										hour,
										minute,
									});
									setShowDatePicker(false);
								}}
							/>
						</DialogContent>
					</Dialog>
				</div>
			)}

			{config.type === "recurring" && (
				<div className="space-y-6">
					<div>
						<h5 className="font-medium mb-4 text-foreground">
							Choose Schedule Type
						</h5>
						<div className="grid grid-cols-2 gap-4">
							{[
								{
									key: "minutes",
									icon: Clock,
									title: "Every Few Minutes",
									desc: "Run every X minutes",
								},
								{
									key: "hours",
									icon: Clock,
									title: "Every Few Hours",
									desc: "Run every X hours",
								},
								{
									key: "daily",
									icon: Calendar,
									title: "Daily",
									desc: "Run once per day",
								},
								{
									key: "weekly",
									icon: RefreshCw,
									title: "Weekly",
									desc: "Run on specific days",
								},
							].map(({ key, icon: Icon, title, desc }) => (
								<button
									key={key}
									onClick={() =>
										!isDisabled &&
										updateConfig({
											scheduleType: key as any,
										})
									}
									className={cn(
										"flex items-center gap-3 p-4 rounded-lg border text-left transition-all duration-200",
										config.scheduleType === key
											? "border-green-500/80 bg-green-100/10"
											: "border-border/50 hover:border-green-500/70 bg-card/20"
									)}
									disabled={!!isDisabled}
								>
									<Icon className="h-5 w-5 text-muted-foreground" />
									<div className="flex-1">
										<div className="font-medium text-foreground">
											{title}
										</div>
										<div className="text-sm text-muted-foreground">
											{desc}
										</div>
									</div>
									{config.scheduleType === key && (
										<Check className="h-5 w-5 text-green-600" />
									)}
								</button>
							))}

							<button
								onClick={() =>
									!isDisabled &&
									updateConfig({ scheduleType: "monthly" })
								}
								className={cn(
									"flex items-center gap-3 p-4 rounded-lg border text-left transition-all duration-200 col-span-2",
									config.scheduleType === "monthly"
										? "border-green-500/80 bg-green-100/10"
										: "border-border/50 hover:border-green-500/70 bg-card/20"
								)}
								disabled={!!isDisabled}
							>
								<Calendar className="h-5 w-5 text-muted-foreground" />
								<div className="flex-1">
									<div className="font-medium text-foreground">
										Monthly
									</div>
									<div className="text-sm text-muted-foreground">
										Run on a specific day of the month
									</div>
								</div>
								{config.scheduleType === "monthly" && (
									<Check className="h-5 w-5 text-green-600" />
								)}
							</button>
						</div>
					</div>

					{(config.scheduleType === "minutes" ||
						config.scheduleType === "hours") && (
						<div>
							<label className="block text-sm font-medium mb-2 text-foreground">
								Interval
							</label>
							<Select
								value={config.interval?.toString()}
								onValueChange={(value) =>
									!isDisabled &&
									updateConfig({
										interval: Number.parseInt(value),
									})
								}
							>
								<SelectTrigger
									className="bg-card border-border/50"
									disabled={!!isDisabled}
								>
									<SelectValue
										placeholder={`Select ${config.scheduleType}`}
									/>
								</SelectTrigger>
								<SelectContent>
									{INTERVAL_OPTIONS[config.scheduleType].map(
										(interval) => (
											<SelectItem
												key={interval}
												value={interval.toString()}
												className="focus:bg-green-500/30"
											>
												{interval}{" "}
												{config.scheduleType ===
												"minutes"
													? "minutes"
													: `hour${
															interval !== 1
																? "s"
																: ""
													  }`}
											</SelectItem>
										)
									)}
								</SelectContent>
							</Select>
						</div>
					)}

					{(config.scheduleType === "daily" ||
						config.scheduleType === "weekly" ||
						config.scheduleType === "monthly") && (
						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label className="block text-sm font-medium mb-2 text-foreground">
									Hour
								</Label>
								<Select
									value={config.hour.toString()}
									onValueChange={(value) =>
										!isDisabled &&
										updateConfig({
											hour: Number.parseInt(value),
										})
									}
								>
									<SelectTrigger
										className="bg-card border-border/50"
										disabled={!!isDisabled}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{HOURS.map((hour) => (
											<SelectItem
												key={hour.value}
												value={hour.value.toString()}
												className="focus:bg-green-500/30"
											>
												{hour.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<label className="block text-sm font-medium mb-2 text-foreground">
									Minute
								</label>
								<Select
									value={config.minute.toString()}
									onValueChange={(value) =>
										!isDisabled &&
										updateConfig({
											minute: Number.parseInt(value),
										})
									}
								>
									<SelectTrigger
										className="bg-card border-border/50"
										disabled={!!isDisabled}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{MINUTES.filter(
											(_, i) => i % 5 === 0
										).map((minute) => (
											<SelectItem
												key={minute.value}
												value={minute.value.toString()}
												className="focus:bg-green-500/30"
											>
												{minute.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					)}

					{config.scheduleType === "weekly" && (
						<div>
							<label className="block text-sm font-medium mb-2 text-foreground">
								Select Day
							</label>
							<div className="grid grid-cols-7 gap-2">
								{DAYS.map((day) => (
									<button
										key={day.value}
										onClick={() => {
											if (isDisabled) return;
											const selectedDays =
												config.selectedDays || [];
											const newDays =
												selectedDays.includes(day.value)
													? selectedDays.filter(
															(d) =>
																d !== day.value
													  )
													: [
															...selectedDays,
															day.value,
													  ];
											updateConfig({
												selectedDays: newDays,
											});
										}}
										className={cn(
											"p-3 text-sm rounded-lg border transition-all duration-200 font-medium",
											config.selectedDays?.includes(
												day.value
											)
												? "border-green-500/80 bg-green-100/10"
												: "border-border/50 hover:border-green-500/70 bg-card/20"
										)}
										disabled={!!isDisabled}
									>
										{day.label}
									</button>
								))}
							</div>
						</div>
					)}

					{config.scheduleType === "monthly" && (
						<div>
							<label className="block text-sm font-medium mb-2 text-foreground">
								Day of Month
							</label>
							<Select
								value={config.dayOfMonth?.toString()}
								onValueChange={(value) =>
									!isDisabled &&
									updateConfig({
										dayOfMonth: Number.parseInt(value),
									})
								}
							>
								<SelectTrigger
									className="bg-card border-border/50"
									disabled={!!isDisabled}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{DAY_OF_MONTH_OPTIONS.map((day) => (
										<SelectItem
											key={day.value}
											value={day.value.toString()}
											className="focus:bg-green-500/30"
										>
											{day.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
				</div>
			)}

			{isDateInPast && (
				<div className="p-3 rounded-md flex items-center gap-x-4 bg-amber-500/20">
					<Info className="size-5" />
					<span>
						The selected date and time is in the past. Please choose
						a future date and time.
					</span>
				</div>
			)}
		</div>
	);
}

function DateTimePicker({
	selectedDate,
	selectedHour,
	selectedMinute,
	onDateTimeChange,
}: {
	selectedDate: Date;
	selectedHour: number;
	selectedMinute: number;
	onDateTimeChange: (date: Date, hour: number, minute: number) => void;
}) {
	const [tempDate, setTempDate] = useState(selectedDate);
	const [tempHour, setTempHour] = useState(selectedHour);
	const [tempMinute, setTempMinute] = useState(selectedMinute);

	const currentDate = new Date();
	const currentMonth = tempDate.getMonth();
	const currentYear = tempDate.getFullYear();

	const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
	const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

	const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
	const emptyDays = Array.from({ length: firstDayOfMonth }, () => null);

	const monthNames = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];

	const isPast = (date: Date, hour: number, minute: number) => {
		const d = new Date(date);
		d.setHours(hour, minute, 0, 0);
		return d < new Date();
	};

	const isDayDisabled = (day: number) => {
		const today = new Date();
		const thisDay = new Date(currentYear, currentMonth, day);
		thisDay.setHours(23, 59, 59, 999);
		return (
			thisDay.getTime() < new Date(today.setHours(0, 0, 0, 0)).getTime()
		);
	};

	const isTodaySelected =
		tempDate.getFullYear() === currentDate.getFullYear() &&
		tempDate.getMonth() === currentDate.getMonth() &&
		tempDate.getDate() === currentDate.getDate();

	const availableHours = isTodaySelected
		? HOURS.filter(
				(h) =>
					h.value > currentDate.getHours() ||
					h.value === currentDate.getHours()
		  )
		: HOURS;

	const availableMinutes = (hour: number) => {
		if (!isTodaySelected) return MINUTES.filter((_, i) => i % 5 === 0);
		if (hour > currentDate.getHours())
			return MINUTES.filter((_, i) => i % 5 === 0);
		if (hour === currentDate.getHours()) {
			return MINUTES.filter(
				(m) =>
					m.value >= Math.ceil(currentDate.getMinutes() / 5) * 5 &&
					m.value % 5 === 0
			);
		}
		return [];
	};

	const safeTempHour =
		availableHours.find((h) => h.value === tempHour) !== undefined
			? tempHour
			: availableHours.length > 0
			? availableHours[0].value
			: tempHour;

	const safeTempMinute =
		availableMinutes(safeTempHour).find((m) => m.value === tempMinute) !==
		undefined
			? tempMinute
			: availableMinutes(safeTempHour).length > 0
			? availableMinutes(safeTempHour)[0].value
			: tempMinute;

	const confirmDisabled = isPast(tempDate, safeTempHour, safeTempMinute);

	return (
		<div className="space-y-4">
			{/* Calendar */}
			<div>
				<div className="flex items-center justify-between mb-4">
					<button
						onClick={() =>
							setTempDate(
								new Date(currentYear, currentMonth - 1, 1)
							)
						}
						className="p-2 hover:bg-muted rounded-lg transition-colors"
						aria-label="Previous month"
					>
						<ChevronLeft className="h-4 w-4" />
					</button>
					<h3 className="font-medium text-foreground">
						{monthNames[currentMonth]} {currentYear}
					</h3>
					<button
						onClick={() =>
							setTempDate(
								new Date(currentYear, currentMonth + 1, 1)
							)
						}
						className="p-2 hover:bg-muted rounded-lg transition-colors"
						aria-label="Next month"
					>
						<ChevronRight className="h-4 w-4" />
					</button>
				</div>

				<div className="grid grid-cols-7 gap-1 text-center text-sm">
					{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
						<div
							key={day}
							className="p-2 text-muted-foreground font-medium"
						>
							{day}
						</div>
					))}

					{emptyDays.map((_, i) => (
						<div key={`empty-${i}`} className="p-2" />
					))}

					{days.map((day) => {
						const isSelected = day === tempDate.getDate();
						const isToday =
							day === currentDate.getDate() &&
							currentMonth === currentDate.getMonth() &&
							currentYear === currentDate.getFullYear();

						const disabled = isDayDisabled(day);

						return (
							<button
								key={day}
								onClick={() =>
									!disabled &&
									setTempDate(
										new Date(currentYear, currentMonth, day)
									)
								}
								className={cn(
									"w-full p-2 rounded-lg text-sm transition-colors font-medium",
									isSelected && "bg-green-500/30 text-white",
									isToday && !isSelected && "bg-muted",
									!isSelected && !isToday && "hover:bg-muted",
									disabled && "opacity-40 cursor-not-allowed"
								)}
								disabled={disabled}
								aria-disabled={disabled}
							>
								{day}
							</button>
						);
					})}
				</div>
			</div>

			{/* Time Selection */}
			<div className="flex gap-4">
				<div className="flex-1">
					<label className="block text-sm font-medium mb-2 text-foreground">
						Hour
					</label>
					<div className="max-h-32 overflow-y-auto border rounded-lg scrollbar-hide">
						{availableHours.map((hour) => (
							<button
								key={hour.value}
								onClick={() => setTempHour(hour.value)}
								className={cn(
									"w-full p-2 text-left text-sm hover:bg-muted transition-colors",
									safeTempHour === hour.value &&
										"bg-green-500/20 dark:bg-green-950/50 text-green-700 dark:text-green-300"
								)}
							>
								{hour.label}
							</button>
						))}
					</div>
				</div>

				<div className="flex-1">
					<label className="block text-sm font-medium mb-2 text-foreground">
						Minute
					</label>
					<div className="max-h-32 overflow-y-auto border rounded-lg scrollbar-hide">
						{availableMinutes(safeTempHour).map((minute) => (
							<button
								key={minute.value}
								onClick={() => setTempMinute(minute.value)}
								className={cn(
									"w-full p-2 text-left text-sm hover:bg-muted transition-colors",
									safeTempMinute === minute.value &&
										"bg-green-500/20 dark:bg-green-950/50 text-green-700 dark:text-green-300"
								)}
							>
								{minute.label}
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="flex gap-3 pt-4">
				<Button
					variant="outline"
					className="flex-1 border-0 bg-muted/50"
					onClick={() =>
						onDateTimeChange(
							selectedDate,
							selectedHour,
							selectedMinute
						)
					}
				>
					Cancel
				</Button>
				<Button
					className="flex-1 bg-green-600/80 hover:bg-green-700/80"
					onClick={() =>
						onDateTimeChange(tempDate, safeTempHour, safeTempMinute)
					}
					disabled={confirmDisabled}
					aria-disabled={confirmDisabled}
				>
					Confirm
				</Button>
			</div>
			{confirmDisabled && (
				<div className="text-sm text-amber-600 mt-2">
					You cannot select a past date and time.
				</div>
			)}
		</div>
	);
}
