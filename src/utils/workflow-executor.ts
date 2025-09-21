import axios from "axios";
import { apiKeyManager } from "./api-key-manager";
import { WORKFLOW_ENDPOINTS } from "@/config/constants";
import {
	WorkflowExecutionPayload,
	WorkflowExecutionResponse,
	AgentDetail,
} from "@/types";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { Web3Context } from "@/types/wallet";

export class WorkflowExecutor {
	private static instance: WorkflowExecutor;
	private currentWorkflowId: string | null = null;
	private currentPollingInterval: NodeJS.Timeout | null = null;
	private currentStatusCallback:
		| ((data: WorkflowExecutionResponse) => void)
		| null = null;
	private pollingStartTime: number | null = null;
	private lastStatusChangeTime: number | null = null;
	private lastWorkflowStatus: string | null = null;
	private statusTimeoutId: NodeJS.Timeout | null = null;

	public static getInstance(): WorkflowExecutor {
		if (!WorkflowExecutor.instance) {
			WorkflowExecutor.instance = new WorkflowExecutor();
		}
		return WorkflowExecutor.instance;
	}

	/**
	 * Get the current workflow ID
	 */
	public getCurrentWorkflowId(): string | null {
		return this.currentWorkflowId;
	}

	/**
	 * Set the current workflow ID (useful for external state synchronization)
	 */
	public setCurrentWorkflowId(workflowId: string | null): void {
		this.currentWorkflowId = workflowId;
	}

	/**
	 * Set the current status callback
	 */
	public setCurrentStatusCallback(
		callback: ((data: WorkflowExecutionResponse) => void) | null
	): void {
		this.currentStatusCallback = callback;
	}

	/**
	 * Start polling for an existing workflow
	 */
	public async startPollingExistingWorkflow(
		workflowId: string,
		skyBrowser: SkyMainBrowser,
		web3Context: Web3Context,
		onStatusUpdate?: (data: WorkflowExecutionResponse) => void
	): Promise<boolean> {
		console.log(
			`🔧 WorkflowExecutor.startPollingExistingWorkflow called for: ${workflowId}`
		);

		// Check if we're already polling this workflow
		if (this.currentWorkflowId === workflowId && this.isPolling()) {
			console.warn(
				`⚠️ Already polling workflow ${workflowId}. Skipping duplicate polling.`
			);
			return true;
		}

		// Stop any existing polling before starting new one
		this.stopPolling();

		// Clear any existing state to prevent conflicts
		this.currentWorkflowId = null;
		this.currentStatusCallback = null;

		try {
			// Get API key
			console.log("🔑 Getting API key...");
			const apiKey = await apiKeyManager.getApiKey(
				skyBrowser,
				web3Context
			);

			if (!apiKey) {
				console.error("❌ Failed to get API key for polling");
				return false;
			}

			console.log("✅ API key obtained, starting polling...");

			// Start polling for the existing workflow
			this.startPolling(workflowId, apiKey, onStatusUpdate);

			console.log(
				`✅ Started polling for existing workflow: ${workflowId}`
			);
			return true;
		} catch (error) {
			console.error(
				"❌ Error starting polling for existing workflow:",
				error
			);
			// Ensure cleanup on error
			this.stopPolling();
			this.currentWorkflowId = null;
			this.currentStatusCallback = null;
			return false;
		}
	}

	/**
	 * Force stop polling for a specific workflow (useful when switching workflows)
	 */
	public forceStopPollingForWorkflow(workflowId: string): void {
		if (this.currentWorkflowId === workflowId) {
			console.log(
				`🛑 Force stopping polling for workflow: ${workflowId}`
			);
			this.stopPolling();
			this.currentWorkflowId = null;
			this.currentStatusCallback = null;
		} else if (this.currentWorkflowId) {
			console.log(
				`⚠️ Force stop requested for ${workflowId}, but currently polling ${this.currentWorkflowId}`
			);
		}
	}

	/**
	 * Resume polling for an existing workflow
	 */
	public resumePolling(
		workflowId: string,
		apiKey: string,
		onStatusUpdate?: (data: WorkflowExecutionResponse) => void
	): void {
		console.log(`🔄 Resuming polling for workflow: ${workflowId}`);

		// Stop any existing polling first
		this.stopPolling();

		// Set the workflow context
		this.currentWorkflowId = workflowId;
		this.currentStatusCallback = onStatusUpdate || null;

		// Start polling
		this.startPolling(workflowId, apiKey, onStatusUpdate);
	}

	/**
	 * Check if currently polling
	 */
	public isPolling(): boolean {
		const result = this.currentPollingInterval !== null;

		return result;
	}

