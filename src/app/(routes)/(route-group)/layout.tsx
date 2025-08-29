import { AppSidebar } from "@/components/common/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import React from "react";

export default function layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex h-full w-full">
			<SidebarProvider
				style={
					{
						"--sidebar-width": "350px",
					} as React.CSSProperties
				}
			>
				<AppSidebar />
			</SidebarProvider>
			<div className="w-full h-full flex-1 px-3 mx-auto">{children}</div>
		</div>
	);
}
