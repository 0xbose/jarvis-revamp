import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import { AgentPayload } from "@/types/schedule";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/skynet";

export const scheduleWorkflowWithPrompt = async ({
	prompt,
	agentPayload,
	skyBrowser,
	web3Context,
}: {
	prompt: string;
	agentPayload: AgentPayload;
	skyBrowser?: SkyMainBrowser;
	web3Context?: Web3Context;
}) => {
	const baseUrl = `${process.env.NEXT_PUBLIC_TASK_SCHEDULER_ACCESSPOINT_URL}`;
	const axiosInstance = await getAxiosInstanceWithApiKey(
		baseUrl,
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.post(`${baseUrl}/natural-request`, {
		prompt,
		agentPayload,
	});
	return response.data;
};

export const promptExamples = [
	// Simple one-time scheduling
	"Schedule this workflow in 30 seconds",
	"Run this workflow next Friday at 2 PM",
	"Execute this workflow on Wednesday at 11 AM",
	"Start this workflow at 9 AM tomorrow",

	// Daily recurring
	"Run this workflow every day at 2 PM starting tomorrow",
	"Execute this workflow daily at 8 AM",
	"Schedule this workflow to run every morning at 9 AM",
	"Run this workflow every evening at 6 PM",

	// Weekly recurring
	"Schedule this workflow every Monday at 10 AM",
	"Run this workflow every Friday at 3 PM",
	"Execute this workflow weekly on Tuesday at 2 PM",
	"Schedule this workflow every weekend at 11 AM",

	// Custom intervals
	"Run this workflow every 3 days at 2 PM and 8 PM",
	"Execute this workflow every 2 hours starting now",
	"Schedule this workflow every 6 hours during business hours",
	"Run this workflow every 4 days at 9 AM and 5 PM",
];
