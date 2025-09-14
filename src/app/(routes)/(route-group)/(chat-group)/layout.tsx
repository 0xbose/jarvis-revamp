import React from "react";

export default function layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-row w-full">
			<div className="w-24"></div>
			<div className="h-screen flex-1 w-full mx-auto max-w-7xl">
				{children}
			</div>
		</div>
	);
}
