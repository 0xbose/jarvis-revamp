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
import { Plus, StoreIcon, XIcon, Loader2, BotIcon } from "lucide-react";
import { useGlobalStore } from "@/stores/global-store";
import { useWallet } from "@/hooks/use-wallet";
import { checkAgentNFTOwnership } from "@/utils/skynetHelper";
import { createMintingHandler, MintingState } from "@/utils/agent-minting";
import { toast } from "sonner";
import SearchBar from "./search";
import AgentCard from "./agent-card";
import { getUserMintedAgents } from "@/controllers/agents/agents.query";
import { useQuery } from "@tanstack/react-query";
import { UserAgentCollection } from "@/types/agents";

interface MarketplaceProps {
  disabled?: boolean;
}

function isUserAgentCollection(obj: any): obj is UserAgentCollection {
  return (
    obj &&
    typeof obj === "object" &&
    "collection_address" in obj &&
    "agent_name" in obj &&
    "agent_description" in obj
  );
}

export default function Marketplace({ disabled = false }: MarketplaceProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { setSelectedAgent, selectedAgent, mode } = useGlobalStore();
  const { skyBrowser, address } = useWallet();
  const [selectedAgentNFTId, setSelectedAgentNFTId] = useState<string>("");
  const [minting, setMinting] = useState<MintingState>({});

  // Fetch agents
  const {
    data: agentsData,
    isLoading: loading,
    error,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: ["userMintedAgents", address],
    queryFn: async () => {
      if (!address) return { user_collections: [] };
      return await getUserMintedAgents({
        address,
        limit: 21,
        offset: 0,
      });
    },
    enabled: !!address && !!skyBrowser,
    staleTime: 0,
  });

  // Defensive fallback for agents array
  const agents: UserAgentCollection[] = Array.isArray((agentsData as any)?.user_collections)
    ? (agentsData as any).user_collections
    : [];

  // Minting handler
  const handleMintAgentNft = createMintingHandler(
    skyBrowser,
    address || "",
    setMinting,
    setSelectedAgentNFTId
  );

  // Initialize minting state when agents change
  useEffect(() => {
    if (agents.length > 0) {
      const initialMintingState: Record<string, boolean> = {};
      agents.forEach((agent) => {
        if (agent.collection_address) {
          initialMintingState[agent.collection_address] = false;
        }
      });
      setMinting(initialMintingState);
    }
  }, [agents]);

  // Search handlers
  const handleSearchChange = (value: string) => setSearch(value);

  const handleSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      refetchAgents();
    }, 800);
  }, [refetchAgents]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Filter agents by search
  const filteredAgents: UserAgentCollection[] = search
    ? agents.filter(
        (agent) =>
          agent.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
          agent.agent_description?.toLowerCase().includes(search.toLowerCase())
      )
    : agents;

  // Agent selection logic
  const handleAgentSelect = async (agent: UserAgentCollection) => {
    if (!skyBrowser || !address) {
      toast.error("Please connect your wallet first");
      return;
    }
    try {
      const ownsNFT = await checkAgentNFTOwnership(
        agent.collection_address,
        address,
        skyBrowser
      );
      if (ownsNFT) {
        setSelectedAgent(agent );
        setIsOpen(false);
        toast.success(`Selected ${agent.agent_name || agent.name}`);
      } else {
        await handleMintAgentNft(agent as any);
        setSelectedAgent(agent);
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Error in handleAgentSelect:", error);
      toast.error("Failed to select agent. Please try again.");
    }
  };

  // Dialog open/close handler
  const handleDialogOpenChange = (open: boolean) => {
    if (disabled && open) return;
    setIsOpen(open);
    if (open && selectedAgent && agents.length === 0) {
      refetchAgents();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className={`w-fit max-w-32 ${
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
          title={
            isUserAgentCollection(selectedAgent)
              ? selectedAgent.name || selectedAgent.agent_name
              : selectedAgent && "name" in selectedAgent
              ? selectedAgent.name
              : undefined
          }
        >
          {isUserAgentCollection(selectedAgent) ? (
            <span className="block w-full overflow-hidden text-ellipsis text-xs">
              {selectedAgent.name || selectedAgent.agent_name}
            </span>
          ) : selectedAgent && "name" in selectedAgent ? (
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
          <DialogTitle className="flex items-center gap-3">
            {/* <StoreIcon /> */}
            <BotIcon />
            <span className="text-foreground">User Agents</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
              {loading || (selectedAgent && agents.length === 0) ? (
                <div className="col-span-full flex justify-center items-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  {selectedAgent && agents.length === 0 && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {isUserAgentCollection(selectedAgent)
                        ? `Loading agents for ${selectedAgent.name || selectedAgent.name}...`
                        : selectedAgent && "name" in selectedAgent
                        ? `Loading agents for ${selectedAgent.name}...`
                        : "Loading agents..."}
                    </span>
                  )}
                </div>
              ) : error ? (
                <div className="col-span-full text-center text-red-500 py-8">
                  {(error as Error).message ||
                    "Failed to load agents. Please try again."}
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="col-span-full text-center text-muted-foreground py-8">
                  {search
                    ? "No agents found matching your search."
                    : "No agents available."}
                </div>
              ) : (
                filteredAgents.map((agent: UserAgentCollection) => {
                  const isSelected =
                    !!(selectedAgent &&
                      (selectedAgent.id === agent.id ||
                        (isUserAgentCollection(selectedAgent) &&
                          selectedAgent.collection_address === agent.collection_address)));
                  return (
                    <AgentCard
                      key={agent.id}	
                      name={agent.name}
                      agentName={agent.agent_name}
                      description={agent.agent_description || agent.description}
                      collectionAddress={agent.collection_address}
                      isSelected={isSelected}
                      onSelect={() => handleAgentSelect(agent)}
                      onMint={() => handleMintAgentNft(agent as any)}
                      minting={minting[agent.collection_address] || false}
                      checkingOwnership={false}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
