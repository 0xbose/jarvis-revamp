"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/use-wallet";
import { getUserMintedAgents } from "@/controllers/agents/agents.query";
import { QUERY_KEYS } from "@/utils/query-keys";
import AgentMarketplaceCard from "@/components/market-place/agent-marketplace-card";
import SearchAndCategories from "@/components/market-place/agent-search";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UserAgentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<any | "all">("all");
  const { address } = useWallet();

  const {
    data: collections = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [QUERY_KEYS.USER_AGENTS, searchQuery, selectedCategory],
    queryFn: async () => {
      const data = await getUserMintedAgents({
        address: address!,
        search: searchQuery,
        limit: 20,
        offset: 0,
        isVerified: selectedCategory === "verified" ? true : selectedCategory === "unverified" ? false : undefined,
      });
      return (data?.user_collections || []).map((collection: any) => ({
        ...collection,
      }));
    },
    staleTime: 30000,
    gcTime: 30000,
    retry: 3,
  });

  useEffect(() => {
    if (address) {
      refetch();
    }
  }, [address, refetch]);

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
          <div className="space-y-4 flex items-center justify-between">
            <SearchAndCategories
              onSearch={setSearchQuery}
              onCategorySelect={setSelectedCategory}
              isDashboard={false}
            />
          </div>

          <div className="space-y-6 overflow-y-auto">
            {isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-background/50 border border-border/40 rounded-xl p-6 animate-pulse"
                  >
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
              <div className="flex flex-col items-center justify-center py-20">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No agents found
                </h3>
                <p className="text-muted-foreground mb-6">
                  You haven't minted any agents yet.
                </p>
                <Link
                  href="/marketplace"
                  className="px-5 py-2 rounded-md bg-primary text-white font-medium hover:bg-primary/90 transition"
                >
                  Mint Agent
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {collections.map((collection) => (
                  <AgentMarketplaceCard
                    key={collection.id}
                    agent={collection}
                    isUserAgent={true}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