	/**
	 * Check if polling has been running for more than 5 minutes
	 */
	public isPollingTimedOut(): boolean {
		if (!this.pollingStartTime) {
			console.log("🔍 Debug: isPollingTimedOut - no pollingStartTime");
			return false;
		}
		const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
		const elapsed = Date.now() - this.pollingStartTime;
		const result = elapsed > fiveMinutes;

		console.log("🔍 Debug: isPollingTimedOut", {
			pollingStartTime: this.pollingStartTime,
			elapsed,
			fiveMinutes,
			result,
		});

		return result;
	}

	/**
	 * Check if status hasn't changed for 5 minutes
	 */
	public isStatusStale(): boolean {
		if (!this.lastStatusChangeTime) return false;
		const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
		return Date.now() - this.lastStatusChangeTime > fiveMinutes;
	}

	/**
	 * Get the current polling duration in milliseconds
	 */
	public getPollingDuration(): number {
		if (!this.pollingStartTime) return 0;
		return Date.now() - this.pollingStartTime;
	}

	/**
	 * Get the time since last status change in milliseconds
	 */
	public getTimeSinceStatusChange(): number {
		if (!this.lastStatusChangeTime) return 0;
		return Date.now() - this.lastStatusChangeTime;
	}

	/**
	 * Get the current workflow status
	 */
	public getCurrentWorkflowStatus(): string | null {
		return this.lastWorkflowStatus;
	}

	/**
	 * Check if refresh UI should be shown considering current workflow status
	 */
	public shouldShowRefreshUIWithStatus(): boolean {
		const isAwaitingResponse =
			this.lastWorkflowStatus === "awaiting_response";
		const isCurrentlyPolling = this.isPolling();
		const hasTimedOut = this.isPollingTimedOut();

		console.log("🔍 Debug: shouldShowRefreshUIWithStatus", {
			lastWorkflowStatus: this.lastWorkflowStatus,
			isAwaitingResponse,
			isCurrentlyPolling,
			hasTimedOut,
			pollingStartTime: this.pollingStartTime,
			currentPollingInterval: !!this.currentPollingInterval,
		});

		// Don't show refresh UI when status is awaiting_response
		if (isAwaitingResponse) {
			console.log(
				"🔍 Debug: Not showing refresh UI - status is awaiting_response"
			);
			return false;
		}

		// Don't show refresh UI if not polling
		if (!isCurrentlyPolling) {
			console.log(
				"🔍 Debug: Not showing refresh UI - not currently polling"
			);
			return false;
		}

		// Only show if polling has timed out
		const result = hasTimedOut;
		console.log("🔍 Debug: shouldShowRefreshUIWithStatus result:", result);
		return result;
	}

	/**
	 * Check if refresh UI should be shown (polling has been running for more than 5 minutes)
	 */
	public shouldShowRefreshUI(): boolean {
		// Don't show refresh UI when status is awaiting_response
		if (this.lastWorkflowStatus === "awaiting_response") {
			return false;
		}
		return this.isPollingTimedOut() && this.isPolling();
	}

	/**
	 * Refresh polling and reset the 10-second timeout
	 */
	public refreshPolling(): void {
		if (this.currentWorkflowId && this.currentStatusCallback) {
			console.log(
				`🔄 Refreshing polling for workflow: ${this.currentWorkflowId}`
			);

			// Clear existing timeout
			if (this.statusTimeoutId) {
				console.log(`🧹 Clearing existing timeout`);
				clearTimeout(this.statusTimeoutId);
			}

			// Reset timers
			this.pollingStartTime = Date.now();
			this.lastStatusChangeTime = Date.now();
			console.log(
				`⏰ Timers reset for workflow ${this.currentWorkflowId}`
			);

			// Set up new 5-minute timeout (just for logging, no callback notification)
			this.statusTimeoutId = setTimeout(() => {
				if (this.currentWorkflowId) {
					console.log(
						`⏰ 5-minute timeout reached for workflow: ${this.currentWorkflowId}`
					);
					console.log(
						`🔍 Timeout detected - refresh UI should be shown by the hook`
					);
				}
			}, 5 * 60 * 1000); // 5 minutes

			console.log(
				`⏰ New timeout set for workflow ${this.currentWorkflowId} - will trigger in 5 minutes`
			);
		} else {
			console.log(
				`⚠️ Cannot refresh polling - missing workflow ID or status callback`
			);
		}
	}

	/**
	 * Emergency stop the current workflow
	 */
	public async emergencyStop(
		skyBrowser: SkyMainBrowser,
		web3Context: Web3Context,
		reason: string = "User requested emergency stop",
		workflowId?: string | null
	): Promise<boolean> {
		// Use provided workflowId or fall back to internal state
		const targetWorkflowId = workflowId || this.currentWorkflowId;
		if (!targetWorkflowId) {
			console.warn("No active workflow to stop");
			return false;
		}

		try {
			// Get API key
			const apiKey = await apiKeyManager.getApiKey(
				skyBrowser,
				web3Context
			);

			const headers = {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
			};

			const emergencyStopPayload = {
				workflowId: targetWorkflowId,
				emergencyStop: true,
				reason: reason,
			};

			console.log("🚨 Emergency stopping workflow:", targetWorkflowId);

			// Call emergency stop API
			await axios.post(
				WORKFLOW_ENDPOINTS.EMERGENCY_STOP,
				emergencyStopPayload,
				{ headers }
			);

			// Stop polling immediately and completely
			this.stopPolling();

			// Clear the status callback to prevent any further updates
			this.currentStatusCallback = null;

			console.log("✅ Workflow emergency stopped successfully");
			return true;
		} catch (error) {
			console.error("❌ Failed to emergency stop workflow:", error);
			return false;
		}
	}

