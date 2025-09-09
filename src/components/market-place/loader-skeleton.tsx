import { Skeleton } from "../ui/skeleton";

export const MarketplaceLoaderSkeleton = () => {
	return (
		<div className="p-6">
			<div className="h-[calc(100dvh-4rem)] overflow-y-auto flex flex-col gap-8">
				<div className="flex flex-col md:flex-row gap-12 items-start justify-between">
					<div className="flex flex-col md:flex-row gap-8 items-start flex-1">
						{/* Agent image placeholder */}
						<Skeleton className="h-44 w-44 rounded-xl" />
						<div className="flex-1 space-y-6 w-full">
							<div className="space-y-4">
								{/* Title line */}
								<Skeleton className="h-8 w-2/3" />
								{/* Status row */}
								<div className="flex items-center gap-6">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-4 w-40" />
								</div>
							</div>

							{/* Collection address row */}
							<div className="space-y-3 pt-3">
								<Skeleton className="h-4 w-40" />
								<div className="flex items-center gap-2">
									<Skeleton className="h-5 w-64" />
									<Skeleton className="h-8 w-8 rounded-md" />
								</div>
							</div>
						</div>
					</div>

					{/* Primary action button placeholder */}
					<Skeleton className="h-10 w-36 rounded-md" />
				</div>

				{/* Description section */}
				<div className="space-y-3">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-36 w-full rounded-xl" />
				</div>
			</div>
		</div>
	);
};
