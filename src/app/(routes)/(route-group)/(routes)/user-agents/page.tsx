"use client";

import { useState, useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/use-wallet";
import { getUserMintedAgents } from "@/controllers/agents/agents.query";
import { QUERY_KEYS } from "@/utils/query-keys";
import AgentMarketplaceCard from "@/components/market-place/agent-marketplace-card";
import SearchAndCategories from "@/components/market-place/agent-search";
import Link from "next/link";
import { UserAgentCollection } from "@/types/agents";
import AgentCardSkeleton from "@/components/market-place/agent-card-skeleton";

export default function UserAgentsPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string | "all">(
		"all"
	);
	const { address } = useWallet();
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
		queryKey: [QUERY_KEYS.USER_AGENTS, searchQuery, selectedCategory],
		queryFn: async ({ pageParam = 0 }) => {
			try {
				const data = await getUserMintedAgents({
					address: address!,
					search: searchQuery,
					limit: 20,
					offset: pageParam,
					isVerified:
						selectedCategory === "verified"
							? true
							: selectedCategory === "unverified"
							? false
							: undefined,
				});
				return data;
			} catch (error) {
				console.error("Error fetching user agents:", error);
				throw error;
			}
		},
		getNextPageParam: (lastPage, allPages) => {
			const pagination = lastPage?.pagination;
			if (pagination && pagination.hasNext) {
				// Calculate next offset based on current offset + limit
				const currentOffset = allPages.length * 20;
				return currentOffset;
			}
			return undefined;
		},
		initialPageParam: 0,
		enabled: !!address,
	});

	const collections =
		data?.pages?.flatMap((page) =>
			(page?.user_collections || []).map(
				(collection: UserAgentCollection) => ({
					...collection,
				})
			)
		) || [];

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
			{
				rootMargin: "100px",
			}
		);

		if (loadMoreRef.current) {
			observer.observe(loadMoreRef.current);
		}

		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	useEffect(() => {
		if (address) {
			refetch();
		}
	}, [address, refetch]);

	const showSkeleton =
		isLoading ||
		(!isFetched && !error) ||
		(isFetched && collections.length === 0 && isFetchingNextPage);

	return (
		<div className="h-full w-full bg-background">
			<div className="relative border-b border-border/40">
				<div className="container mx-auto px-6 py-8 max-w-7xl">
					<div className="flex flex-col lg:flex-row items-start justify-between gap-8">
						<div className="space-y-4">
							<h1 className="text-4xl font-bold text-foreground tracking-tight">
								AI Agent Fleet
							</h1>
							<p className="text-muted-foreground text-lg max-w-2xl">
								View and manage your personal AI agents.
							</p>
						</div>
					</div>
				</div>
			</div>

			<div className="container mx-auto px-6 py-6 max-w-7xl">
				<div className="space-y-6">
					<div className="space-y-4">
						<SearchAndCategories
							onSearch={setSearchQuery}
							onCategorySelect={setSelectedCategory}
							isDashboard={false}
						/>
						{collections.length > 0 && (
							<div className="text-sm text-muted-foreground">
								Showing {collections.length} agents
								{data?.pages[0]?.pagination?.total && (
									<span>
										{" "}
										of {data.pages[0].pagination.total}{" "}
										total
									</span>
								)}
							</div>
						)}
					</div>

					<div className="space-y-6 overflow-y-auto">
						{error ? (
							<div className="flex flex-col items-center justify-center py-20">
								<div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-6">
									<div className="w-12 h-12 text-red-600">
										⚠️
									</div>
								</div>
								<h3 className="text-xl font-semibold text-foreground mb-2">
									Error Loading Agents
								</h3>
								<p className="text-muted-foreground mb-6">
									There was an error loading your agents.
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
							<div className="flex flex-col items-center justify-center py-20">
								<h3 className="text-xl font-semibold text-foreground mb-2">
									No agents found
								</h3>
								<p className="text-muted-foreground mb-6">
									You haven&apos;t minted any agents yet.
								</p>
								<Link
									href="/marketplace"
									className="px-5 py-2 rounded-md bg-primary text-white font-medium hover:bg-primary/90 transition"
								>
									Mint Agent
								</Link>
							</div>
						) : (
							<>
								<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
									{collections.map((collection) => (
										<AgentMarketplaceCard
											key={collection.id}
											agent={collection}
											isUserAgent={true}
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
