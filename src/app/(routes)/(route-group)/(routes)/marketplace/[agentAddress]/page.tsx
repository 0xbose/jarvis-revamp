"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { Clock, Activity, Settings, Zap, Copy, Rocket } from 'lucide-react';
import { getAgentById } from '@/controllers/agents/agents.query';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

export default function Page() {
  const params = useParams();
  const agentAddress = typeof params?.agentAddress === 'string'
    ? params.agentAddress
    : Array.isArray(params?.agentAddress)
      ? params.agentAddress[0]
      : '';

  const [agentName, setAgentName] = useState('');
  const [description, setDescription] = useState('');

  const {
    data: agentData,
    isLoading: loading,
    error,
    refetch: fetchAgent,
  } = useQuery({
    queryKey: ["marketplace-agent-by-address", agentAddress],
    queryFn: async () => {
      if (!agentAddress) return null;
      const data = await getAgentById(agentAddress);
      return data?.data || null;
    },
    enabled: !!agentAddress,
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });

  useEffect(() => {
    fetchAgent();
  }, []);

  useEffect(() => {
    if (agentData) {
      setAgentName(agentData.name || '');
      setDescription(agentData.description || '');
    }
  }, [agentData]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-12 max-w-7xl flex flex-col gap-8">
      <div className="flex flex-col md:flex-row gap-12 items-start justify-between">
        <div className="flex flex-col md:flex-row gap-8 items-start flex-1">
            <div className="relative group">
              <div className="w-48 h-48 relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-border/40 shadow-xl">
                <Image
                  src="/agent-mock.webp"
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
                    <span>{agentData?.is_deployed ? 'Deployed' : 'Not Deployed'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Updated {agentData?.updated_at ? new Date(agentData.updated_at).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span>{agentData?.subnet_list?.length || 0} subnets configured</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label htmlFor="collection-id" className="font-medium text-muted-foreground tracking-wide">
                    Collection ID
                  </Label>
                  <code className="text-sm font-mono text-foreground">{agentData?.collection_id || agentData?.id || "N/A"}</code>
                  <Button 
                    size="sm"
                    variant="ghost"
                    onClick={() => navigator.clipboard.writeText(agentData?.collection_id || agentData?.id || '')}
                    className="h-8 w-8 p-0 hover:bg-background/80 active:scale-80 transition-transform duration-100"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                
                {agentData?.subnet_list?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {agentData?.subnet_list?.map((subnet, index) => (
                        <Badge key={subnet.itemID || index} className="bg-primary/10 text-primary border-primary/20 px-3 py-1.5">
                          <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                          {subnet.unique_id || `Subnet ${subnet.itemID}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-3">
          <Button className="w-fit hover:bg-green-500/80 bg-green-500 text-black cursor-pointer">
            <Rocket className="w-4 h-4 mr-2" />
            Mint Agent</Button>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="description" className="text-lg font-semibold text-foreground">Agent Description</Label>
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
