"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { Zap, Clock, Settings } from "lucide-react";

export default function AgentMarketplaceCard({ agent }: { agent: any }) {
  return (
    <Link href={`/app/${agent.id}`}>
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
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-foreground font-medium">Active</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-8 h-8 bg-background/90 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <Settings className="w-4 h-4 text-foreground" />
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
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>2 min ago</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>{agent?.platform?.length || 0} platforms</span>
              </div>
            </div>

            {/* Platform Badges */}
            {agent?.platform && agent.platform.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {agent.platform.slice(0, 3).map((platform: string) => (
                  <Badge key={platform} className="bg-primary/10 text-primary border-primary/20 text-xs px-2 py-0.5">
                    {platform}
                  </Badge>
                ))}
                {agent.platform.length > 3 && (
                  <Badge className="bg-muted/30 text-muted-foreground text-xs px-2 py-0.5">
                    +{agent.platform.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Hover Effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
    </Link>
  );
}