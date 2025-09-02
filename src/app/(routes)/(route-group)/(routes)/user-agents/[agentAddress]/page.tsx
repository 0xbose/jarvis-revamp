"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { Clock, Activity, Settings, Zap, Copy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getAgentDetailByCollectionAndNftId } from "@/controllers/agents/agents.query";
import { useParams, usePathname, useSearchParams } from 'next/navigation'

export default function Page() {
  const params = useParams<{ agentAddress: string }>();
  const agentAddress = params.agentAddress;
  const searchParams = useSearchParams();
  const nftId = searchParams.get("nftid") || "";


  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");

  const { data: agentData } = useQuery({
    queryKey: ["user-agents-collection-by-address", agentAddress],
    queryFn: async () => {
      if (!agentAddress) return null;
      const data = await getAgentDetailByCollectionAndNftId(agentAddress, nftId);
      return data || null;
    },
    enabled: !!agentAddress,
    staleTime: 0,
    gcTime: 0,
    retry: 3,
  });

  useEffect(() => {
    if (agentData) {
      setAgentName(agentData.name || "");
      setDescription(agentData.description || "");
    }
  }, [agentData]);

  const handleCopyAddress = useCallback(() => {
    const addressToCopy = agentData?.collection_id || agentData?.id || "";
    navigator.clipboard.writeText(addressToCopy);
  }, [agentData?.collection_id, agentData?.id]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-12 max-w-7xl flex flex-col gap-8">
        <div className="flex flex-col md:flex-row gap-12 items-start justify-between">
          <div className="flex flex-col md:flex-row gap-8 items-start flex-1">
            <div className="relative group">
              <div className="w-48 h-48 relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-border/40 shadow-xl">
                <Image
                  src={agentData?.image || "/agent-mock.webp"}
                  alt="Agent"
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-background shadow-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex-1 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <h1 className="text-4xl font-bold text-foreground tracking-tight">
                    {agentName}
                  </h1>
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-500" />
                    <span>
                      {agentData?.is_deployed ? "Deployed" : "Not Deployed"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span className="capitalize">
                      Updated{" "}
                      {agentData?.updated_at
                        ? new Date(agentData.updated_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span>
                      {agentData?.subnet_list?.length || 0} subnets configured
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
              {[agentData?.collection_id, agentData?.id].map((data) => (
                <div className="space-y-3 pt-3">
                <div className="flex flex-col">
                  <Label
                    htmlFor="collection-id"
                    className="font-medium text-muted-foreground tracking-wide"
                  >
                    {data === agentData?.collection_id ? "Collection Address" : "Agent Address"}
                  </Label>
                  <div className="flex items-center gap-1">
                    <code className="text-sm font-mono text-foreground">
                      {data || "N/A"}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyAddress}
                      className="h-8 w-8 p-0 hover:bg-background/80 active:scale-80 transition-transform duration-100"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              ))}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="description"
              className="text-lg font-semibold text-foreground"
            >
              Agent Description
            </Label>
          </div>
          <div className="relative">
            <div className="min-h-[140px] bg-background/50 border border-border/60 rounded-xl p-6 text-base leading-relaxed">
              {description || "No description provided for this agent."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}