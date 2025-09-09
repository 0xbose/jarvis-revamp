import { Skeleton } from "@/components/ui/skeleton";

export default function AgentCardSkeleton() {
	return (
		<div className="group relative bg-background/50 border border-border/40 rounded-xl overflow-hidden h-88 flex flex-col">
			{/* Agent Image Skeleton */}
			<div className="relative aspect-video w-full overflow-hidden flex-shrink-0">
				<Skeleton className="absolute inset-0 w-full h-full rounded-t-xl rounded-b-none" />
				<div className="absolute inset-0 bg-skeleton" />
				{/* Status Indicator Skeleton */}
				<div className="absolute top-3 right-3">
					<div className="flex items-center gap-1 px-2 py-1 bg-background/90 backdrop-blur-sm rounded-full text-xs">
						<Skeleton className="w-2 h-2 rounded-full" />
						<Skeleton className="h-3 w-12 rounded" />
					</div>
				</div>
			</div>

			{/* Content Skeleton */}
			<div className="p-4 flex-1 flex flex-col">
				<div className="flex items-center justify-between mb-2">
					<Skeleton className="h-5 w-1/2 rounded" />
					<Skeleton className="w-6 h-6 rounded-lg" />
				</div>
				<div className="space-y-2 flex-1">
					<Skeleton className="h-4 w-3/4 rounded" />
					<Skeleton className="h-3 w-full rounded" />
				</div>
				{/* Metadata Skeleton */}
				<div className="pt-3 pb-0.5 space-y-3">
					<div className="flex items-center gap-4 text-xs">
						<div className="flex items-center gap-1">
							<Skeleton className="h-3 w-12 rounded" />
							<Skeleton className="h-3 w-16 rounded" />
						</div>
					</div>
				</div>
			</div>

			{/* Hover Effect Skeleton */}
			<div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 pointer-events-none" />
		</div>
	);
}
