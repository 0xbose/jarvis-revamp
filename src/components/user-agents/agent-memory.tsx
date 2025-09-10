"use client";
import React, { useState, useEffect, useCallback } from "react";
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
import {
	upsertNodeContextMemory,
	upsertMemoryRecall,
	deleteNodeContextMemory,
	deleteMemoryRecall,
} from "@/controllers/node-context/node-context.mutations";
import { getNodeContextMemory } from "@/controllers/node-context/node-context.query";
import { getMemoryRecall } from "@/controllers/node-context/node-context.query";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";

interface MemoryType {
	id: string;
	item_id?: string; // Optional for memory recall which doesn't have specific item_id
	agent_collection: {
		agentAddress: string;
		agentID: string;
	};
	agentDetails?: any;
}

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
	const [masterNodeSelections, setMasterNodeSelections] = useState<
		Record<string, Set<number>>
	>({});
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebounce(search, 1000);
	const [assigningMemory, setAssigningMemory] = useState<
		Record<string, boolean>
	>({});

	// Generic hook for memory data
	const useMemoryData = (
		queryKey: string,
		fetchFn: (params: { agentID: string }) => Promise<MemoryType[]>
	) => {
		return useQuery({
			queryKey: [queryKey, agentData.id],
			queryFn: async () => {
				console.log(`🔍 Fetching ${queryKey} for agent:`, agentData.id);
				const memories = await fetchFn({ agentID: agentData.id });
				console.log(`📝 Got ${memories.length} memories:`, memories);

				const memoriesWithAgentDetails = await Promise.all(
					memories.map(async (memory) => {
						try {
							const { agentAddress, agentID: nftId } =
								memory.agent_collection;
							console.log(
								`🔄 Fetching agent details for memory ${memory.id}: ${agentAddress}/${nftId}`
							);
							const agentDetails =
								await getAgentDetailByCollectionAndNftId(
									agentAddress,
									nftId
								);
							console.log(
								`✅ Got agent details for memory ${memory.id}:`,
								agentDetails?.name
							);
							return { ...memory, agentDetails };
						} catch (error) {
							console.error(
								`❌ Failed to fetch agent details for memory ${memory.id}:`,
								error
							);
							console.error(
								`❌ Collection: ${memory.agent_collection.agentAddress}, NFT ID: ${memory.agent_collection.agentID}`
							);
							return { ...memory, agentDetails: null };
						}
					})
				);

				const successfulFetches = memoriesWithAgentDetails.filter(
					(m) => m.agentDetails
				).length;
				console.log(
					`📊 Successfully fetched ${successfulFetches}/${memoriesWithAgentDetails.length} agent details`
				);
				return memoriesWithAgentDetails;
			},
			enabled: !!agentData.id,
			staleTime: 0, // Always refetch to ensure fresh data on reload
			gcTime: 0, // Don't cache to avoid stale data issues
			refetchOnMount: "always",
			refetchOnWindowFocus: true,
		});
	};

	const {
		data: memoryDetails,
		isLoading: isLoadingMemoryDetails,
		refetch: refetchMemoryDetails,
	} = useMemoryData("agentMemoryDetails", getNodeContextMemory);

	const {
		data: memoryRecallDetails,
		isLoading: isLoadingMemoryRecallDetails,
		refetch: refetchMemoryRecallDetails,
	} = useMemoryData("memoryRecallDetails", getMemoryRecall);

	// Get agent subnets before processMemoryData to avoid hoisting issues
	const agentSubnets: AgentSubnet[] = agentData?.subnet_list || [];

	// Process memory data into state
	const processMemoryData = useCallback(
		(
			memories: MemoryType[],
			setterFn: React.Dispatch<
				React.SetStateAction<Record<string, Set<number>>>
			>,
			isMemoryRecall: boolean = false
		) => {
			console.log(
				`🔄 Processing ${
					memories?.length || 0
				} memories (isMemoryRecall: ${isMemoryRecall})`
			);
			if (!memories?.length) {
				console.log("❌ No memories to process");
				return;
			}

			const agentsFromMemory: SelectedAgent[] = [];
			const subnetsFromMemory: Record<string, Set<number>> = {};

			memories.forEach((memory) => {
				console.log(`🔍 Processing memory ${memory.id}:`, {
					hasAgentDetails: !!memory.agentDetails,
					agentAddress: memory.agent_collection.agentAddress,
					agentID: memory.agent_collection.agentID,
					agentName: memory.agentDetails?.name,
					itemId: memory.item_id,
					isMemoryRecall,
				});

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

					if (!agentsFromMemory.some((a) => a.id === agentId)) {
						agentsFromMemory.push(agent);
						subnetsFromMemory[agentId] = new Set();
						console.log(
							`✅ Added agent to memory: ${agent.name} (${agentId})`
						);
					}

					if (isMemoryRecall) {
						// For memory recall (master), add all subnets for this agent
						agentSubnets.forEach((subnet) => {
							if (!subnetsFromMemory[agentId]) {
								subnetsFromMemory[agentId] = new Set();
							}
							subnetsFromMemory[agentId].add(subnet.itemID);
						});
						console.log(
							`🎯 Added all ${agentSubnets.length} subnets for master agent: ${agent.name}`
						);
					} else {
						// For regular memory, use the specific item_id
						if (memory.item_id) {
							const subnetItemId = parseInt(memory.item_id);
							if (!isNaN(subnetItemId)) {
								if (!subnetsFromMemory[agentId]) {
									subnetsFromMemory[agentId] = new Set();
								}
								subnetsFromMemory[agentId].add(subnetItemId);
							}
						}
					}
				} else {
					console.log(
						`❌ Memory ${memory.id} has no agent details - will not be displayed`
					);
				}
			});

			console.log(
				`📊 Found ${agentsFromMemory.length} valid agents from memories`
			);

			// Update selected agents
			setSelectedAgents((prev) => {
				const existingIds = new Set(prev.map((a) => a.id));
				const newAgents = agentsFromMemory.filter(
					(a) => !existingIds.has(a.id)
				);
				console.log(
					`🔄 Adding ${newAgents.length} new agents to state`
				);
				return [...prev, ...newAgents];
			});

			// Update subnet selections
			setterFn((prev) => {
				const updated = { ...prev };
				Object.entries(subnetsFromMemory).forEach(
					([agentId, subnets]) => {
						if (updated[agentId]) {
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
		},
		[agentSubnets]
	);

	useEffect(() => {
		if (memoryDetails) {
			processMemoryData(memoryDetails, setSelectedSubnetsPerAgent, false);
		}
	}, [memoryDetails, processMemoryData]);

	useEffect(() => {
		if (memoryRecallDetails) {
			console.log(
				"🎯 Processing memory recall details:",
				memoryRecallDetails
			);
			processMemoryData(
				memoryRecallDetails,
				setMasterNodeSelections,
				true
			);
		} else {
			console.log("❌ No memory recall details to process");
		}
	}, [memoryRecallDetails, processMemoryData]);

	// Remove automatic refetching when dialog opens
	// Data will be fresh from the initial query and mutations will update it
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
		staleTime: 10 * 60 * 1000, // 10 minutes - subnets don't change frequently
		gcTime: 15 * 60 * 1000, // 15 minutes
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
		],
		queryFn: async () => {
			return getUserMintedAgents({
				address: agentData.user_address,
				search: debouncedSearch,
			});
		},
		enabled: dialogOpen && !!agentData.user_address,
		staleTime: 5 * 60 * 1000,
		gcTime: 5 * 60 * 1000,
		retry: 1,
	});

	// Helper functions
	const agentHasAnySubnetSelected = useCallback(
		(agentId: string) => {
			const set = selectedSubnetsPerAgent[agentId];
			const masterSet = masterNodeSelections[agentId];
			return (set && set.size > 0) || (masterSet && masterSet.size > 0);
		},
		[selectedSubnetsPerAgent, masterNodeSelections]
	);

	const createPayload = useCallback(
		(agent: SelectedAgent, subnetItemId: number) => ({
			agent_id: agentData.id,
			agentCollection: {
				agentAddress: agent.collection_address,
				agentID: agent.nft_id,
			},
			item_id: subnetItemId.toString(),
		}),
		[agentData.id]
	);

	const handleAgentToggle = useCallback(
		(agent: any) => {
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
					// Only allow deselect if no subnet is selected for this agent
					if (agentHasAnySubnetSelected(selectedAgent.id)) {
						return prev; // Prevent deselect
					}
					// Remove agent and its subnet selections
					setSelectedSubnetsPerAgent((prevSubnets) => {
						const newSubnets = { ...prevSubnets };
						delete newSubnets[selectedAgent.id];
						return newSubnets;
					});
					setMasterNodeSelections((prevMaster) => {
						const newMaster = { ...prevMaster };
						delete newMaster[selectedAgent.id];
						return newMaster;
					});
					return prev.filter((a) => a.id !== selectedAgent.id);
				} else {
					// Add agent
					setSelectedSubnetsPerAgent((prevSubnets) => ({
						...prevSubnets,
						[selectedAgent.id]: new Set(),
					}));
					setMasterNodeSelections((prevMaster) => ({
						...prevMaster,
						[selectedAgent.id]: new Set(),
					}));
					return [...prev, selectedAgent];
				}
			});
		},
		[agentHasAnySubnetSelected]
	);

	const handleToggle = useCallback(
		async (
			agentId: string,
			subnetItemId: number,
			isMaster: boolean = false
		) => {
			const agent = selectedAgents.find((a) => a.id === agentId);
			if (!agent) return;

			const stateSelector = isMaster
				? masterNodeSelections
				: selectedSubnetsPerAgent;
			const stateSetter = isMaster
				? setMasterNodeSelections
				: setSelectedSubnetsPerAgent;

			const isCurrentlySelected =
				stateSelector[agentId]?.has(subnetItemId) || false;
			const loadingKey = `${
				isMaster ? "master-" : ""
			}${agentId}-${subnetItemId}`;

			setAssigningMemory((prev) => ({ ...prev, [loadingKey]: true }));

			try {
				if (!isCurrentlySelected) {
					if (isMaster) {
						const payload = {
							agent_id: agentData.id,
							agentCollection: {
								agentAddress: agent.collection_address,
								agentID: agent.nft_id,
							},
						};
						await upsertMemoryRecall(payload);
					} else {
						const payload = createPayload(agent, subnetItemId);
						await upsertNodeContextMemory(payload);
					}

					stateSetter((prev) => {
						const agentSelections =
							prev[agentId] || new Set<number>();
						const newSet = new Set<number>(agentSelections);
						newSet.add(subnetItemId);
						return { ...prev, [agentId]: newSet };
					});

					// Refetch data to ensure UI is in sync with server
					if (isMaster) {
						refetchMemoryRecallDetails();
					} else {
						refetchMemoryDetails();
					}
				} else {
					if (isMaster) {
						await deleteMemoryRecall({
							agent_id: agentData.id,
							itemID: subnetItemId.toString(),
						});
					} else {
						await deleteNodeContextMemory({
							agent_id: agentData.id,
							itemID: subnetItemId.toString(),
						});
					}

					stateSetter((prev) => {
						const agentSelections =
							prev[agentId] || new Set<number>();
						const newSet = new Set<number>(agentSelections);
						newSet.delete(subnetItemId);
						return { ...prev, [agentId]: newSet };
					});

					if (isMaster) {
						refetchMemoryRecallDetails();
					} else {
						refetchMemoryDetails();
					}
				}
			} catch (error) {
				console.error(
					`Failed to ${!isCurrentlySelected ? "assign" : "delete"} ${
						isMaster ? "master node" : "agent"
					} memory:`,
					error
				);
			} finally {
				setAssigningMemory((prev) => {
					const newState = { ...prev };
					delete newState[loadingKey];
					return newState;
				});
			}
		},
		[
			selectedAgents,
			masterNodeSelections,
			selectedSubnetsPerAgent,
			createPayload,
			agentData.id,
		]
	);

	const handleSubnetToggle = useCallback(
		(agentId: string, subnetItemId: number) => {
			return handleToggle(agentId, subnetItemId, false);
		},
		[handleToggle]
	);

	const handleMasterNodeToggle = useCallback(
		(agentId: string, subnetItemId: number) => {
			return handleToggle(agentId, subnetItemId, true);
		},
		[handleToggle]
	);

	const handleMasterAllToggle = useCallback(
		async (agentId: string) => {
			if (!agentSubnets.length) return;

			const agent = selectedAgents.find((a) => a.id === agentId);
			if (!agent) return;

			const currentMasterSelections =
				masterNodeSelections[agentId] || new Set();
			const shouldSelectAll = currentMasterSelections.size === 0;
			const loadingKey = `master-${agentId}-all`;

			setAssigningMemory((prev) => ({ ...prev, [loadingKey]: true }));

			try {
				if (shouldSelectAll) {
					const payload = {
						agent_id: agentData.id,
						agentCollection: {
							agentAddress: agent.collection_address,
							agentID: agent.nft_id,
						},
					};
					await upsertMemoryRecall(payload);

					setMasterNodeSelections((prev) => {
						const allSubnetIds = new Set(
							agentSubnets.map((subnet) => subnet.itemID)
						);
						return { ...prev, [agentId]: allSubnetIds };
					});

					refetchMemoryRecallDetails();
				} else {
				
					await deleteMemoryRecall({
						agent_id: agentData.id,
					});

					setMasterNodeSelections((prev) => ({
						...prev,
						[agentId]: new Set(),
					}));

					// Refetch data to ensure UI is in sync with server
					refetchMemoryRecallDetails();
				}
			} catch (error) {
				console.error(
					`Failed to ${
						shouldSelectAll ? "assign" : "delete"
					} master memory for all subnets:`,
					error
				);
			} finally {
				setAssigningMemory((prev) => {
					const newState = { ...prev };
					delete newState[loadingKey];
					return newState;
				});
			}
		},
		[agentSubnets, selectedAgents, masterNodeSelections, agentData.id]
	);

	if (
		isLoadingSubnets ||
		isLoadingMemoryDetails ||
		isLoadingMemoryRecallDetails
	) {
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
								? `${280 + selectedAgents.length * 240 + 80}px`
								: "420px",
					}}
				>
					{/* Table Header */}
					<div className="flex border-b border-border p-4 px-6 mb-4 items-center min-w-fit">
						<div
							className="text-lg font-semibold w-[200px] flex-shrink-0 sticky left-0 bg-background z-20 pr-4 pl-6"
							style={{
								left: 0,
								backgroundImage: 'linear-gradient(to right, var(--background) 85%, transparent 100%)',
							}}
						>
							Subnet
						</div>

						<div className="flex items-center gap-0">
							{selectedAgents.map((agent) => (
								<div
									key={agent.id}
									className="text-center font-medium text-sm pl-6 px-2 truncate w-[260px] flex-shrink-0 flex items-center"
									title={agent.name}
								>
									<div className="flex flex-col w-full">
										<span className="w-[220px] truncate">
											{agent.name}
										</span>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="hover:bg-gray/80 ml-2"
									>
										<MoreVerticalIcon />
									</Button>
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

					{/* Master Row */}
					<div className="flex p-4 px-6 items-center w-full min-w-fit">
						<div
							className="text-base font-medium capitalize w-[200px] flex-shrink-0 sticky left-0 bg-background z-20 pr-4 pl-6"
							style={{	
								left: 0,
								backgroundImage: 'linear-gradient(to right, var(--background) 85%, transparent 100%)',
							}}
						>
							Master Agent
						</div>

						<div className="flex items-center gap-0 w-full">
							{selectedAgents.map((agent) => {
								const masterLoadingKey = `master-${agent.id}-all`;
								const isMasterLoading =
									assigningMemory[masterLoadingKey];
								const isMasterChecked =
									masterNodeSelections[agent.id]?.size > 0;

								return (
									<div
										key={agent.id}
										className="flex justify-center items-center min-h-[32px] w-[260px] flex-shrink-0 px-6"
										// Prevent checkbox wiggle by using a fixed width for the loading spinner container
										style={{ position: "relative" }}
									>
										<div className="flex items-center justify-center" style={{ width: "100%" }}>
											<Checkbox
												checked={isMasterChecked}
												onCheckedChange={() =>
													handleMasterAllToggle(agent.id)
												}
												disabled={isMasterLoading}
												className={
													isMasterLoading
														? "opacity-50"
														: ""
												}
												title={`Set ${agent.name} as master for all subnets`}
											/>
											{/* Reserve space for spinner to prevent layout shift */}
											<span style={{ display: "inline-block", width: 18, marginLeft: 8 }}>
												{isMasterLoading && (
													<span>
														<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
													</span>
												)}
											</span>
										</div>
									</div>
								);
							})}
							<div className="w-[80px] flex-shrink-0"></div>
						</div>
					</div>

					{/* Subnet Rows */}
					{agentSubnets?.length > 0 ? (
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
										className="text-base truncate capitalize w-[200px] flex-shrink-0 sticky left-0 bg-background z-20 pr-4 pl-6"
										title={subnetName}
										style={{
											left: 0,
											backgroundImage: 'linear-gradient(to right, var(--background) 85%, transparent 100%)',
										}}
									>
										{subnetName} agent
									</div>

									<div className="flex items-center gap-0 w-full">
										{selectedAgents.map((agent) => {
											const loadingKey = `${agent.id}-${subnet.itemID}`;
											const isLoading =
												assigningMemory[loadingKey];
											const isChecked =
												selectedSubnetsPerAgent[
													agent.id
												]?.has(subnet.itemID) || false;

											return (
												<div
													key={agent.id}
													className="flex justify-center items-center min-h-[32px] w-[260px] flex-shrink-0 px-6"
													style={{ position: "relative" }}
												>
													<div className="flex items-center justify-center" style={{ width: "100%" }}>
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
															title="Assign agent to this subnet"
														/>
														{/* Reserve space for spinner to prevent layout shift */}
														<span style={{ display: "inline-block", width: 18, marginLeft: 8 }}>
															{isLoading && (
																<span>
																	<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
																</span>
															)}
														</span>
													</div>
												</div>
											);
										})}
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
					<div className="">
						<Input
							type="text"
							placeholder="Search minted agents..."
							className="w-full px-3 py-2 border rounded focus:outline-none focus:ring"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					<div
						className="flex-1 min-h-0 overflow-y-auto px-1"
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
						{mintedAgentsData?.user_collections?.length > 0 && (
							<div className="grid grid-cols-3 gap-3 mt-2">
								{mintedAgentsData.user_collections.map(
									(agent: any) => {
										const isSelected = selectedAgents.some(
											(a) => a.id === agent.id
										);
										const hasAnySubnet =
											isSelected &&
											agentHasAnySubnetSelected(agent.id);

										return (
											<div
												key={agent.id}
												className={`border border-border rounded-lg shadow-sm hover:shadow-md transition p-4 flex bg-background cursor-pointer ${
													isSelected
														? "ring-2 ring-blue-500"
														: ""
												} ${
													isSelected && hasAnySubnet
														? "opacity-60 cursor-not-allowed"
														: ""
												}`}
												onClick={() => {
													if (
														isSelected &&
														hasAnySubnet
													) {
														return;
													}
													handleAgentToggle(agent);
												}}
											>
												<img
													src={
														agent.image ||
														"/agent-mock.webp"
													}
													alt={agent.name}
													className="w-16 h-16 object-cover rounded-md mr-4"
												/>
												<div className="flex-1 flex flex-col justify-center">
													<div className="font-medium text-foreground text-sm line-clamp-2">
														{agent.name} fdaf dfa ffsf da fd
													</div>
													<div className="text-muted-foreground text-xs mt-1 line-clamp-1">
														{agent.description}
													</div>
												</div>
											</div>
										);
									}
								)}
							</div>
						)}
						{mintedAgentsData?.user_collections?.length === 0 && (
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
