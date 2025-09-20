import { AppSidebar } from "@/components/common/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
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
				<div className="w-full h-full flex-1">
					{/* Mobile sidebar trigger */}
					<div className="md:hidden fixed top-4 left-4 z-50">
						<SidebarTrigger />
					</div>
				</div>
			</SidebarProvider>
			<div className="w-full h-full flex-1 px-3 mx-auto">{children}</div>
		</div>
	);
}
