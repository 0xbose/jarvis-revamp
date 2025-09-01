"use client";

import Image from "next/image";
import Link from "next/link";
import { Zap } from "lucide-react";

type Agent = {
  id: string;
  name: string;
  description: string;
  is_deployed: boolean;
  created_at: string;
  updated_at: string;
  agent_address: string;
  isVerified: boolean;
  image: string | null;
};

export default function AgentMarketplaceCard({ agent }: { agent: Agent }) {
  // Format date as e.g. "Jun 8, 2025"
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Link href={`/marketplace/${agent.agent_address}`}>
      <div className="group relative bg-background/50 border border-border/40 rounded-xl overflow-hidden h-80 flex flex-col transition-all duration-300 hover:border-border/60 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
        {/* Agent Image */}
        <div className="relative aspect-video w-full overflow-hidden flex-shrink-0">
          <Image
            src={agent?.image || "/agent-mock.webp"}
            alt={agent?.name || "Agent"}
            fill
            className="object-cover transition-all duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300" />

          {/* Status Indicator */}
          <div className="absolute top-3 right-3">
            <div className="flex items-center gap-1 px-2 py-1 bg-background/90 backdrop-blur-sm rounded-full text-xs">
              <div
                className={`w-2 h-2 rounded-full ${
                  agent.isVerified ? "bg-green-500 animate-pulse" : "bg-gray-400"
                }`}
              />
              <span className="text-foreground font-medium">
                {agent.isVerified ? "Verified" : "Unverified"}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {agent?.name || "Untitled Agent"}
            </h3>
            <div className="w-6 h-6 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-3 h-3 text-primary" />
            </div>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
            {agent?.description || "No description available"}
          </p>

          {/* Metadata */}
          <div className="mt-4.5 space-y-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="font-medium">Created:</span>
                <span>{formatDate(agent.created_at)}</span>
              </div>
              </div>
          </div>
        </div>

        {/* Hover Effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
    </Link>
  );
}