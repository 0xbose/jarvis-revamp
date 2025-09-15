"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import ScheduleInterface, {
	type ScheduleConfig as UIScheduleConfig,
} from "@/components/schedule/schedule-interface";
import Marketplace from "@/components/market-place/user-agent-selector";
import { useGlobalStore } from "@/stores/global-store";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAgentDetailByCollectionAndNftId } from "@/controllers/agents/agents.query";
import { scheduleWorkflowWithPrompt } from "@/controllers/schedule/schedule.mutations";
import type { AgentDetailResponse, UserAgentCollection } from "@/types/agents";
import type { ScheduleWorkflowPayload, WorkflowItem } from "@/types/schedule";
import { useWallet } from "@/hooks/use-wallet";

type ScheduleConfig = UIScheduleConfig;

function isScheduleConfigComplete(config: ScheduleConfig | null): boolean {
	if (!config) return false;
	if (!config.type) return false;
	if (config.type === "one-time") {
		if (!config.selectedDate) return false;
		if (
			typeof config.hour !== "number" ||
			typeof config.minute !== "number"
		)
			return false;
		return true;
	}
	if (config.type === "recurring") {
		if (!config.scheduleType) return false;
		if (
			config.scheduleType === "minutes" ||
			config.scheduleType === "hours"
		) {
			if (typeof config.interval !== "number") return false;
			return true;
		}
		if (config.scheduleType === "daily") {
			if (
				typeof config.hour !== "number" ||
				typeof config.minute !== "number"
			)
				return false;
			return true;
		}
		if (config.scheduleType === "weekly") {
			if (
				typeof config.hour !== "number" ||
				typeof config.minute !== "number"
			)
				return false;
			if (
				!Array.isArray(config.selectedDays) ||
				config.selectedDays.length === 0
			)
				return false;
			return true;
		}
		if (config.scheduleType === "monthly") {
			if (
				typeof config.hour !== "number" ||
				typeof config.minute !== "number"
			)
				return false;
			if (typeof config.dayOfMonth !== "number") return false;
			return true;
		}
	}
	return false;
}

export default function Page() {
	const { skyBrowser, address } = useWallet();
	const { selectedAgent } = useGlobalStore();
	const [userPrompt, setUserPrompt] = useState("");
	const [generatedPrompt, setGeneratedPrompt] = useState("");
	const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(
		null
	);

	const isUserAgentCollection = (
		agent: AgentDetailResponse | UserAgentCollection | null
	): agent is UserAgentCollection => {
		return Boolean(
			agent && (agent as any).collection_address && (agent as any).nft_id
		);
	};

	const {
		data: agentDetail,
		isLoading,
		isFetching,
		error,
	} = useQuery<AgentDetailResponse>({
		queryKey: [
			"agent-detail",
			isUserAgentCollection(selectedAgent)
				? selectedAgent.collection_address
				: undefined,
			isUserAgentCollection(selectedAgent)
				? selectedAgent.nft_id
				: undefined,
		],
		queryFn: async () => {
			if (!isUserAgentCollection(selectedAgent)) {
				throw new Error("Missing selection");
			}
			return await getAgentDetailByCollectionAndNftId(
				selectedAgent.collection_address,
				selectedAgent.nft_id
			);
		},
		enabled: Boolean(isUserAgentCollection(selectedAgent)),
		staleTime: 0,
	});

	const effectiveAgentDetail: AgentDetailResponse | null = useMemo(() => {
		if (isUserAgentCollection(selectedAgent)) return agentDetail ?? null;
		return (selectedAgent as AgentDetailResponse) || null;
	}, [agentDetail, selectedAgent]);

	const workflow: WorkflowItem[] = useMemo(() => {
		if (!effectiveAgentDetail || !selectedAgent) return [];
		const collectionAddress = isUserAgentCollection(selectedAgent)
			? selectedAgent.collection_address
			: undefined;
		return (effectiveAgentDetail.subnet_list || []).map((subnet) => ({
			itemID: String(subnet.itemID),
			feedback: Boolean(subnet.feedback),
			agentCollection: {
				agentID: effectiveAgentDetail.nft_id,
				agentAddress: collectionAddress || "",
			},
		}));
	}, [effectiveAgentDetail, selectedAgent]);

	const payload: ScheduleWorkflowPayload | null = useMemo(() => {
		if (!effectiveAgentDetail) return null;
		return {
			prompt: generatedPrompt,
			agentPayload: {
				prompt: userPrompt,
				agentId: effectiveAgentDetail.agent_uuid,
				workflow,
			},
		};
	}, [effectiveAgentDetail, generatedPrompt, userPrompt, workflow]);

	const isSaveEnabled = useMemo(() => {
		if (!selectedAgent) return false;
		if (!userPrompt.trim()) return false;
		if (!isScheduleConfigComplete(scheduleConfig)) return false;
		return true;
	}, [selectedAgent, userPrompt, scheduleConfig]);

	const {
		mutate: saveSchedule,
		isPending: isSaving,
		isSuccess: isSaveSuccess,
		isError: isSaveError,
		error: saveError,
	} = useMutation({
		mutationFn: async () => {
			if (!payload) throw new Error("Missing payload");
			return await scheduleWorkflowWithPrompt({
				prompt: payload.prompt,
				agentPayload: payload.agentPayload,
				skyBrowser,
				web3Context: { address },
			});
		},
	});

	return (
		<div className="min-h-screen bg-background">
			<div className="p-6 space-y-8">
				<div className="flex items-center justify-between">
					<h4 className="text-2xl font-medium text-foreground">
						Schedule Your Agent
					</h4>
					<div className="flex items-center gap-3">
						<Marketplace />
						<Button
							size="sm"
							className="bg-green-600 hover:bg-green-700 text-gray-900"
							disabled={!isSaveEnabled || isSaving}
							onClick={() => {
								if (isSaveEnabled && !isSaving) {
									saveSchedule();
								}
							}}
						>
							<Save className="mr-0.5" />
							{isSaving ? "Saving..." : "Save"}
						</Button>
					</div>
				</div>
				<div className="space-y-4">
					<h4 className="text-lg font-semibold text-foreground">
						Instructions
					</h4>
					<Textarea
						placeholder="Describe what this agent should do..."
						value={userPrompt}
						onChange={(e) => setUserPrompt(e.target.value)}
						rows={6}
						className="resize-none border border-border/80 bg-background focus:border-green-500 focus:ring-0 focus:ring-none text-base"
					/>
				</div>

				<ScheduleInterface
					onScheduleChange={(config) => setScheduleConfig(config)}
					onGeneratedPromptChange={(prompt) =>
						setGeneratedPrompt(prompt)
					}
				/>

				{/* <div className="space-y-4">
					<h2 className="text-xl font-semibold text-foreground">
						Payload Preview
					</h2>
					{error && (
						<div className="text-sm text-red-500">
							{(error as any)?.message ||
								"Failed to load agent details"}
						</div>
					)}
					{(isLoading || isFetching) && selectedAgent && (
						<div className="text-sm text-muted-foreground">
							Fetching agent details…
						</div>
					)}
					<pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
						{payload
							? JSON.stringify(payload, null, 2)
							: "Select agent, enter prompt, and configure schedule to see payload"}
					</pre>
				</div> */}

				{isSaveError && (
					<div className="text-sm text-red-500 mt-2">
						{(saveError as any)?.message ||
							"Failed to save schedule"}
					</div>
				)}
				{isSaveSuccess && (
					<div className="text-sm text-green-600 mt-2">
						Schedule saved successfully!
					</div>
				)}
			</div>
		</div>
	);
}