	/**
	 * Resume the current workflow
	 */
	public async resumeWorkflow(
		skyBrowser: SkyMainBrowser,
		web3Context: Web3Context,
		workflowId?: string | null
	): Promise<boolean> {
		// Use provided workflowId or fall back to internal state
		const targetWorkflowId = workflowId || this.currentWorkflowId;

		if (!targetWorkflowId) {
			console.warn("No workflow to resume");
			return false;
		}

		try {
			// Get API key
			const apiKey = await apiKeyManager.getApiKey(
				skyBrowser,
				web3Context
			);

			const headers = {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
			};

			const resumePayload = {
				workflowId: targetWorkflowId,
				resume: true,
			};

			console.log("▶️ Resuming workflow:", targetWorkflowId);

			// Call resume API
			await axios.post(
				WORKFLOW_ENDPOINTS.RESUME_WORKFLOW,
				resumePayload,
				{ headers }
			);

			// Restart polling to monitor the resumed workflow with the stored callback
			this.startPolling(
				targetWorkflowId,
				apiKey,
				this.currentStatusCallback || undefined
			);

			console.log("✅ Workflow resumed successfully");
			return true;
		} catch (error) {
			console.error("❌ Failed to resume workflow:", error);
			return false;
		}
	}

	/**
	 * Stop polling and clear all related state
	 */
	private stopPolling(): void {
		if (this.currentPollingInterval) {
			console.log(
				`⏹️ Stopping polling for workflow: ${this.currentWorkflowId}`
			);
			clearInterval(this.currentPollingInterval);
			this.currentPollingInterval = null;
		} else {
			console.log(
				`⚠️ No active polling to stop for workflow: ${this.currentWorkflowId}`
			);
		}

		// Clear the 5-minute timeout
		if (this.statusTimeoutId) {
			clearTimeout(this.statusTimeoutId);
			this.statusTimeoutId = null;
		}

		// Always clear the callback to prevent stale callbacks from being called
		// Note: We may want to keep the callback for resume scenarios
		if (this.currentStatusCallback) {
			console.log(
				`🧹 Clearing status callback for workflow: ${this.currentWorkflowId}`
			);
			// Don't clear callback if workflow is just stopped (not completed/failed)
			// this.currentStatusCallback = null;
		}
	}

	/**
	 * Clear the current workflow ID and all related state
	 */
	public clearCurrentWorkflow(): void {
		console.log(`🧹 Clearing current workflow: ${this.currentWorkflowId}`);

		// Stop any active polling
		this.stopPolling();

		// Clear all state
		this.currentWorkflowId = null;
		this.currentStatusCallback = null;
		this.pollingStartTime = null;
		this.lastStatusChangeTime = null;
		this.lastWorkflowStatus = null;

		console.log(`✅ Workflow state cleared completely`);
	}

