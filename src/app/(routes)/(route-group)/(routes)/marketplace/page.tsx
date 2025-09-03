"use client";
import SearchAndCategories from "@/components/market-place/agent-search";
import { useState, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import AgentMarketplaceCard from "@/components/market-place/agent-marketplace-card";
import { getCollections } from "@/controllers/collections/collections.query";
import { QUERY_KEYS } from "@/utils/query-keys";

export default function MarketPlacePage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<any | "all">(
		"all"
	);
	const loadMoreRef = useRef<HTMLDivElement>(null);

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading: loading,
		error,
		refetch: fetchAgents,
	} = useInfiniteQuery({
		queryKey: [QUERY_KEYS.MARKETPLACE_COLLECTIONS, searchQuery],
		queryFn: async ({ pageParam = 0 }) => {
			try {
				const data = await getCollections({
					search: searchQuery,
					limit: 20,
					offset: pageParam * 20,
				});
				console.log('Marketplace API response:', data);
				return data;
			} catch (error) {
				console.error('Error fetching collections:', error);
				throw error;
			}
		},
		getNextPageParam: (lastPage) => {
			if (!lastPage) return undefined;
			
			// Marketplace API returns data.data.pagination structure
			const pagination = lastPage?.data?.pagination;
			if (pagination && pagination.hasNext) {
				return pagination.page + 1;
			}
			return undefined;
		},
		initialPageParam: 0,
		staleTime: 0,
		gcTime: 0,
		retry: 3,
	});

	// Flatten all pages data
	const collections = data?.pages?.flatMap(page => {
		// Marketplace API returns data.data.agents structure
		const agents = page?.data?.agents || (page as any)?.agents || [];
		console.log('Page data structure:', { page, agents: agents.length });
		return agents.map((collection: any) => ({
			...collection,
		}));
	}) || [];

	// Intersection Observer for infinite scroll
	useEffect(() => {
		if (!hasNextPage || isFetchingNextPage) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const target = entries[0];
				if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{
				rootMargin: '100px',
			}
		);

		if (loadMoreRef.current) {
			observer.observe(loadMoreRef.current);
		}

		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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
							hideCategory={true}
						/>
						{collections.length > 0 && (
							<div className="text-sm text-muted-foreground">
								Showing {collections.length} agents
								{data?.pages[0]?.data?.pagination?.total && (
									<span> of {data.pages[0].data.pagination.total} total</span>
								)}
							</div>
						)}
					</div>

					{/* Agents Grid */}
					<div className="space-y-6 overflow-y-auto ">
						{error ? (
							<div className="text-center py-16">
								<div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-6">
									<div className="w-12 h-12 text-red-600">
										⚠️
									</div>
								</div>
								<h3 className="text-xl font-semibold text-foreground mb-2">Error Loading Agents</h3>
								<p className="text-muted-foreground max-w-md mx-auto mb-6">
									There was an error loading the agents. Please try refreshing the page.
								</p>
								<button
									onClick={() => fetchAgents()}
									className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
								>
									Try Again
								</button>
							</div>
						) : loading ? (
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
							</div>
						) : (
							<>
								<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
									{collections.map((collection) => (
										<AgentMarketplaceCard key={collection.id} agent={collection} isUserAgent={false} />
									))}
								</div>
								
								<div ref={loadMoreRef} className="flex justify-center py-8">
                  {hasNextPage ? (
                    <div
                      onClick={() => fetchNextPage()}>
                      {isFetchingNextPage && (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                  ) : collections.length > 0 && (
                   <span className="text-muted-foreground text-sm">No more agents to load.</span>
                  )}
                </div>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
