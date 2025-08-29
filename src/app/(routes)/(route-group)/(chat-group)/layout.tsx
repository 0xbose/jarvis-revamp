import React from "react";

export default function layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="h-screen flex-1 w-full mx-auto">
			{children}
		</div>
	);
}
