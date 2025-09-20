"use client";
import * as React from "react";
import { Suspense } from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";
import Image from "next/image";
import {
	HistoryIcon,
	PlusCircleIcon,
	Wallet2Icon,
	LogOutIcon,
	StoreIcon,
	BotIcon,
	CalendarClock,
	MenuIcon,
	X,
} from "lucide-react";
import CustomTooltip from "./custom-tool-tip";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { useGlobalStore } from "@/stores/global-store";
import { useChatStore } from "@/stores/chat-store";
import { useWorkflowExecutionStore } from "@/stores/workflow-execution-store";
import ChatSidebar from "./chat-sidebar";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/utils/query-keys";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "../ui/button";

const navItems = [
	{
		icon: <PlusCircleIcon className="size-5" strokeWidth={1.5} />,
		title: "Create",
		url: "/create",
	},
	{
		icon: <CalendarClock className="size-5" strokeWidth={1.5} />,
		title: "Schedule",
		url: "/schedule",
	},
	{
		icon: <HistoryIcon className="size-5" strokeWidth={1.5} />,
		title: "History",
		url: "/history",
	},
	{
		icon: <StoreIcon className="size-5" strokeWidth={1.5} />,
		title: "Market Place",
		url: "/marketplace",
	},
	{
		icon: <BotIcon className="size-5" strokeWidth={1.5} />,
		title: "Agents",
		url: "/user-agents",
	},
	{
		icon: <Wallet2Icon className="size-5" strokeWidth={1.5} />,
		title: "Manage Funds",
		url: "/add-funds",
	},
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();
	const router = useRouter();
	const { disconnect } = useWallet();
	const { reset: resetGlobalStore } = useGlobalStore();
	const { reset: resetChatStore } = useChatStore();
	const { reset: resetWorkflowExecutionStore } = useWorkflowExecutionStore();
	const isMobile = useIsMobile();
	const isChat =
		pathname.includes("/chat") ||
		(pathname.includes("/create") &&
			!pathname.includes("/schedule/create"));
	const queryClient = useQueryClient();
	const { toggleSidebar } = useSidebar();
	const handleLogout = async () => {
		try {
			await disconnect();
			resetGlobalStore();
			resetChatStore();
			resetWorkflowExecutionStore();
			router.push("/");
		} catch (error) {
			console.error("Logout failed:", error);
		}
	};

	return (
		<>
			<Sidebar
				variant="floating"
				className="overflow-hidden *:data-[sidebar=sidebar]:flex-row !w-fit z-[9999]"
				{...props}
			>
				<Sidebar
					collapsible="none"
					className={`${
						isMobile
							? "w-auto border-r-none"
							: "w-[calc(var(--sidebar-width-icon)+1px)]!"
					} ${isChat ? "rounded-l-lg border-r-none md:border-r" : "rounded-lg"}`}
				>
					<SidebarHeader className="pt-4 pb-6 px-4 md:px-1.5 z-[9999] flex flex-row md:flex-col items-center justify-between">
						<SidebarMenu>
							<SidebarMenuItem>
								<Link href="/create">
									<Image
										src="/logo.svg"
										alt="logo"
										className="w-9"
										width={5000}
										height={5000}
									/>
								</Link>
							</SidebarMenuItem>
						</SidebarMenu>
						<Button
							variant="ghost"
							size="icon"
							className="md:hidden"
							onClick={() => {
								toggleSidebar();
							}}
						>
							<X className="size-5" />
						</Button>
					</SidebarHeader>
					<SidebarContent className="z-[9999]">
						<SidebarGroup>
							<SidebarMenu
								className={`gap-y-5 flex flex-col ${
									isMobile
										? "items-start px-4"
										: "items-center"
								}`}
							>
								{navItems.map((item) => (
									<SidebarMenuItem
										key={item.title}
										className={
											isMobile ? "w-full" : "w-fit"
										}
									>
										<SidebarMenuButton asChild>
											<CustomTooltip
												content={item.title}
												disabled={isMobile}
											>
												<Link
													href={item.url}
													className={`font-medium hover:text-primary-foreground flex items-center gap-3 h-7.5 w-fit ${
														isMobile
															? "w-full justify-start"
															: ""
													}`}
													onClick={() => {
														queryClient.invalidateQueries(
															{
																queryKey: [
																	QUERY_KEYS.HISTORY,
																],
															}
														);
													}}
												>
													{item.icon}
													{isMobile && (
														<span className="text-sm font-medium">
															{item.title}
														</span>
													)}
												</Link>
											</CustomTooltip>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroup>
					</SidebarContent>
					<SidebarFooter className="pb-4">
						<SidebarMenu
							className={`flex flex-col ${
								isMobile ? "items-start px-4" : "items-center"
							}`}
						>
							<SidebarMenuItem
								className={`${
									isMobile ? "w-full" : "w-fit"
								} hover:text-primary-foreground cursor-pointer`}
							>
								<CustomTooltip
									content="Logout"
									disabled={isMobile}
								>
									<div
										className={`flex items-center gap-3 ${
											isMobile
												? "w-full justify-start"
												: ""
										}`}
										onClick={handleLogout}
									>
										<LogOutIcon className="size-5" />
										{isMobile && (
											<span className="text-sm font-medium">
												Logout
											</span>
										)}
									</div>
								</CustomTooltip>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarFooter>
				</Sidebar>

				{isChat && !isMobile && (
					<Suspense fallback={<Skeleton className="w-56 h-full" />}>
						<ChatSidebar />
					</Suspense>
				)}
			</Sidebar>
		</>
	);
}