	public startContinuousPolling(
		workflowId: string,
		apiKey: string,
		pollInterval: number = 8000
	): void {
		if (this.currentWorkflowId !== workflowId) {
			console.warn(
				`⚠️ Cannot start continuous polling for different workflow: ${workflowId}`
			);
			return;
		}

		// Ensure no duplicate intervals
		if (this.currentPollingInterval) {
			console.warn(
				`⚠️ Polling already active for workflow: ${workflowId}, clearing old interval`
			);
			clearInterval(this.currentPollingInterval);
			this.currentPollingInterval = null;
		}

		console.log(
			`🔄 Manually starting continuous polling for workflow: ${workflowId} (interval: ${pollInterval}ms)`
		);
		this.currentPollingInterval = setInterval(async () => {
			try {
				const statusEndpoint = `${WORKFLOW_ENDPOINTS.FULL_WORKFLOW_STATUS}/${workflowId}`;

				const statusResponse = await axios.get(statusEndpoint, {
					headers: {
						"x-api-key": apiKey,
						"Content-Type": "application/json",
					},
				});

				const statusData = statusResponse.data;

				if (this.currentStatusCallback) {
					this.currentStatusCallback(statusData);
				}

				console.log(
					`📊 Workflow ${workflowId} status: ${statusData.workflowStatus} - Continuous polling...`
				);

				// Check if any subnet needs user input (authentication or feedback, but not notifications)
				const hasUserInputRequired = statusData.subnets?.some(
					(subnet: any) =>
						subnet.status === "awaiting_response" &&
						subnet.question &&
						subnet.question.type !== "notification"
				);

				// Check if any subnet has notification questions (continue polling)
				const hasNotificationQuestion = statusData.subnets?.some(
					(subnet: any) =>
						subnet.status === "awaiting_response" &&
						subnet.question?.type === "notification"
				);

				// Check if any subnet is in waiting_response status without data
				// Continue polling until these subnets receive data
				const hasWaitingResponseWithoutData = statusData.subnets?.some(
					(subnet: any) =>
						subnet.status === "awaiting_response" &&
						(!subnet.data || subnet.data.length === 0)
				);

				console.log(`🔍 Subnet status check for ${workflowId}:`, {
					hasUserInputRequired,
					hasNotificationQuestion,
					hasWaitingResponseWithoutData,
					waitingResponseSubnets: statusData.subnets
						?.filter((s: any) => s.status === "awaiting_response")
						.map((s: any) => ({
							toolName: s.toolName,
							hasData: !!s.data,
							dataLength: s.data?.length || 0,
							questionType: s.question?.type,
						})),
				});

				const isTerminalState =
					statusData.workflowStatus === "completed" ||
					statusData.workflowStatus === "failed";

				if (isTerminalState) {
					console.log(
						`🏁 Workflow ${workflowId} reached terminal state: ${statusData.workflowStatus}`
					);
					this.stopPolling();
					this.currentWorkflowId = null;
					this.currentStatusCallback = null;
				} else if (statusData.workflowStatus === "stopped") {
					console.log(
						`⏸️ Workflow ${workflowId} stopped, stopping all polling immediately`
					);
					// Clear the interval immediately
					if (this.currentPollingInterval) {
						clearInterval(this.currentPollingInterval);
						this.currentPollingInterval = null;
					}
					// Don't set callback to null to allow resume, but ensure polling is stopped
					return; // Exit the interval function
				} else if (
					statusData.workflowStatus === "awaiting_response" &&
					hasUserInputRequired
				) {
					console.log(
						`⏸️ Workflow ${workflowId} waiting for user input (auth/feedback), stopping polling temporarily`
					);
					this.stopPolling();
					// Keep workflow ID and callback for resuming after user input
				} else if (
					statusData.workflowStatus === "awaiting_response" &&
					hasNotificationQuestion
				) {
					console.log(
						`🔔 Workflow ${workflowId} has notification questions, continuing polling at 8s intervals...`
					);
					// For notification questions, continue polling as they don't require user input
				} else if (hasWaitingResponseWithoutData) {
					console.log(
						`⏳ Workflow ${workflowId} has subnets in waiting_response without data, continuing polling...`
					);
					// Continue polling until waiting_response subnets receive data
				}
			} catch (error) {
				console.error(
					`❌ Continuous polling error for workflow ${workflowId}:`,
					error
				);
				const axiosError = error as any;
				if (
					axiosError.response?.status === 401 ||
					axiosError.response?.status === 403
				) {
					console.error("Authentication error, stopping polling");
					this.stopPolling();
					this.currentWorkflowId = null;
					this.currentStatusCallback = null;
				}
			}
		}, pollInterval);
	}

	/**
	 * Handle external workflow status changes (e.g., workflow stopped externally)
	 */
	public handleExternalStatusChange(workflowStatus: string): void {
		if (workflowStatus === "stopped" && this.currentWorkflowId) {
			console.log("🛑 Workflow stopped externally, clearing local state");
			this.stopPolling();
			// Note: We don't clear currentWorkflowId here as the user might want to resume
		}
	}

	/**
	 * Get authentication data with signature from Skynet
	 */
	private async getAuthData(
		skyBrowser: SkyMainBrowser,
		userAddress: string
	): Promise<{ signature: string; message: string }> {
		try {
			// Get authentication from Skynet
			const authResponse = await skyBrowser?.appManager?.getUrsulaAuth();

			if (
				authResponse?.success &&
				authResponse.data?.signature &&
				authResponse.data?.message
			) {
				return {
					signature: authResponse.data.signature,
					message: authResponse.data.message,
				};
			}

			// Fallback: create a basic message and signature
			const message = `Authenticate workflow execution for ${userAddress} at ${Date.now()}`;
			const signature = await this.signMessage(message, skyBrowser);

			return { signature, message };
		} catch (error) {
			console.warn(
				"Failed to get auth from Skynet, using fallback:",
				error
			);
			// Fallback: create a basic message and signature
			const message = `Authenticate workflow execution for ${userAddress} at ${Date.now()}`;
			const signature = await this.signMessage(message, skyBrowser);

			return { signature, message };
		}
	}

