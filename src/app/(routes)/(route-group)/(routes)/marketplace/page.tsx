"use client";
import SearchAndCategories from "@/components/market-place/agent-search";
import AgentDialog from "@/components/market-place/agent-dialog";
import { useState } from "react";
import { getAgents } from "@/controllers/collections/collections.query";
import { useQuery } from "@tanstack/react-query";
import AgentMarketplaceCard from "@/components/market-place/agent-marketplace-card";


export default function MarketPlacePage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<any | "all">(
		"all"
	);


	const {
		data: collections = [],
		isLoading: loading,
		error,
		refetch: fetchAgents,
	} = useQuery({
		queryKey: ["marketplace-collections", searchQuery],
		queryFn: async () => {
			const data = await getAgents({
				search: searchQuery,
				limit: 20,
				offset: 0,
			});
			const collections = (data?.data?.agents || []).map((collection: any) => ({
				...collection,
			}));
			return collections;
		},
		staleTime: 5 * 60 * 1000,
		retry: 3,
	});

	return (
		<div className="h-full w-full bg-background">
			{/* Hero Section */}
			<div className="relative border-b border-border/40">
				<div className="container mx-auto px-6 py-8 max-w-7xl">
					<div className="flex flex-col lg:flex-row items-start justify-between gap-8">
						<div className="space-y-4">
							<h1 className="text-4xl font-bold text-foreground tracking-tight">
								Marketplace
							</h1>
							<p className="text-muted-foreground text-lg max-w-2xl">
								Explore and Mint Agents from the Marketplace.
							</p>
						</div>
						<div className="flex-shrink-0">
							<AgentDialog />
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="container mx-auto px-6 py-6 max-w-7xl">
				<div className="space-y-6">
					{/* Search and Filters */}
					<div className="space-y-4">
						<SearchAndCategories
							onSearch={setSearchQuery}
							onCategorySelect={setSelectedCategory}
							isDashboard={false}
						/>
					</div>

					{/* Agents Grid */}
					<div className="space-y-6 overflow-y-auto ">
						{loading ? (
							<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{Array.from({ length: 8 }).map((_, i) => (
									<div key={i} className="bg-background/50 border border-border/40 rounded-xl p-6 animate-pulse">
										<div className="space-y-4">
											<div className="w-full h-32 bg-muted/30 rounded-lg" />
											<div className="space-y-2">
												<div className="h-4 bg-muted/30 rounded w-3/4" />
												<div className="h-3 bg-muted/30 rounded w-full" />
												<div className="h-3 bg-muted/30 rounded w-2/3" />
											</div>
										</div>
									</div>
								))}
							</div>
						) : collections.length === 0 ? (
							<div className="text-center py-16">
								<div className="w-24 h-24 mx-auto bg-muted/30 rounded-full flex items-center justify-center mb-6">
									<div className="w-12 h-12 text-muted-foreground">
										🤖
									</div>
								</div>
								<h3 className="text-xl font-semibold text-foreground mb-2">No Agents Yet</h3>
								<p className="text-muted-foreground max-w-md mx-auto mb-6">
									Get started by creating your first AI agent. Deploy it across multiple platforms 
									and watch it work for you 24/7.
								</p>
								<AgentDialog />
							</div>
						) : (
							<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
									{collections.map((collection) => (
									<AgentMarketplaceCard key={collection.id} agent={collection} />
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
