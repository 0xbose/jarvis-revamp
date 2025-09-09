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
} from "@/components/ui/sidebar";
import Link from "next/link";
import Image from "next/image";
import {
	HistoryIcon,
	PlusCircleIcon,
	Wallet2Icon,
	LogOutIcon,
	StoreIcon,
	AtomIcon,
	BotIcon,
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

const navItems = [
	{
		icon: <PlusCircleIcon className="size-5" strokeWidth={1.5} />,
		title: "Create",
		url: "/create",
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
	}
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();
	const router = useRouter();
	const { disconnect } = useWallet();
	const { reset: resetGlobalStore } = useGlobalStore();
	const { reset: resetChatStore } = useChatStore();
	const { reset: resetWorkflowExecutionStore } = useWorkflowExecutionStore();
	const isChat = pathname.includes("/chat") || pathname.includes("/create");
	const queryClient = useQueryClient();

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
				className="overflow-hidden *:data-[sidebar=sidebar]:flex-row !w-fit"
				{...props}
			>
				<Sidebar
					collapsible="none"
					className={` w-[calc(var(--sidebar-width-icon)+1px)]! ${
						isChat ? "rounded-l-lg border-r " : "rounded-lg"
					}`}
				>
					<SidebarHeader className="pt-4 pb-6">
						<SidebarMenu>
							<SidebarMenuItem>
								<Link href="/create">
									<Image
										src="/logo.png"
										alt="logo"
										className="w-9"
										width={500}
										height={500}
									/>
								</Link>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarHeader>
					<SidebarContent>
						<SidebarGroup>
							<SidebarMenu className="gap-y-5 flex flex-col items-center">
								{navItems.map((item) => (
									<SidebarMenuItem
										key={item.title}
										className="w-fit"
									>
										<SidebarMenuButton asChild>
											<CustomTooltip content={item.title}>
												<Link
													href={item.url}
													className="font-medium hover:text-primary-foreground"
													onClick={() => {
														queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.HISTORY] });
													}}
												>
													{item.icon}
												</Link>
											</CustomTooltip>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroup>
					</SidebarContent>
					<SidebarFooter className="pb-4">
						<SidebarMenu className="flex flex-col items-center">
							<SidebarMenuItem className="w-fit hover:text-primary-foreground cursor-pointer">
								<CustomTooltip content="Logout">
									<LogOutIcon
										className="size-5"
										onClick={handleLogout}
									/>
								</CustomTooltip>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarFooter>
				</Sidebar>

				{isChat && (
					<Suspense fallback={<Skeleton className="w-56 h-full" />}>
						<ChatSidebar />
					</Suspense>
				)}
			</Sidebar>
		</>
	);
}