	/**
	 * Sign a message using the connected wallet
	 */
	private async signMessage(
		message: string,
		skyBrowser: SkyMainBrowser
	): Promise<string> {
		try {
			// Try to get the signer from the contract service
			const signer = skyBrowser?.contractService?.signer;
			if (signer && typeof signer.signMessage === "function") {
				return await signer.signMessage(message);
			}

			// Fallback: return a placeholder signature
			console.warn("No signer available, using placeholder signature");
			return "placeholder_signature_" + Date.now();
		} catch (error) {
			console.warn("Failed to sign message:", error);
			return "placeholder_signature_" + Date.now();
		}
	}

	/**
	 * Automatically construct execution payload from agent details and user prompt
	 */
	public async constructExecutionPayload(
		agentDetail: AgentDetail,
		userPrompt: string,
		userAddress: string,
		skyBrowser: SkyMainBrowser
	): Promise<WorkflowExecutionPayload> {
		// Get authentication data
		const authData = await this.getAuthData(skyBrowser, userAddress);

		// // Get user's actual NFT ID from the specific agent collection
		// const userAgentNFTId = await this.getUserNFTId(
		// 	agentDetail,
		// 	userAddress,
		// 	skyBrowser
		// );

		const userAgentNFTId = agentDetail.nft_id;

		// Transform subnet_list to workflow format
		const workflow = agentDetail.subnet_list.map((subnet) => ({
			itemID: subnet.itemID.toString(),
			agentCollection: {
				agentAddress: agentDetail.nft_address,
				agentID: userAgentNFTId,
			},
			feedback: subnet.feedback || false,
		}));

		return {
			agentId: agentDetail.agent_uuid,
			prompt: userPrompt,
			workflow: workflow,
			userAuthPayload: {
				userAddress: userAddress,
				signature: authData.signature,
				message: authData.message,
			},
			accountNFT: {
				collectionID: agentDetail.nft_address,
				nftID: userAgentNFTId,
			},
		};
	}

	public async getUserNFTId(
		agentDetail: AgentDetail,
		userAddress: string,
		skyBrowser: SkyMainBrowser
	): Promise<string> {
		try {
			// Use the NFT ID from the API response instead of fetching from blockchain
			// The agentDetail should contain the NFT ID from the /api/agents/{collectionAddress}/{nftId} endpoint
			if (agentDetail.id) {
				console.log(
					"✅ Using NFT ID from API response:",
					agentDetail.id
				);
				return agentDetail.id;
			}

			// Fallback to agentNFTId if available
			if (agentDetail.agentNFTId) {
				console.log(
					"⚠️ Using fallback agentNFTId:",
					agentDetail.agentNFTId
				);
				return agentDetail.agentNFTId;
			}

			// Last resort fallback
			console.warn(
				"⚠️ No NFT ID found in API response, using fallback '0'"
			);
			return "69";
		} catch (error) {
			console.warn(
				"Failed to get user's NFT ID from API response:",
				error
			);
			return agentDetail.agentNFTId || "69";
		}
	}

	/**
	 * Convenience method: Construct payload and execute workflow in one call
	 */
	public async executeAgentWorkflow(
		agentDetail: AgentDetail,
		userPrompt: string,
		userAddress: string,
		skyBrowser: SkyMainBrowser,
		web3Context: Web3Context,
		onStatusUpdate?: (data: WorkflowExecutionResponse) => void
	): Promise<string> {
		// Check if there's already an active workflow
		if (this.currentWorkflowId && this.isPolling()) {
			console.warn(
				`⚠️ Agent workflow ${this.currentWorkflowId} is already running. Preventing duplicate execution.`
			);
			return this.currentWorkflowId;
		}

		const payload = await this.constructExecutionPayload(
			agentDetail,
			userPrompt,
			userAddress,
			skyBrowser
		);

		return this.executeWorkflow(
			payload,
			skyBrowser,
			web3Context,
			onStatusUpdate
		);
	}

	/**
	 * Execute workflow using HTTP POST + Polling pattern
	 */
	public async executeWorkflow(
		payload: WorkflowExecutionPayload,
		skyBrowser: SkyMainBrowser,
		web3Context: Web3Context,
		onStatusUpdate?: (data: WorkflowExecutionResponse) => void
	): Promise<string> {
		// Check if there's already an active workflow
		if (this.currentWorkflowId && this.isPolling()) {
			console.warn(
				`⚠️ Workflow ${this.currentWorkflowId} is already running. Preventing duplicate execution.`
			);
			return this.currentWorkflowId;
		}

		// Stop any existing polling before starting new workflow
		this.stopPolling();

		// Get API key
		const apiKey = await apiKeyManager.getApiKey(skyBrowser, web3Context);

		const headers = {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
		};

		const endpoint = WORKFLOW_ENDPOINTS.FULL_WORKFLOW;

		console.log(
			"🚀 Executing workflow with payload:",
			JSON.stringify(payload, null, 2)
		);

		const response = await axios.post(endpoint, payload, { headers });
		const requestId = response.data.requestId;

		console.log(`🔄 Starting polling for workflow: ${requestId}`);
		this.startPolling(requestId, apiKey, onStatusUpdate);

		return requestId;
	}

