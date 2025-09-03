"use client";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Sparkles, Zap } from "lucide-react";
import React, { useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Command,
	CommandInput,
	CommandList,
} from "@/components/ui/command";
import { Textarea } from "../ui/textarea";
import { useWallet } from "@/hooks/use-wallet";
import { Label } from "../ui/label";

interface Agent {
	id: string;
	name: string;
	description: string;
	is_deployed: boolean;
	created_at: string;
	updated_at: string;
	agent_address: string;
}

export default function AgentDialog() {
	const [isOpen, setIsOpen] = useState(false);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
	const { skyBrowser, address } = useWallet();

	// const {
	// 	data: agents = [],
	// 	isLoading: loading,
	// 	error,
	// } = useQuery({
	// 	queryKey: [QUERY_KEYS.AGENTS, searchQuery],
	// 	queryFn: async () => {
	// 		const data = await getAgents(
	// 			{
	// 				search: searchQuery,
	// 				limit: 20,
	// 			},
	// 			skyBrowser || undefined,
	// 			{ address } as any
	// 		);
	// 		const agents = (data?.data?.agents || []).map((agent: Agent) => ({
	// 			...agent,
	// 		}));
	// 		return agents as Agent[];
	// 	},
	// 	staleTime: 5 * 60 * 1000,
	// 	retry: 3,
	// });

	const handleDialogOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setSelectedAgent(null);
			setSearchQuery("");
		}
	};

	const handleAgentSelect = (agent: Agent) => {
		setSelectedAgent(agent);
		setPopoverOpen(false);
	};

	return (
		<>
			<Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
				<DialogTrigger asChild>
					<Button
						className="h-12 px-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200"
						title="Create Agent"
					>
						<Sparkles className="w-4 h-4" />
						Create Agent
					</Button>
				</DialogTrigger>
				<DialogContent className="w-[90vw] max-w-2xl h-[80vh] max-h-[685px] flex flex-col border border-border/40 rounded-2xl p-0 bg-background">
					<DialogHeader className="relative border-b border-border/40 p-6">
						<DialogTitle className="flex items-center gap-3 text-xl font-semibold">
							<div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center">
								<Zap className="w-4 h-4 text-primary" />
							</div>
							<span className="text-foreground">Create New Agent</span>
						</DialogTitle>
					</DialogHeader>
					<div className="p-4 flex flex-col gap-6 flex-1 min-h-0">
						<div className="space-y-3">
							<Label className="text-sm font-medium text-foreground">Select Agent Template</Label>
							<Popover
								open={popoverOpen}
								onOpenChange={setPopoverOpen}
							>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										role="combobox"
										aria-expanded={popoverOpen}
										className="w-full justify-between h-14 text-left bg-background/50 border-border/60 hover:bg-muted/30 rounded-xl"
									>
										<div className="flex items-center gap-3">
											{selectedAgent && (
												<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
											)}
											<span className={selectedAgent ? "text-foreground font-medium" : "text-muted-foreground"}>
												{selectedAgent ? selectedAgent.name : "Choose an agent template to get started..."}
											</span>
										</div>
										<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-[450px] p-0 border-border/60 rounded-xl shadow-lg" align="start">
									<Command className="w-full rounded-xl">
										<CommandInput
											placeholder="Search agent templates..."
											value={searchQuery}
											onValueChange={setSearchQuery}
											className="border-0 border-b border-border/40 rounded-none"
										/>
										<CommandList className="w-full max-h-[300px] overflow-y-auto scrollbar-thin">
											{/* {loading ? (
												<div className="p-4 space-y-3">
													<Skeleton className="h-16 w-full rounded-lg" />
													<Skeleton className="h-16 w-full rounded-lg" />
													<Skeleton className="h-16 w-full rounded-lg" />
												</div>
											) : (
												<>
													<CommandEmpty>
														<div className="p-8 text-center">
															<div className="w-12 h-12 mx-auto bg-muted/30 rounded-full flex items-center justify-center mb-4">
																<Atom className="w-6 h-6 text-muted-foreground" />
															</div>
															<div className="text-sm text-muted-foreground">
																No agent templates found
															</div>
														</div>
													</CommandEmpty>
													<CommandGroup className="p-2">
														{agents.map((agent) => (
															<CommandItem
																key={agent.id}
																value={agent.name}
																onSelect={() =>
																	handleAgentSelect(agent)
																}
																className="rounded-lg cursor-pointer hover:bg-muted/30 data-[selected=true]:bg-muted/50 mb-2"
															>
																<div className="flex items-start gap-3 w-full">
																	<div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
																		<Zap className="w-4 h-4 text-primary" />
																	</div>
																	<div className="flex-1 min-w-0">
																		<div className="flex items-center gap-2 mb-1">
																			<span className="font-semibold text-foreground truncate">
																				{agent.name}
																			</span>
																			{selectedAgent?.id === agent.id && (
																				<Check className="w-4 h-4 text-green-500 flex-shrink-0" />
																			)}
																		</div>
																		<p className="text-sm text-muted-foreground line-clamp-1 leading-relaxed">
																			{agent.description}
																		</p>
																	</div>
																</div>
															</CommandItem>
														))}
													</CommandGroup>
												</>
											)} */}
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
						</div>
						<div className="space-y-6 flex-1">
							<div className="space-y-3 flex-1">
								<Label className="text-sm font-medium text-foreground">Agent Description</Label>
								<div className="relative flex-1">
									<Textarea
										placeholder="Select an agent template above to view its description and capabilities..."
										className="min-h-[300px] bg-background/50 border-border/60 resize-none rounded-xl p-4 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-0"
										value={selectedAgent?.description || ""}
										readOnly
									/>
									{selectedAgent && (
										<div className="absolute top-3 right-3">
											<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Footer */}
						<div className="flex gap-3 pt-6 border-t border-border/40">
							<Button
								variant="outline"
								className="flex-1 h-12 border-border/60 hover:bg-muted/30"
								onClick={() => handleDialogOpenChange(false)}
							>
								Cancel
							</Button>
							<Button
								className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200"
								disabled={!selectedAgent}
							>
								<Sparkles className="w-4 h-4 mr-2" />
								Mint Agent
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
