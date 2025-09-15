
// Scheduled Task Types
export interface ScheduledTask {
	taskId: string;
	originalPrompt: string;
	scheduledTime: string;
	status:
		| "pending"
		| "scheduled"
		| "running"
		| "completed"
		| "failed"
		| "cancelled";
	taskType: "one_time" | "recurring";
	isRecurring: boolean;
	recurrenceType?: "daily" | "weekly" | "monthly" | "custom";
	recurrenceInterval?: number;
	createdAt?: string;
	updatedAt?: string;
	nextExecution?: string;
	lastExecution?: string;
	executionCount?: number;
	maxExecutions?: number;
}

export interface ScheduledTasksResponse {
	success: boolean;
	data: {
		tasks: ScheduledTask[];
		totalTasks: number;
		pagination?: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	};
	message: string;
}