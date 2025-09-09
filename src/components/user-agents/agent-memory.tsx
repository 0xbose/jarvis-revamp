"use client";
import React, { useState, useEffect } from "react";
import {
	AgentDetailResponse,
	AgentSubnet,
	SelectedAgent,
} from "@/types/agents";
import { ExtendedSubnet } from "@/types/subnet";
import { useQuery } from "@tanstack/react-query";
import { getSubnetsByID } from "@/controllers/subnets/subnets.query";
import {
	getUserMintedAgents,
	getAgentDetailByCollectionAndNftId,
} from "@/controllers/agents/agents.query";
import { Input } from "../ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Checkbox } from "../ui/checkbox";
import { upsertNodeContextMemory } from "@/controllers/node-context/node-context.mutations";
import { getNodeContextMemory } from "@/controllers/node-context/node-context.query";
import { PlusIcon } from "lucide-react";

function SubnetSkeletonList() {
	return (
		<div>
			{Array.from({ length: 3 }).map((_, idx) => (
				<div
					key={idx}
					className="py-3 px-2 border-b last:border-b-0 flex items-center animate-pulse"
				>
					<Skeleton className="h-4 w-32 rounded" />
				</div>
			))}
		</div>
	);
}

function MintedAgentSkeleton() {
	return (
		<div className="border border-border rounded-lg shadow-sm p-4 flex bg-background animate-pulse">
			<Skeleton className="w-16 h-16 rounded-md mr-4" />
			<div className="flex-1 flex flex-col justify-center">
				<Skeleton className="h-4 w-24 rounded mb-2" />
				<Skeleton className="h-3 w-40 rounded" />
			</div>
		</div>
	);
}

function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [value, delay]);

	return debouncedValue;
}

