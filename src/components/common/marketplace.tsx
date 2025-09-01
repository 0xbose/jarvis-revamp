"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogClose,
} from "@/components/ui/dialog";
import { Plus, StoreIcon, XIcon, Loader2 } from "lucide-react";
import { useGlobalStore } from "@/stores/global-store";
import { useWallet } from "@/hooks/use-wallet";
import { Agent } from "@/types";
import { getAgents } from "@/controllers/collections/collections.query";
import {
	checkAgentNFTOwnership,
	mintAgentNft,
	getUserAgentNFTIds,
	getAgentIdByAgentAddress,
} from "@/utils/skynetHelper";
import { toast } from "sonner";
import SearchBar from "./search";
import AgentCard from "./agent-card";

interface AgentWithOwnership extends Agent {
	// Removed isOwned property - we'll handle ownership dynamically
}

interface MarketplaceProps {
	disabled?: boolean;
}

export default function Marketplace({ disabled = false }: MarketplaceProps) {
	const [agents, setAgents] = useState<AgentWithOwnership[]>([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
	const { setSelectedAgent, selectedAgent, mode } = useGlobalStore();
	const { skyBrowser, address } = useWallet();

	const [selectedAgentNFTId, setSelectedAgentNFTId] = useState<string>("");
	const [minting, setMinting] = useState<Record<string, boolean>>({});

	// Removed ownership checking - we'll handle this when user tries to select

	const handleMintAgentNft = async (agent: AgentWithOwnership) => {
		if (!agent || !skyBrowser) {
			toast.error(
				"Please select a deployed agent and ensure wallet is connected"
			);
			return;
		}

		if (!agent.is_deployed) {
			toast.error("Only deployed agents can have NFTs minted");
			return;
		}

		setMinting((prev) => ({ ...prev, [agent.agent_address]: true }));
		try {
			const agentData = {
				nft_address: agent.agent_address,
				collection_id: agent.agent_address,
				originalId: agent.id,
			};

			const result = await mintAgentNft(skyBrowser, agentData);

			if (result) {
				toast.success("Agent NFT minted successfully!");

				await new Promise((resolve) => setTimeout(resolve, 2000));

				if (agent.agent_address) {
					const newAgentId = await getAgentIdByAgentAddress(
						agent.agent_address,
						address!,
						skyBrowser
					);

					if (newAgentId) {
						setSelectedAgentNFTId(newAgentId);
					}
				}
			} else {
				toast.error("Failed to mint agent NFT");
			}
		} catch (error) {
			console.error("Error minting agent NFT:", error);
			toast.error("Failed to mint agent NFT");
		} finally {
			setMinting((prev) => ({ ...prev, [agent.agent_address]: false }));
		}
	};

	// Removed checkAgentOwnership function

	const fetchAgents = useCallback(
		async (searchValue: string = "") => {
			setLoading(true);
			setError(null);
			try {
				const data = await getAgents(
					{
						search: searchValue,
						limit: 21,
					},
					skyBrowser || undefined,
					{ address } as any
				);
				const agents = (data?.data?.agents || []).map(
					(agent: Agent) => ({
						...agent,
					})
				);
				setAgents(agents);
			} catch (e) {
				console.error("Error fetching agents:", e);
				setError("Failed to load agents. Please try again.");
				setAgents([]);
			}
			setLoading(false);
		},
		[skyBrowser, address, selectedAgent]
	);

	useEffect(() => {
		if (skyBrowser && address) {
			fetchAgents();
		}
	}, [fetchAgents, skyBrowser, address]);

	useEffect(() => {
		if (selectedAgent && agents.length === 0) {
			const timer = setTimeout(() => {
				fetchAgents();
			}, 100);

			return () => clearTimeout(timer);
		}
	}, [selectedAgent, agents.length, fetchAgents]);

	useEffect(() => {
		if (agents.length > 0) {
			const initialMintingState: Record<string, boolean> = {};
			agents.forEach((agent) => {
				if (agent.agent_address) {
					initialMintingState[agent.agent_address] = false;
				}
			});
			setMinting(initialMintingState);
		}
	}, [agents]);

	const handleSearchChange = (value: string) => {
		setSearch(value);
	};

	const handleSearch = useCallback(
		(searchValue: string) => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			debounceTimerRef.current = setTimeout(() => {
				fetchAgents(searchValue);
			}, 300);
		},
		[fetchAgents]
	);

	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	const handleAgentSelect = async (agent: AgentWithOwnership) => {
		if (!skyBrowser || !address) {
			toast.error("Please connect your wallet first");
			return;
		}

		try {
			// Check if user owns the agent NFT
			const ownsNFT = await checkAgentNFTOwnership(
				agent.agent_address,
				address,
				skyBrowser
			);

			if (ownsNFT) {
				// User owns the agent, select it directly
				setSelectedAgent(agent);
				setIsOpen(false);
				toast.success(`Selected ${agent.name}`);
			} else {
				// User doesn't own the agent, mint it first then select
				await handleMintAgentNft(agent);
				// The minting function will handle selection after successful mint
				setSelectedAgent(agent);
				setIsOpen(false);
			}
		} catch (error) {
			console.error("Error in handleAgentSelect:", error);
			toast.error("Failed to select agent. Please try again.");
		}
	};

	const handleDialogOpenChange = (open: boolean) => {
		if (disabled && open) {
			return;
		}

		setIsOpen(open);

		if (open && selectedAgent && agents.length === 0) {
			fetchAgents();
		}
	};

	return (
		<>
			<Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
				<DialogTrigger asChild>
					<Button
						size="sm"
						className={`w-fit max-w-32  ${
							disabled
								? "cursor-not-allowed opacity-80"
								: "cursor-pointer"
						} ${
							mode === "agent" && !selectedAgent
								? " bg-red-500/20 hover:bg-red-500/15 !text-red-500"
								: selectedAgent
								? "border-[1.5px] border-accent bg-accent/20 hover:bg-accent/25 !text-accent"
								: ""
						} overflow-hidden text-truncate whitespace-nowrap transition-colors`}
						title={selectedAgent ? selectedAgent.name : undefined}
					>
						{selectedAgent ? (
							<span className="block w-full overflow-hidden text-ellipsis text-xs">
								{selectedAgent.name}
							</span>
						) : (
							<Plus />
						)}
					</Button>
				</DialogTrigger>
				<DialogContent className="!w-[92vw] !h-[90svh] !max-h-[900px] !max-w-6xl flex flex-col border-none rounded-3xl pb-6 ">
					<DialogHeader className="absolute top-0 left-0 w-full rounded-t-3xl bg-background z-10 h-16 px-10 flex justify-center">
						<DialogTitle className="flex items-center gap-2">
							<StoreIcon />
							<span className="text-foreground">Marketplace</span>
						</DialogTitle>
						<DialogClose className="absolute right-10">
							<XIcon className="size-6" />
						</DialogClose>
					</DialogHeader>
					<div className="mt-7 px-4 w-full flex flex-col gap-y-4 relative flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-2">
						<div className="flex flex-col gap-y-4 h-full max-h-full mt-3 pt-5">
							<SearchBar
								value={search}
								onChange={handleSearchChange}
								onSearch={handleSearch}
								className="w-96 mx-auto"
								placeholder="Search agents..."
								debounceTime={300}
							/>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3  pb-4">
								{loading ||
								(selectedAgent && agents.length === 0) ? (
									<div className="col-span-full flex justify-center items-center py-8">
										<Loader2 className="size-6 animate-spin text-muted-foreground" />
										{selectedAgent &&
											agents.length === 0 && (
												<span className="ml-2 text-sm text-muted-foreground">
													Loading agents for{" "}
													{selectedAgent.name}...
												</span>
											)}
									</div>
								) : error ? (
									<div className="col-span-full text-center text-red-500 py-8">
										{error}
									</div>
								) : agents.length === 0 ? (
									<div className="col-span-full text-center text-muted-foreground py-8">
										{search
											? "No agents found matching your search."
											: "No agents available."}
									</div>
								) : (
									agents.map((agent: AgentWithOwnership) => {
										const isSelected = !!(
											selectedAgent &&
											selectedAgent.id === agent.id
										);

										return (
											<AgentCard
												key={agent.id}
												name={agent.name}
												description={agent.description}
												owned={false} // Always false - we handle ownership in select logic
												isSelected={isSelected}
												onSelect={() =>
													handleAgentSelect(agent)
												}
												onMint={() =>
													handleMintAgentNft(agent)
												}
												minting={
													minting[
														agent.agent_address
													] || false
												}
												checkingOwnership={false} // Always false since we removed ownership checking
											/>
										);
									})
								)}
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
