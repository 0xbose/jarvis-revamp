import { getAxiosInstanceWithApiKey } from "@/lib/axios";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/skynet";

// Fetches all scheduled tasks for the API key
export const fetchScheduledTasks = async ({
	skyBrowser,
	web3Context,
}: {
	skyBrowser?: SkyMainBrowser;
	web3Context?: Web3Context;
}) => {
	const baseUrl = `${process.env.NEXT_PUBLIC_TASK_SCHEDULER_ACCESSPOINT_URL}`;
	const axiosInstance = await getAxiosInstanceWithApiKey(
		baseUrl,
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.get(`${baseUrl}/api/tasks`);
	return response.data;
};

// Fetches detailed information for a specific scheduled task by taskId
export const fetchTaskDetails = async ({
	taskId,
	skyBrowser,
	web3Context,
}: {
	taskId: string;
	skyBrowser?: SkyMainBrowser;
	web3Context?: Web3Context;
}) => {
	const baseUrl = `${process.env.NEXT_PUBLIC_TASK_SCHEDULER_ACCESSPOINT_URL}`;
	const axiosInstance = await getAxiosInstanceWithApiKey(
		baseUrl,
		skyBrowser,
		web3Context
	);
	const response = await axiosInstance.post(`${baseUrl}/api/task`, {
		taskId,
	});
	return response.data;
};
