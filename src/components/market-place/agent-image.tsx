import { Zap } from "lucide-react";
import Image from "next/image";

export const AgentImage = ({ src, alt, isVerified }: { src?: string, alt: string, isVerified?: boolean }) => (
    <div className="relative group">
      <div className="size-48 relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-border/40 shadow-xl">
        <Image
          src={src || "/agent-mock.webp"}
          alt={alt}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div
        className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-4 border-background shadow-lg flex items-center justify-center ${
          isVerified ? "bg-green-500" : "bg-gray-500"
        }`}
      >
        <Zap className="w-4 h-4 text-white" />
      </div>
    </div>
  )
  