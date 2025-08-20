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
import { getUserAgentNFTIds } from "@/utils/skynetHelper";

export class WorkflowExecutor {
	private static instance: WorkflowExecutor;
	private currentWorkflowId: string | null = null;
	private currentPollingInterval: NodeJS.Timeout | null = null;
	private currentStatusCallback:
		| ((data: WorkflowExecutionResponse) => void)
		| null = null;

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
	 * Check if polling is currently active
	 */
	public isPolling(): boolean {
		return this.currentPollingInterval !== null;
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

				// Check if any subnet needs non-authentication feedback
				const hasNonAuthFeedback = statusData.subnets?.some(
					(subnet: any) =>
						subnet.status === "awaiting_response" &&
						subnet.question &&
						subnet.question.type !== "authentication"
				);

				// Check if any subnet needs authentication
				const hasAuthenticationPending = statusData.subnets?.some(
					(subnet: any) =>
						subnet.status === "awaiting_response" &&
						subnet.question?.type === "authentication"
				);

				// Check if any subnet is in waiting_response status without data
				// Continue polling until these subnets receive data
				const hasWaitingResponseWithoutData = statusData.subnets?.some(
					(subnet: any) =>
						subnet.status === "awaiting_response" &&
						(!subnet.data || subnet.data.length === 0)
				);

				console.log(`🔍 Subnet status check for ${workflowId}:`, {
					hasNonAuthFeedback,
					hasAuthenticationPending,
					hasWaitingResponseWithoutData,
					waitingResponseSubnets: statusData.subnets
						?.filter((s: any) => s.status === "awaiting_response")
						.map((s: any) => ({
							toolName: s.toolName,
							hasData: !!s.data,
							dataLength: s.data?.length || 0,
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
					hasNonAuthFeedback
				) {
					console.log(
						`⏸️ Workflow ${workflowId} waiting for user feedback (non-auth), stopping polling temporarily`
					);
					this.stopPolling();
					// Keep workflow ID and callback for resuming after feedback
				} else if (
					statusData.workflowStatus === "awaiting_response" &&
					hasAuthenticationPending
				) {
					console.log(
						`🔐 Workflow ${workflowId} waiting for authentication, continuing polling at 10s intervals...`
					);
					// For authentication, we might want to adjust the polling interval
					// But we continue polling
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

		// Get user's actual NFT ID from the specific agent collection
		const userAgentNFTId = await this.getUserNFTId(
			agentDetail,
			userAddress,
			skyBrowser
		);

		// Transform subnet_list to workflow format
		const workflow = agentDetail.subnet_list.map((subnet) => ({
			itemID: subnet.itemID.toString(),
			agentCollection: {
				agentAddress: agentDetail.nft_address,
				agentID: userAgentNFTId, // Use actual user's NFT ID from agent collection
			},
			feedback: subnet.feedback || false, // Include feedback if available
		}));

		return {
			agentId: agentDetail.id,
			prompt: userPrompt,
			workflow: workflow,
			userAuthPayload: {
				userAddress: userAddress,
				signature: authData.signature,
				message: authData.message,
			},
			accountNFT: {
				collectionID: agentDetail.nft_address, // Agent's NFT collection address
				nftID: userAgentNFTId, // User's specific NFT ID from this agent collection
			},
		};
	}

	/**
	 * Get user's NFT ID from the agent collection
	 */
	public async getUserNFTId(
		agentDetail: AgentDetail,
		userAddress: string,
		skyBrowser: SkyMainBrowser
	): Promise<string> {
		try {
			// Get the specific agent's NFT collection address
			const agentAddress =
				agentDetail.nft_address || agentDetail.collection_id;
			if (!agentAddress) {
				console.warn("No agent NFT address found, using fallback");
				return agentDetail.agentNFTId || "0";
			}

			// Use the utility function to get user's NFT IDs from this specific agent collection
			const userAgentNFTIds = await getUserAgentNFTIds(
				agentAddress,
				userAddress,
				skyBrowser
			);

			if (userAgentNFTIds && userAgentNFTIds.length > 0) {
				// Return the first (lowest) NFT ID the user owns from this agent collection
				return userAgentNFTIds[0];
			}

			// Fallback to using the agent's NFT ID if user doesn't own any
			return agentDetail.agentNFTId || "0";
		} catch (error) {
			console.warn(
				"Failed to get user's NFT ID from agent collection:",
				error
			);
			return agentDetail.agentNFTId || "0";
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

		// Construct the payload automatically with authentication and NFT ID
		const payload = await this.constructExecutionPayload(
			agentDetail,
			userPrompt,
			userAddress,
			skyBrowser
		);

		// Execute the workflow
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

		// Use full workflow endpoint
		const endpoint = WORKFLOW_ENDPOINTS.FULL_WORKFLOW;

		// Log the complete payload for debugging
		console.log(
			"🚀 Executing workflow with payload:",
			JSON.stringify(payload, null, 2)
		);

		// Initiate workflow with HTTP POST
		const response = await axios.post(endpoint, payload, { headers });
		const requestId = response.data.requestId;

		// Start polling for status updates
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

		// Always stop any existing polling before starting new one
		this.stopPolling();

		this.currentWorkflowId = requestId;

		if (onStatusUpdate) {
			this.currentStatusCallback = onStatusUpdate;
		}

		let shouldContinuePolling = false;
		let pollCount = 0;

		const pollOnce = async () => {
			// Check if the workflow ID has changed during the async operation
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

				// Check again if the workflow ID has changed
				if (this.currentWorkflowId !== requestId) {
					console.log(
						`⚠️ Workflow ID changed after API call: ${requestId} -> ${this.currentWorkflowId}, stopping polling`
					);
					return;
				}

				if (onStatusUpdate) {
					onStatusUpdate(statusData);
				}

				console.log(
					`📊 Workflow ${requestId} initial status: ${statusData.workflowStatus}`
				);

				const isActiveState =
					statusData.workflowStatus === "in_progress" ||
					statusData.workflowStatus === "waiting" ||
					statusData.workflowStatus === "pending" ||
					statusData.workflowStatus === "awaiting_response" ||
					statusData.workflowStatus === "awaiting_response";

				// Check if any subnet needs authentication (special case for continuous polling)
				const hasAuthenticationPending = statusData.subnets?.some(
					(subnet: any) =>
						subnet.status === "awaiting_response" &&
						subnet.question?.type === "authentication"
				);

				if (isActiveState) {
					console.log(
						`🔄 Workflow ${requestId} is active (${statusData.workflowStatus}), starting continuous polling...`
					);
					shouldContinuePolling = true;

					// For authentication questions, poll every 10 seconds instead of 2 seconds
					if (hasAuthenticationPending) {
						startContinuousPolling(10000);
					} else {
						startContinuousPolling(8000);
					}
				} else if (statusData.workflowStatus === "stopped") {
					console.log(
						`⏸️ Workflow ${requestId} is stopped, stopping all polling`
					);
					this.stopPolling();
					// Keep the workflow ID for potential resume but ensure no more polling
					shouldContinuePolling = false;
					return; // Exit immediately
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
			// Ensure no duplicate intervals
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
				// Check if the workflow ID has changed
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

					// Check again if the workflow ID has changed
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

					// Check if any subnet needs non-authentication feedback
					const hasNonAuthFeedback = statusData.subnets?.some(
						(subnet: any) =>
							subnet.status === "awaiting_response" &&
							subnet.question &&
							subnet.question.type !== "authentication"
					);

					// Check if any subnet needs authentication
					const hasAuthenticationPending = statusData.subnets?.some(
						(subnet: any) =>
							subnet.status === "awaiting_response" &&
							subnet.question?.type === "authentication"
					);

					// Check if any subnet is in waiting_response status without data
					// Continue polling until these subnets receive data
					const hasWaitingResponseWithoutData =
						statusData.subnets?.some(
							(subnet: any) =>
								subnet.status === "awaiting_response" &&
								(!subnet.data || subnet.data.length === 0)
						);

					console.log(`🔍 Subnet status check for ${requestId}:`, {
						hasNonAuthFeedback,
						hasAuthenticationPending,
						hasWaitingResponseWithoutData,
						waitingResponseSubnets: statusData.subnets
							?.filter(
								(s: any) => s.status === "awaiting_response"
							)
							.map((s: any) => ({
								toolName: s.toolName,
								hasData: !!s.data,
								dataLength: s.data?.length || 0,
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
						// Clear the interval immediately
						if (this.currentPollingInterval) {
							clearInterval(this.currentPollingInterval);
							this.currentPollingInterval = null;
						}
						// Ensure no further polling
						return;
					} else if (
						statusData.workflowStatus === "awaiting_response" &&
						hasNonAuthFeedback
					) {
						console.log(
							`⏸️ Workflow ${requestId} waiting for user feedback (non-auth), stopping polling temporarily`
						);
						this.stopPolling();
						// Keep workflow ID and callback for resuming after feedback
					} else if (
						statusData.workflowStatus === "awaiting_response" &&
						hasAuthenticationPending
					) {
						console.log(
							`🔐 Workflow ${requestId} waiting for authentication, continuing polling...`
						);
						// Continue polling for authentication
					} else if (hasWaitingResponseWithoutData) {
						console.log(
							`⏳ Workflow ${requestId} has subnets in waiting_response without data, continuing polling...`
						);
						// Continue polling until waiting_response subnets receive data
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
