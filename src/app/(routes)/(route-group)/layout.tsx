import { AppSidebar } from "@/components/common/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import Image from "next/image";
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
				<div className="z-[99] md:hidden fixed top-0 w-full h-fit p-4 bg-background flex items-center gap-2 border-b">
					<SidebarTrigger />
					<Image
						src="/skynet.svg"
						alt="logo"
						className="h-5 w-fit"
						width={5000}
						height={5000}
					/>
				</div>
			</SidebarProvider>
			<div className="w-full h-full flex-1 px-3 mx-auto mt-12 md:mt-0">
				{children}
			</div>
		</div>
	);
}
