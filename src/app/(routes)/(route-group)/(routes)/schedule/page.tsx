import { Button } from "@/components/ui/button";
import React from "react";

export default function page() {
	return (
		<div className="h-full w-full bg-background">
			<div className="relative border-b border-border/40">
				<div className="py-8">
					<div className="flex flex-col lg:flex-row items-start justify-between gap-8">
						<div className="space-y-4">
							<h1 className="text-4xl font-bold text-foreground tracking-tight">
								Schedule
							</h1>
							<p className="text-muted-foreground text-lg max-w-2xl">
								Schedule your agents.
							</p>
						</div>
						<div className="flex-shrink-0">
							<Button className="flex-1 bg-green-500 hover:bg-green-500/90 text-gray-800">
								Schedule
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
