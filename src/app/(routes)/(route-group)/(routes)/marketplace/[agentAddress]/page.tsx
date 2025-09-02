"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { Clock, Activity, Settings, Zap, Copy, Rocket, X } from "lucide-react";
import { getCollectionsByAddress } from "@/controllers/collections/collections.query";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { canMintAgent, mintAgentNFTWithHelper } from "@/utils/agent-minting";
import { useWallet } from "@/hooks/use-wallet";
import { createUserAgent } from "@/controllers/agents/agent.mutations";
import { useWeb3AuthSafe } from "@/providers/Web3AuthProvider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageQuickSelect } from "@/components/common/image-select";
import { IMAGES } from "@/constants/images";

interface MintAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onMint: (fields: { name: string; description: string; image: string }) => void;
  defaultName?: string;
  defaultDescription?: string;
  defaultImage?: string;
  loading?: boolean;
}

const MintAgentDialog = React.memo(function MintAgentDialog({
  open,
  onClose,
  onMint,
  defaultName,
  defaultDescription,
  defaultImage,
  loading,
}: MintAgentDialogProps) {
  const [name, setName] = useState(defaultName || "");
  const [description, setDescription] = useState(defaultDescription || "");
  const [imageUrl, setImageUrl] = useState(defaultImage || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(defaultName || "");
      setDescription(defaultDescription || "");
      setImageUrl(defaultImage || "");
      setError(null);
    }
  }, [open, defaultName, defaultDescription, defaultImage]);

  if (!open) return null;

  const handleMint = () => {
    if (!name.trim() || !description.trim() || !imageUrl.trim()) {
      setError("All fields are required.");
      return;
    }
    try {
      new URL(imageUrl.trim());
    } catch {
      setError("Please enter a valid image URL.");
      return;
    }
    setError(null);
    onMint({ name: name.trim(), description: description.trim(), image: imageUrl.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-2xl shadow-2xl p-12 w-full max-w-2xl relative">
        <button
          className="absolute top-10 right-8 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-3xl font-bold mb-6">Mint Agent NFT</h2>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="mint-name" className="block">
              Name
            </Label>
            <Input
              id="mint-name"
              type="text"
              className="w-full border border-border/60 rounded px-3 py-2 bg-background"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Agent Name"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mint-description" className="block">
              Description
            </Label>
            <Textarea
              id="mint-description"
              className="w-full border border-border/60 rounded px-3 py-2 bg-background min-h-[80px]"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Agent Description"
              disabled={loading}
            />
          </div>
          <ImageQuickSelect
            options={IMAGES}
            value={imageUrl}
            onChange={setImageUrl}
            label="Choose an image"
            showUrlInput
          />
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <Button
            className="w-full bg-green-500 hover:bg-green-600 text-black"
            onClick={handleMint}
            disabled={loading}
          >
            {loading ? "Minting..." : "Mint & Save Agent"}
          </Button>
        </div>
      </div>
    </div>
  );
});

export default function Page() {
  const params = useParams();
  const agentAddress = useMemo(() => {
    if (typeof params?.agentAddress === "string") return params.agentAddress;
    if (Array.isArray(params?.agentAddress)) return params.agentAddress[0];
    return "";
  }, [params?.agentAddress]);

  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");
  const [mintDialogOpen, setMintDialogOpen] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  const { skyBrowser, address } = useWallet();
  const { web3Auth } = useWeb3AuthSafe();

  const { data: agentData, refetch: fetchAgent } = useQuery({
    queryKey: ["marketplace-collection-by-address", agentAddress],
    queryFn: async () => {
      if (!agentAddress) return null;
      const data = await getCollectionsByAddress(agentAddress, skyBrowser, web3Auth);
      return data?.data || null;
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

  const handleMintAndSave = useCallback(
    async ({
      name,
      description,
      image,
    }: {
      name: string;
      description: string;
      image: string;
    }) => {
      setMintLoading(true);
      setMintError(null);

      try {
        if (!skyBrowser || !address || !web3Auth) {
          setMintError("Wallet not connected.");
          return;
        }
        if (!agentData) {
          setMintError("Agent data not available.");
          return;
        }

        const agentForMinting = {
          id: agentAddress,
          name,
          description,
          agent_address: agentAddress,
          is_deployed: agentData.is_deployed || false,
          created_at: agentData.created_at || new Date().toISOString(),
          updated_at: agentData.updated_at || new Date().toISOString(),
        };

        const mintResult = await mintAgentNFTWithHelper(
          agentForMinting,
          skyBrowser,
          address,
          {},
          agentAddress
        );

        if (!mintResult.success || !mintResult.agentId) {
          setMintError(mintResult.error || "Failed to mint NFT.");
          return;
        }

        await createUserAgent(address, {
          collection_address: agentAddress,
          nft_id: mintResult.agentId,
          name,
          description,
          image,
        });

        setMintDialogOpen(false);
        setMintError(null);

        setTimeout(() => {
          fetchAgent();
        }, 500);
      } catch (err: any) {
        setMintError(err?.message || "Failed to mint and save agent.");
      } finally {
        setMintLoading(false);
      }
    },
    [skyBrowser, address, web3Auth, agentData, agentAddress, fetchAgent]
  );

  const handleCloseDialog = useCallback(() => {
    if (!mintLoading) {
      setMintDialogOpen(false);
      setMintError(null);
    }
  }, [mintLoading]);

  const handleOpenDialog = useCallback(() => {
    setMintDialogOpen(true);
  }, []);

  const handleCopyAddress = useCallback(() => {
    const addressToCopy = agentData?.collection_id || agentData?.id || "";
    navigator.clipboard.writeText(addressToCopy);
  }, [agentData?.collection_id, agentData?.id]);

  return (
    <div className="min-h-screen bg-background">
      <MintAgentDialog
        open={mintDialogOpen}
        onClose={handleCloseDialog}
        onMint={handleMintAndSave}
        defaultName={agentName}
        defaultDescription={description}
        defaultImage=""
        loading={mintLoading}
      />
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
                  <h1 className="text-4xl font-bold text-foreground tracking-tight">{agentName}</h1>
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-500" />
                    <span>{agentData?.is_deployed ? "Deployed" : "Not Deployed"}</span>
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
                    <span>{agentData?.subnet_list?.length || 0} subnets configured</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3 pt-3">
                <div className="flex flex-col">
                  <Label
                    htmlFor="collection-id"
                    className="font-medium text-muted-foreground tracking-wide"
                  >
                    Collection Address
                  </Label>
                  <div className="flex items-center gap-1">
                    <code className="text-sm font-mono text-foreground">
                      {agentData?.collection_id || agentData?.id || "N/A"}
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
            </div>
          </div>
          <div className="space-y-3">
            <Button
              className="w-fit hover:bg-green-500/80 bg-green-500 text-black cursor-pointer"
              onClick={handleOpenDialog}
              disabled={!canMintAgent(agentData as any, skyBrowser) || mintLoading}
            >
              <Rocket className="w-4 h-4 mr-2" />
              {mintLoading ? "Minting..." : "Mint Agent"}
            </Button>
            {mintError && <div className="text-red-500 text-sm mt-2">{mintError}</div>}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="description" className="text-lg font-semibold text-foreground">
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