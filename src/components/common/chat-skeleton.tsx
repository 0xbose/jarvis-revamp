import React from "react";
import { Skeleton } from "../ui/skeleton";

export default function ChatSkeleton() {
	return (
		<div className="h-full flex flex-col p-4 pb-6">
			<Skeleton className="h-28 w-full rounded py-3 mb-4" />
			<div className=" py-3 rounded-md space-y-2">
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-20 w-full" />
				<div className="flex items-center space-x-2 mt-2">
					<Skeleton className="h-4 w-20 rounded" />
					<Skeleton className="h-4 w-12" />
				</div>
			</div>

			<div className="py-3 rounded-md space-y-2">
				<Skeleton className="h-4 w-36" />
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-20 w-full" />
				<div className="flex items-center space-x-2 mt-2">
					<Skeleton className="h-4 w-20 rounded" />
					<Skeleton className="h-4 w-12" />
				</div>
			</div>
		</div>
	);
}
