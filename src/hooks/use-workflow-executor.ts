import { useCallback } from "react";
import { workflowExecutor } from "@/utils/workflow-executor";
import { useExecutionStatusStore, useUIStore } from "@/stores";
import { WorkflowExecutionPayload, AgentDetail } from "@/types";
import { STATUS } from "@/config/constants";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";

export function useWorkflowExecutor() {
	const { updateExecutionStatus } = useExecutionStatusStore();
	const { updateTestStatus } = useUIStore();

	const executeWorkflow = useCallback(
		async (
			payload: WorkflowExecutionPayload,
			skyBrowser: SkyMainBrowser,
			web3Context: Web3Context,
			onStatusUpdate?: (data: any) => void
		) => {
			try {
				updateExecutionStatus({ isRunning: true });
				updateTestStatus({
					isRunning: true,
					status: STATUS.PROCESSING,
				});

				const requestId = await workflowExecutor.executeWorkflow(
					payload,
					skyBrowser,
					web3Context,
					(statusData) => {
						console.log("📡 Workflow status update:", statusData);

						if (
							statusData.workflowStatus === "completed" ||
							statusData.workflowStatus === "failed"
						) {
							updateExecutionStatus({ isRunning: false });
							updateTestStatus({
								isRunning: false,
								status:
									statusData.workflowStatus === "completed"
										? STATUS.TEST_COMPLETED
										: STATUS.FAILED,
							});
						}

						if (statusData.workflowStatus === "in_progress") {
							updateExecutionStatus({
								currentSubnet: statusData.currentSubnet,
							});
						}

						if (onStatusUpdate) {
							onStatusUpdate(statusData);
						}
					}
				);

				updateExecutionStatus({ responseId: requestId });
				return requestId;
			} catch (error: unknown) {
				updateExecutionStatus({ isRunning: false });
				updateTestStatus({ isRunning: false, status: STATUS.FAILED });
				throw error;
			}
		},
		[updateExecutionStatus, updateTestStatus]
	);

	const executeAgentWorkflow = useCallback(
		async (
			agentDetail: AgentDetail,
			userPrompt: string,
			userAddress: string,
			skyBrowser: SkyMainBrowser,
			web3Context: Web3Context,
			onStatusUpdate?: (data: any) => void
		) => {
			try {
				updateExecutionStatus({ isRunning: true });
				updateTestStatus({
					isRunning: true,
					status: STATUS.PROCESSING,
				});

				const requestId = await workflowExecutor.executeAgentWorkflow(
					agentDetail,
					userPrompt,
					userAddress,
					skyBrowser,
					web3Context,
					(statusData) => {
						console.log(
							"📡 Agent workflow status update:",
							statusData
						);

						if (
							statusData.workflowStatus === "completed" ||
							statusData.workflowStatus === "failed"
						) {
							updateExecutionStatus({ isRunning: false });
							updateTestStatus({
								isRunning: false,
								status:
									statusData.workflowStatus === "completed"
										? STATUS.TEST_COMPLETED
										: STATUS.FAILED,
							});
						}

						if (statusData.workflowStatus === "in_progress") {
							updateExecutionStatus({
								currentSubnet: statusData.currentSubnet,
							});
						}

						if (onStatusUpdate) {
							onStatusUpdate(statusData);
						}
					}
				);

				updateExecutionStatus({ responseId: requestId });
				return requestId;
			} catch (error: unknown) {
				updateExecutionStatus({ isRunning: false });
				updateTestStatus({ isRunning: false, status: STATUS.FAILED });
				throw error;
			}
		},
		[updateExecutionStatus, updateTestStatus]
	);

	return { executeWorkflow, executeAgentWorkflow };
}