export default function AgentMemory({
	agentData,
}: {
	agentData: AgentDetailResponse;
}) {
	const [dialogOpen, setDialogOpen] = useState(false);

	const [selectedAgents, setSelectedAgents] = useState<SelectedAgent[]>([]);
	const [selectedSubnetsPerAgent, setSelectedSubnetsPerAgent] = useState<
		Record<string, Set<number>>
	>({});

	const [search, setSearch] = useState("");
	const debouncedSearch = useDebounce(search, 1000);

	const [assigningMemory, setAssigningMemory] = useState<
		Record<string, boolean>
	>({});

	const useAgentMemoryDetails = (agentID: string) => {
		return useQuery({
			queryKey: ["agentMemoryDetails", agentID],
			queryFn: async () => {
				const memories = await getNodeContextMemory({ agentID });

				const memoriesWithAgentDetails = await Promise.all(
					memories.map(async (memory) => {
						try {
							const { agentAddress, agentID: nftId } =
								memory.agent_collection;
							const agentDetails =
								await getAgentDetailByCollectionAndNftId(
									agentAddress,
									nftId
								);
							return {
								...memory,
								agentDetails,
							};
						} catch (error) {
							console.error(
								`Failed to fetch agent details for memory ${memory.id}:`,
								error
							);
							return {
								...memory,
								agentDetails: null,
							};
						}
					})
				);

				return memoriesWithAgentDetails;
			},
			gcTime: 0,
			staleTime: 0,
			refetchOnMount: "always",
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
			enabled: !!agentID,
		});
	};

	const {
		data: memoryDetails,
		isLoading: isLoadingMemoryDetails,
		refetch: refetchMemoryDetails,
	} = useAgentMemoryDetails(agentData.id);

	useEffect(() => {
		if (dialogOpen) {
			refetchMemoryDetails();
		}
	}, [dialogOpen, refetchMemoryDetails]);

	useEffect(() => {
		if (memoryDetails && memoryDetails.length > 0) {
			const agentsFromMemory: SelectedAgent[] = [];
			const subnetsFromMemory: Record<string, Set<number>> = {};

			memoryDetails.forEach((memory) => {
				if (memory.agentDetails) {
					const agentId = memory.agentDetails.id;
					const agent: SelectedAgent = {
						id: agentId,
						name: memory.agentDetails.name,
						description: memory.agentDetails.description,
						image: memory.agentDetails.image || undefined,
						collection_address:
							memory.agent_collection.agentAddress,
						nft_id: memory.agent_collection.agentID,
					};

					// Add agent if not already present
					if (!agentsFromMemory.some((a) => a.id === agentId)) {
						agentsFromMemory.push(agent);
						subnetsFromMemory[agentId] = new Set();
					}

					// Add subnet to the agent's selected subnets
					const subnetItemId = parseInt(memory.item_id);
					if (!isNaN(subnetItemId)) {
						if (!subnetsFromMemory[agentId]) {
							subnetsFromMemory[agentId] = new Set();
						}
						subnetsFromMemory[agentId].add(subnetItemId);
					}
				}
			});

			setSelectedAgents((prev) => {
				const existingIds = new Set(prev.map((a) => a.id));
				const newAgents = agentsFromMemory.filter(
					(a) => !existingIds.has(a.id)
				);
				return [...prev, ...newAgents];
			});

			setSelectedSubnetsPerAgent((prev) => {
				const updated = { ...prev };
				Object.entries(subnetsFromMemory).forEach(
					([agentId, subnets]) => {
						if (updated[agentId]) {
							// Merge with existing selections
							subnets.forEach((subnetId) =>
								updated[agentId].add(subnetId)
							);
						} else {
							updated[agentId] = subnets;
						}
					}
				);
				return updated;
			});
		}
	}, [memoryDetails]);

	const agentSubnets: AgentSubnet[] = agentData?.subnet_list || [];

	const subnetIds = agentSubnets.map((s) => s.unique_id).filter(Boolean);

	const {
		data: subnetDetails,
		isLoading: isLoadingSubnets,
		isError: isErrorSubnets,
	} = useQuery<ExtendedSubnet[]>({
		queryKey: ["agent-subnets", subnetIds],
		queryFn: async (): Promise<ExtendedSubnet[]> => {
			if (subnetIds.length === 0) return [];

			const results = await Promise.all(
				subnetIds.map((id) => getSubnetsByID(id))
			);

			const flattened = results.flat();
			const seen = new Set();

			return flattened.filter((subnet) => {
				const key = subnet.unique_id;
				if (seen.has(key)) {
					return false;
				}
				seen.add(key);
				return true;
			});
		},
		enabled: subnetIds.length > 0,
		staleTime: 0,
		gcTime: 0,
		refetchOnMount: "always",
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
	});

	const subnetDetailsMap = new Map();
	if (subnetDetails) {
		subnetDetails.forEach((subnet) => {
			subnetDetailsMap.set(subnet.unique_id, subnet);
		});
	}

	const {
		data: mintedAgentsData,
		isLoading: isLoadingMintedAgents,
		isError: isErrorMintedAgents,
	} = useQuery({
		queryKey: [
			"user-minted-agents",
			agentData.user_address,
			debouncedSearch,
			memoryDetails,
		],
		queryFn: async () => {
			return getUserMintedAgents({
				address: agentData.user_address,
				search: debouncedSearch,
			});
		},
		enabled: dialogOpen && !!agentData.user_address,
		staleTime: 0,
		gcTime: 0,
		refetchOnMount: "always",
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
	});

	const handleAgentToggle = (agent: any) => {
		const selectedAgent: SelectedAgent = {
			id: agent.id,
			name: agent.name,
			description: agent.description,
			image: agent.image,
			collection_address: agent.collection_address,
			nft_id: agent.nft_id,
		};

		setSelectedAgents((prev) => {
			const isSelected = prev.some((a) => a.id === selectedAgent.id);
			if (isSelected) {
				// Remove agent and its subnet selections (Remove)
				setSelectedSubnetsPerAgent((prevSubnets) => {
					const newSubnets = { ...prevSubnets };
					delete newSubnets[selectedAgent.id];
					return newSubnets;
				});
				return prev.filter((a) => a.id !== selectedAgent.id);
			} else {
				// Add agent (Add)
				setSelectedSubnetsPerAgent((prevSubnets) => ({
					...prevSubnets,
					[selectedAgent.id]: new Set(),
				}));
				return [...prev, selectedAgent];
			}
		});
	};

	const handleSubnetToggle = async (
		agentId: string,
		subnetItemId: number
	) => {
		const agent = selectedAgents.find((a) => a.id === agentId);
		if (!agent) return;

		const isCurrentlySelected =
			selectedSubnetsPerAgent[agentId]?.has(subnetItemId) || false;
		const loadingKey = `${agentId}-${subnetItemId}`;

		if (!isCurrentlySelected) {
			setAssigningMemory((prev) => ({ ...prev, [loadingKey]: true }));

			try {
				const payload = {
					agent_id: agentData.id,
					agentCollection: {
						agentAddress: agent.collection_address,
						agentID: agent.nft_id,
					},
					item_id: subnetItemId.toString(),
				};

				await upsertNodeContextMemory(payload);

				setSelectedSubnetsPerAgent((prev) => {
					const agentSubnets = prev[agentId] || new Set<number>();
					const newSet = new Set<number>(agentSubnets);
					newSet.add(subnetItemId);
					return {
						...prev,
						[agentId]: newSet,
					};
				});
			} catch (error) {
				console.error("Failed to assign agent memory:", error);
			} finally {
				setAssigningMemory((prev) => {
					const newState = { ...prev };
					delete newState[loadingKey];
					return newState;
				});
			}
		} else {
			setSelectedSubnetsPerAgent((prev) => {
				const agentSubnets = prev[agentId] || new Set<number>();
				const newSet = new Set<number>(agentSubnets);
				newSet.delete(subnetItemId);
				return {
					...prev,
					[agentId]: newSet,
				};
			});
		}
	};

	if (isLoadingSubnets || isLoadingMemoryDetails) {
		return <SubnetSkeletonList />;
	}

	if (isErrorSubnets) {
		return <div>Failed to load subnets.</div>;
	}

	return (
		<div className="w-full">
			<div className="w-full overflow-x-auto scrollbar-thin border border-border rounded-lg">
				<div
					className="pb-8 rounded-lg w-full min-w-fit"
					style={{
						minWidth:
							selectedAgents.length > 0
								? `${280 + selectedAgents.length * 120 + 80}px`
								: "420px",
					}}
				>
					{/* Table Header */}
					<div className="flex border-b border-border p-4 px-6 mb-4 items-center min-w-fit">
						{/* Fixed Subnet Column */}
						<div
							className="text-lg font-semibold w-[200px] flex-shrink-0 sticky left-0 bg-background z-10 pr-4"
							style={{ left: 24 }}
						>
							Subnet
						</div>

						<div className="flex items-center gap-0">
							{selectedAgents.length > 0 &&
								selectedAgents.map((agent) => (
									<div
										key={agent.id}
										className="text-center font-medium text-sm px-2 truncate w-[120px] flex-shrink-0"
										title={agent.name}
									>
										{agent.name}
									</div>
								))}
							<div className="flex justify-center w-[80px] flex-shrink-0">
								<Button
									className="px-4 py-2 hover:bg-sidebar flex items-center gap-2"
									type="button"
									variant="ghost"
									onClick={() => setDialogOpen(true)}
								>
									Add{" "}
									<PlusIcon className="w-4 h-4 text-input-foreground" />
								</Button>
							</div>
						</div>
					</div>

					{/* Subnet Rows */}
					{agentSubnets && agentSubnets.length > 0 ? (
						agentSubnets.map((subnet) => {
							const subnetDetail = subnetDetailsMap.get(
								subnet.unique_id
							);
							const subnetName =
								subnetDetail?.subnet_name || subnet.unique_id;

							return (
								<div
									key={`${subnet.unique_id}-${subnet.itemID}`}
									className="flex p-4 px-6 items-center w-full min-w-fit"
								>
									<div
										className="text-base truncate capitalize w-[200px] flex-shrink-0 sticky left-0 bg-background z-10 pr-4"
										title={subnetName}
										style={{ left: 24 }}
									>
										{subnetName}
									</div>

									{/* Agent Checkboxes */}
									<div className="flex items-center gap-0 w-full">
										{selectedAgents.length > 0 &&
											selectedAgents.map((agent) => {
												const loadingKey = `${agent.id}-${subnet.itemID}`;
												const isLoading =
													assigningMemory[loadingKey];
												const isChecked =
													selectedSubnetsPerAgent[
														agent.id
													]?.has(subnet.itemID) ||
													false;

												return (
													<div
														key={agent.id}
														className="flex justify-center items-center min-h-[32px] w-[120px] flex-shrink-0"
													>
														<Checkbox
															checked={isChecked}
															onCheckedChange={() =>
																handleSubnetToggle(
																	agent.id,
																	subnet.itemID
																)
															}
															disabled={isLoading}
															className={
																isLoading
																	? "opacity-50"
																	: ""
															}
														/>
														{isLoading && (
															<div className="ml-2">
																<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
															</div>
														)}
													</div>
												);
											})}
										{/* Empty space for Add button alignment */}
										<div className="w-[80px] flex-shrink-0"></div>
									</div>
								</div>
							);
						})
					) : (
						<div className="text-center py-8 text-muted-foreground">
							No subnets available for this agent
						</div>
					)}
				</div>
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="min-w-[75%] max-h-[42rem] flex flex-col">
					<DialogHeader>
						<DialogTitle>Add Knowledge</DialogTitle>
						<DialogDescription>
							Select agents from your collection to share
							knowledge with this agent.
						</DialogDescription>
					</DialogHeader>
					<div className="mb-4">
						<Input
							type="text"
							placeholder="Search minted agents..."
							className="w-full px-3 py-2 border rounded focus:outline-none focus:ring"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					<div
						className="flex-1 min-h-0 overflow-y-auto"
						style={{
							scrollbarWidth: "thin",
							scrollbarColor: "#888 #222",
						}}
					>
						{isLoadingMintedAgents && (
							<div className="flex flex-col gap-3 mt-2">
								{Array.from({ length: 5 }).map((_, idx) => (
									<MintedAgentSkeleton key={idx} />
								))}
							</div>
						)}
						{isErrorMintedAgents && (
							<div className="flex justify-center items-center py-8 text-red-400 text-sm">
								Failed to load minted agents.
							</div>
						)}
						{mintedAgentsData &&
							Array.isArray(mintedAgentsData.user_collections) &&
							mintedAgentsData.user_collections.length > 0 && (
								<div className="flex flex-col gap-3 mt-2">
									{mintedAgentsData.user_collections.map(
										(agent: any) => (
											<div
												key={agent.id}
												className={`border border-border rounded-lg shadow-sm hover:shadow-md transition p-4 flex bg-background cursor-pointer ${
													selectedAgents.some(
														(a) => a.id === agent.id
													)
														? "ring-2 ring-blue-500"
														: ""
												}`}
												onClick={() =>
													handleAgentToggle(agent)
												}
											>
												<img
													src={
														agent.image
															? agent.image
															: "/agent-mock.webp"
													}
													alt={agent.name}
													className="w-16 h-16 object-cover rounded-md mr-4"
												/>
												<div className="flex-1 flex flex-col justify-center">
													<div className="font-medium text-foreground text-sm truncate">
														{agent.name}
													</div>
													<div className="text-muted-foreground text-xs mt-1 line-clamp-2">
														{agent.description}
													</div>
												</div>
											</div>
										)
									)}
								</div>
							)}
						{mintedAgentsData &&
							(!Array.isArray(
								mintedAgentsData.user_collections
							) ||
								mintedAgentsData.user_collections.length ===
									0) && (
								<div className="flex justify-center items-center py-8 text-gray-300 text-sm">
									No minted agents found.
								</div>
							)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