	/**
	 * Poll workflow status every 2 seconds
	 */
	private startPolling(
		requestId: string,
		apiKey: string,
		onStatusUpdate?: (data: WorkflowExecutionResponse) => void
	): void {
		console.log(`🔄 Starting polling for workflow: ${requestId}`);

		this.stopPolling();

		this.currentWorkflowId = requestId;
		this.pollingStartTime = Date.now();
		this.lastStatusChangeTime = Date.now();
		this.lastWorkflowStatus = null;

		if (onStatusUpdate) {
			this.currentStatusCallback = onStatusUpdate;
			console.log(`✅ Status callback set for workflow ${requestId}`);
		}

		let shouldContinuePolling = false;
		let pollCount = 0;

		const pollOnce = async () => {
			if (this.currentWorkflowId !== requestId) {
				console.log(
					`⚠️ Workflow ID changed during async operation: ${requestId} -> ${this.currentWorkflowId}, stopping polling`
				);
				return;
			}

			console.log(`🔍 Initial poll for workflow: ${requestId}`);
			try {
				const statusEndpoint = `${WORKFLOW_ENDPOINTS.FULL_WORKFLOW_STATUS}/${requestId}`;

				const statusResponse = await axios.get(statusEndpoint, {
					headers: {
						"x-api-key": apiKey,
						"Content-Type": "application/json",
					},
				});

				const statusData = statusResponse.data;

				// Check if status has changed
				if (this.lastWorkflowStatus !== statusData.workflowStatus) {
					const previousStatus = this.lastWorkflowStatus;
					this.lastWorkflowStatus = statusData.workflowStatus;
					this.lastStatusChangeTime = Date.now();
					console.log(
						`🔄 Status changed for workflow ${requestId}: ${previousStatus} -> ${statusData.workflowStatus}`
					);

					// If status changed from awaiting_response to in_progress, resume polling
					if (
						previousStatus === "awaiting_response" &&
						statusData.workflowStatus === "in_progress"
					) {
						console.log(
							`🔄 Workflow ${requestId} status changed from awaiting_response to in_progress, resuming polling...`
						);
						// Resume polling if it was stopped
						if (!this.isPolling()) {
							console.log(
								`🔄 Resuming polling for workflow ${requestId} after status change...`
							);
							startContinuousPolling(8000);
						}
					}
				}

				if (this.currentWorkflowId !== requestId) {
					console.log(
						`⚠️ Workflow ID changed after API call: ${requestId} -> ${this.currentWorkflowId}, stopping polling`
					);
					return;
				}

				if (onStatusUpdate) {
					onStatusUpdate(statusData);
				}

				const isActiveState =
					statusData.workflowStatus === "in_progress" ||
					statusData.workflowStatus === "waiting" ||
					statusData.workflowStatus === "pending" ||
					statusData.workflowStatus === "awaiting_response";

				const hasUserInputRequired = statusData.subnets?.some(
					(subnet: any) =>
						subnet.status === "awaiting_response" &&
						subnet.question &&
						subnet.question.type !== "notification" &&
						// Check if feedback has been submitted for this subnet
						!subnet.feedbackHistory?.some(
							(feedback: any) =>
								feedback.feedback_question ===
									subnet.question?.text &&
								feedback.user_answer &&
								feedback.user_answer.trim() !== ""
						)
				);

				const hasNotificationQuestion = statusData.subnets?.some(
					(subnet: any) =>
						subnet.status === "awaiting_response" &&
						subnet.question?.type === "notification"
				);

				if (isActiveState) {
					console.log(
						`🔄 Workflow ${requestId} is active (${statusData.workflowStatus}), starting continuous polling...`
					);

					// Log subnet status details for debugging
					console.log(`🔍 Subnet status details for ${requestId}:`, {
						workflowStatus: statusData.workflowStatus,
						hasUserInputRequired,
						hasNotificationQuestion,
						subnets: statusData.subnets?.map((s: any) => ({
							itemID: s.itemID,
							toolName: s.toolName,
							status: s.status,
							hasQuestion: !!s.question,
							questionType: s.question?.type,
							hasFeedbackHistory: !!s.feedbackHistory?.length,
							feedbackWithAnswers:
								s.feedbackHistory?.filter(
									(f: any) =>
										f.user_answer &&
										f.user_answer.trim() !== ""
								).length || 0,
							feedbackDetails: s.feedbackHistory?.map(
								(f: any) => ({
									question: f.feedback_question,
									answer: f.user_answer,
									continue: f.continue,
								})
							),
						})),
					});

					shouldContinuePolling = true;

					if (hasUserInputRequired) {
						// Stop polling if user input is required and feedback hasn't been submitted
						console.log(
							`⏸️ Workflow ${requestId} waiting for user input, stopping polling temporarily`
						);
						this.stopPolling();
						shouldContinuePolling = false;
					} else if (hasNotificationQuestion) {
						startContinuousPolling(8000);
					} else {
						startContinuousPolling(8000);
					}
				} else if (statusData.workflowStatus === "stopped") {
					console.log(
						`⏸️ Workflow ${requestId} is stopped, stopping all polling`
					);
					this.stopPolling();
					shouldContinuePolling = false;
					return;
				} else if (statusData.workflowStatus === "completed") {
					console.log(
						`🏁 Workflow ${requestId} completed successfully`
					);
					this.stopPolling();
					this.currentWorkflowId = null;
					this.currentStatusCallback = null;
				} else {
					console.log(
						`🏁 Workflow ${requestId} is not active (${statusData.workflowStatus}), stopping polling`
					);
					this.stopPolling();
					this.currentWorkflowId = null;
					this.currentStatusCallback = null;
				}
			} catch (error) {
				console.error(
					`❌ Initial polling error for workflow ${requestId}:`,
					error
				);
				this.stopPolling();
				this.currentWorkflowId = null;
				this.currentStatusCallback = null;
			}
		};

		const startContinuousPolling = (pollInterval: number = 8000) => {
			if (this.currentPollingInterval) {
				console.warn(
					`⚠️ Polling already active for workflow: ${requestId}, clearing old interval`
				);
				clearInterval(this.currentPollingInterval);
				this.currentPollingInterval = null;
			}

			console.log(
				`🔄 Starting continuous polling for workflow: ${requestId} (interval: ${pollInterval}ms)`
			);
			this.currentPollingInterval = setInterval(async () => {
				if (this.currentWorkflowId !== requestId) {
					console.log(
						`⚠️ Workflow ID changed during continuous polling: ${requestId} -> ${this.currentWorkflowId}, stopping polling`
					);
					clearInterval(this.currentPollingInterval!);
					this.currentPollingInterval = null;
					return;
				}

				pollCount++;
				console.log(
					`🔍 Continuous poll #${pollCount} for workflow: ${requestId}`
				);
				try {
					const statusEndpoint = `${WORKFLOW_ENDPOINTS.FULL_WORKFLOW_STATUS}/${requestId}`;

					const statusResponse = await axios.get(statusEndpoint, {
						headers: {
							"x-api-key": apiKey,
							"Content-Type": "application/json",
						},
					});

					const statusData = statusResponse.data;

					// Check if status has changed
					if (this.lastWorkflowStatus !== statusData.workflowStatus) {
						const previousStatus = this.lastWorkflowStatus;
						this.lastWorkflowStatus = statusData.workflowStatus;
						this.lastStatusChangeTime = Date.now();
						console.log(
							`🔄 Status changed for workflow ${requestId}: ${previousStatus} -> ${statusData.workflowStatus}`
						);

						// If status changed from awaiting_response to in_progress, resume polling
						if (
							previousStatus === "awaiting_response" &&
							statusData.workflowStatus === "in_progress"
						) {
							console.log(
								`🔄 Workflow ${requestId} status changed from awaiting_response to in_progress, resuming polling...`
							);
							// Resume polling if it was stopped
							if (!this.isPolling()) {
								console.log(
									`🔄 Resuming polling for workflow ${requestId} after status change...`
								);
								startContinuousPolling(8000);
							}
						}
					}

					if (this.currentWorkflowId !== requestId) {
						console.log(
							`⚠️ Workflow ID changed after continuous poll API call: ${requestId} -> ${this.currentWorkflowId}, stopping polling`
						);
						this.stopPolling();
						return;
					}

					if (onStatusUpdate) {
						onStatusUpdate(statusData);
					}

					console.log(
						`📊 Workflow ${requestId} status: ${statusData.workflowStatus} - Polling continues...`
					);

					const hasUserInputRequired = statusData.subnets?.some(
						(subnet: any) =>
							subnet.status === "awaiting_response" &&
							subnet.question &&
							subnet.question.type !== "notification" &&
							// Check if feedback has been submitted for this subnet
							!subnet.feedbackHistory?.some(
								(feedback: any) =>
									feedback.feedback_question ===
										subnet.question?.text &&
									feedback.user_answer &&
									feedback.user_answer.trim() !== ""
							)
					);

					const hasNotificationQuestion = statusData.subnets?.some(
						(subnet: any) =>
							subnet.status === "awaiting_response" &&
							subnet.question?.type === "notification"
					);

					const hasWaitingResponseWithoutData =
						statusData.subnets?.some(
							(subnet: any) =>
								subnet.status === "awaiting_response" &&
								(!subnet.data || subnet.data.length === 0) &&
								!subnet.question // Only count as waiting without data if there's no question
						);

					console.log(`🔍 Subnet status check for ${requestId}:`, {
						hasUserInputRequired,
						hasNotificationQuestion,
						hasWaitingResponseWithoutData,
						workflowStatus: statusData.workflowStatus,
						waitingResponseSubnets: statusData.subnets
							?.filter(
								(s: any) => s.status === "awaiting_response"
							)
							.map((s: any) => ({
								itemID: s.itemID,
								toolName: s.toolName,
								hasData: !!s.data,
								dataLength: s.data?.length || 0,
								questionType: s.question?.type,
								hasFeedbackHistory: !!s.feedbackHistory?.length,
								feedbackWithAnswers:
									s.feedbackHistory?.filter(
										(f: any) =>
											f.user_answer &&
											f.user_answer.trim() !== ""
									).length || 0,
								feedbackDetails: s.feedbackHistory?.map(
									(f: any) => ({
										question: f.feedback_question,
										answer: f.user_answer,
										continue: f.continue,
									})
								),
							})),
					});

					const isTerminalState =
						statusData.workflowStatus === "completed" ||
						statusData.workflowStatus === "failed";

					if (isTerminalState) {
						console.log(
							`🏁 Workflow ${requestId} reached terminal state: ${statusData.workflowStatus}`
						);
						this.stopPolling();
						this.currentWorkflowId = null;
						this.currentStatusCallback = null;
					} else if (statusData.workflowStatus === "stopped") {
						console.log(
							`⏸️ Workflow ${requestId} stopped, stopping all polling immediately`
						);
						if (this.currentPollingInterval) {
							clearInterval(this.currentPollingInterval);
							this.currentPollingInterval = null;
						}
						return;
					} else if (
						statusData.workflowStatus === "awaiting_response" &&
						hasUserInputRequired
					) {
						console.log(
							`⏸️ Workflow ${requestId} waiting for user input (auth/feedback), stopping polling temporarily`
						);
						this.stopPolling();
					} else if (
						statusData.workflowStatus === "awaiting_response" &&
						hasNotificationQuestion
					) {
						console.log(
							`🔔 Workflow ${requestId} has notification questions, continuing polling...`
						);
					} else if (
						statusData.workflowStatus === "in_progress" &&
						hasUserInputRequired
					) {
						// This is the key case: workflow is in_progress but has subnets with questions
						// Check if all questions have been answered via feedback
						const allQuestionsAnswered = statusData.subnets?.every(
							(subnet: any) => {
								if (
									subnet.status === "awaiting_response" &&
									subnet.question
								) {
									// Check if this question has been answered
									return subnet.feedbackHistory?.some(
										(feedback: any) =>
											feedback.feedback_question ===
												subnet.question?.text &&
											feedback.user_answer &&
											feedback.user_answer.trim() !== ""
									);
								}
								return true; // No question, so no answer needed
							}
						);

						if (allQuestionsAnswered) {
							console.log(
								`🔄 Workflow ${requestId} is in_progress and all questions answered, continuing polling...`
							);
							// Resume polling if it was stopped
							if (!this.isPolling()) {
								console.log(
									`🔄 Resuming polling for workflow ${requestId} after all questions answered...`
								);
								startContinuousPolling(8000);
							}
						} else {
							console.log(
								`⏸️ Workflow ${requestId} is in_progress but has unanswered questions, stopping polling temporarily`
							);
							this.stopPolling();
						}
					} else if (hasWaitingResponseWithoutData) {
						console.log(
							`⏳ Workflow ${requestId} has subnets in waiting_response without data, continuing polling...`
						);
					} else if (
						statusData.workflowStatus === "in_progress" &&
						!hasUserInputRequired
					) {
						console.log(
							`🔄 Workflow ${requestId} is in progress and no user input required, continuing polling...`
						);
					} else if (
						statusData.workflowStatus === "in_progress" &&
						statusData.subnets?.some(
							(s: any) => s.status === "awaiting_response"
						)
					) {
						// Workflow is in_progress but has subnets in awaiting_response
						// This might be a temporary state while backend processes feedback
						console.log(
							`⏳ Workflow ${requestId} is in_progress but has subnets in awaiting_response, continuing polling to monitor status changes...`
						);
						// Continue polling to see when the backend updates the subnet statuses
						// This is important because the backend might be processing feedback
					}
				} catch (error) {
					console.error(
						`❌ Continuous polling error for workflow ${requestId}:`,
						error
					);
					const axiosError = error as any;
					if (
						axiosError.response?.status === 401 ||
						axiosError.response?.status === 403
					) {
						console.error("Authentication error, stopping polling");
						this.stopPolling();
						this.currentWorkflowId = null;
						this.currentStatusCallback = null;
					}
				}
			}, pollInterval);
		};

		pollOnce();
	}
}

export const workflowExecutor = WorkflowExecutor.getInstance();
