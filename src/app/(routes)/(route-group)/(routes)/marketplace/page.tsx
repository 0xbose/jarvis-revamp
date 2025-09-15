"use client";
import SearchAndCategories from "@/components/market-place/agent-search";
import { useState, useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import AgentMarketplaceCard from "@/components/market-place/agent-marketplace-card";
import { getCollections } from "@/controllers/collections/collections.query";
import { QUERY_KEYS } from "@/utils/query-keys";
import { CollectionAgent, CollectionAgentsResponse } from "@/types/collection";
import AgentCardSkeleton from "@/components/market-place/agent-card-skeleton";

export default function MarketPlacePage() {
	const [searchQuery, setSearchQuery] = useState("");
	const loadMoreRef = useRef<HTMLDivElement>(null);

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		error,
		refetch,
		isFetched,
	} = useInfiniteQuery({
		queryKey: [QUERY_KEYS.MARKETPLACE_COLLECTIONS, searchQuery],
		queryFn: async ({ pageParam = 0 }) => {
			const data = await getCollections({
				search: searchQuery,
				limit: 20,
				offset: pageParam,
			});
			return data;
		},
		getNextPageParam: (lastPage, allPages) => {
			const pagination = lastPage?.data?.pagination;
			if (pagination && pagination.hasNext) {
				// Calculate next offset based on current offset + limit
				const currentOffset = allPages.length * 20;
				return currentOffset;
			}
			return undefined;
		},
		initialPageParam: 0,
	});

	const collections =
		data?.pages?.flatMap((page) => {
			const agents =
				page?.data?.agents ||
				(page as unknown as CollectionAgentsResponse)?.data?.agents ||
				[];
			return agents.map((collection: CollectionAgent) => ({
				...collection,
			}));
		}) || [];

	useEffect(() => {
		if (!hasNextPage || isFetchingNextPage) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const target = entries[0];
				if (
					target.isIntersecting &&
					hasNextPage &&
					!isFetchingNextPage
				) {
					fetchNextPage();
				}
			},
			{ rootMargin: "100px" }
		);

		if (loadMoreRef.current) {
			observer.observe(loadMoreRef.current);
		}

		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	// Show skeletons if loading or if not fetched yet and not errored
	const showSkeleton =
		isLoading ||
		(!isFetched && !error) ||
		(isFetched && collections.length === 0 && isFetchingNextPage);

	return (
		<div className="h-full w-full bg-background">
			{/* Hero Section */}
			<div className="relative border-b border-border/40">
				<div className="py-8">
					<div className="flex flex-col lg:flex-row items-start justify-between gap-8">
						<div className="space-y-4">
							<h1 className="text-4xl font-bold text-foreground tracking-tight">
								Marketplace
							</h1>
							<p className="text-muted-foreground text-lg max-w-2xl">
								Explore and Mint Agents from the Marketplace.
							</p>
						</div>
						<div className="flex-shrink-0"></div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="py-6">
				<div className="space-y-6">
					<div className="space-y-4">
						<SearchAndCategories
							onSearch={setSearchQuery}
							onCategorySelect={() => {}}
							isDashboard={false}
							hideCategory={true}
						/>
						{collections.length > 0 && (
							<div className="text-sm text-muted-foreground">
								Showing {collections.length} agents
								{data?.pages[0]?.data?.pagination?.total && (
									<span>
										{" "}
										of {
											data.pages[0].data.pagination.total
										}{" "}
										total
									</span>
								)}
							</div>
						)}
					</div>

					<div className="space-y-6 overflow-y-auto">
						{error ? (
							<div className="text-center py-16">
								<div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-6">
									<div className="w-12 h-12 text-red-600">
										⚠️
									</div>
								</div>
								<h3 className="text-xl font-semibold text-foreground mb-2">
									Error Loading Agents
								</h3>
								<p className="text-muted-foreground max-w-md mx-auto mb-6">
									There was an error loading the agents.
									Please try refreshing the page.
								</p>
								<button
									onClick={() => refetch()}
									className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
								>
									Try Again
								</button>
							</div>
						) : showSkeleton ? (
							<div className="space-y-6 overflow-y-auto">
								<div className="">
									<div className="h-4 bg-skeleton rounded w-48 animate-pulse" />
								</div>
								<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
									{Array.from({ length: 8 }).map((_, i) => (
										<AgentCardSkeleton key={i} />
									))}
								</div>
							</div>
						) : collections.length === 0 ? (
							<div className="text-center py-16">
								<div className="w-24 h-24 mx-auto bg-muted/30 rounded-full flex items-center justify-center mb-6">
									<div className="w-12 h-12 text-muted-foreground">
										🤖
									</div>
								</div>
								<h3 className="text-xl font-semibold text-foreground mb-2">
									No Agents Yet
								</h3>
								<p className="text-muted-foreground max-w-md mx-auto mb-6">
									Get started by creating your first AI agent.
									Deploy it across multiple platforms and
									watch it work for you 24/7.
								</p>
							</div>
						) : (
							<>
								<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
									{collections.map((collection) => (
										<AgentMarketplaceCard
											key={collection.id}
											agent={collection}
											isUserAgent={false}
										/>
									))}
								</div>
								<div
									ref={loadMoreRef}
									className="flex justify-center py-8"
								>
									{hasNextPage ? (
										<div onClick={() => fetchNextPage()}>
											{isFetchingNextPage && (
												<div className="flex items-center space-x-2">
													<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
												</div>
											)}
										</div>
									) : (
										collections.length > 0 && (
											<span className="text-muted-foreground text-sm">
												No more agents to load.
											</span>
										)
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
