"use client";
import React, { Suspense, lazy, useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentDetailResponse } from "@/types/agents";

// Lazy load the components to improve initial tab switching performance
const AgentHistory = lazy(() => import("./agent-history"));
const AgentMemory = lazy(() => import("./agent-memory"));

const TABS = [
	{ name: "History", value: "history" },
	{ name: "Memory", value: "knowledge" },
	{ name: "Description", value: "description" },
];

interface AgentTabsProps {
	agentData: AgentDetailResponse;
	agentAddress: string;
	nftId: string;
	descriptionField: {
		value: string;
		draft: string;
		isEditing: boolean;
		setDraft: (value: string) => void;
		startEdit: () => void;
		saveEdit: () => void;
		cancelEdit: () => void;
	};
	updateLoading: boolean;
}

export default function AgentTabs({
	agentData,
	agentAddress,
	nftId,
	descriptionField,
	updateLoading,
}: AgentTabsProps) {
	const [activeTab, setActiveTab] = useState("history");
	const [loadedTabs, setLoadedTabs] = useState<Set<string>>(
		new Set(["history"])
	);

	// Only load tab content when it's first accessed
	const handleTabChange = useCallback((value: string) => {
		setActiveTab(value);
		setLoadedTabs((prev) => new Set(prev).add(value));
	}, []);

	return (
		<div className="pb-6 md:pb-2">
			<Tabs
				value={activeTab}
				onValueChange={handleTabChange}
				className="w-full h-full group-data-[collapsible=icon]:hidden flex flex-col"
			>
				<div className="w-full border-b border-muted relative h-12">
					<TabsList className="px-2 sm:px-4 w-fit h-full bg-transparent py-0 my-0 absolute left-2 sm:left-3 top-[1.1px] flex items-center gap-x-4 sm:gap-x-6">
						{TABS.map((item, id) => (
							<TabsTrigger
								key={id}
								value={item.value}
								className="w-fit px-2 sm:px-4 text-sm font-normal flex items-center shadow-none data-[state=active]:shadow-none gap-2 border-b-2 pb-0 h-full border-transparent bg-transparent rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-foreground/50 transition-all duration-200 ease-in-out"
							>
								{item.name}
							</TabsTrigger>
						))}
					</TabsList>
				</div>
				<div className="w-full flex-1 px-2 sm:px-8 pt-5 overflow-y-auto scrollbar-hide">
					<TabsContent value="history" className="h-full">
						{loadedTabs.has("history") && (
							<Suspense
								fallback={
									<div className="space-y-4">
										<div className="border-[1.5px] rounded-lg overflow-hidden">
											<div className="bg-primaryColor/5 p-4">
												<Skeleton className="h-6 w-full" />
											</div>
											{[...Array(5)].map((_, i) => (
												<div
													key={i}
													className="p-4 border-b"
												>
													<Skeleton className="h-4 w-full mb-2" />
													<Skeleton className="h-4 w-2/3" />
												</div>
											))}
										</div>
									</div>
								}
							>
								<AgentHistory
									agentAddress={agentAddress}
									agentID={nftId}
								/>
							</Suspense>
						)}
					</TabsContent>
					<TabsContent value="description" className="h-full">
						{loadedTabs.has("description") && (
							<div className="space-y-3">
								<div className="relative">
									<div className="min-h-[140px] bg-background/50 border border-border/60 rounded-xl p-6 text-base leading-relaxed">
										{descriptionField.isEditing ? (
											<div className="space-y-4">
												<textarea
													value={
														descriptionField.draft
													}
													onChange={(e) =>
														descriptionField.setDraft(
															e.target.value
														)
													}
													className="w-full min-h-[120px] bg-transparent outline-none focus:outline-none resize-y"
													placeholder="Enter a description for this agent..."
													disabled={updateLoading}
												/>
												{!descriptionField.isEditing && (
													<Button
														size="sm"
														variant="ghost"
														onClick={
															descriptionField.startEdit
														}
														className="h-8 px-2"
														disabled={updateLoading}
													>
														<Pencil className="h-4 w-4" />
													</Button>
												)}
												<div className="flex items-center gap-2 justify-end">
													<Button
														size="sm"
														variant="ghost"
														onClick={
															descriptionField.saveEdit
														}
														className="h-8 px-3"
														disabled={updateLoading}
													>
														<Check className="h-4 w-4 mr-1" />
														{updateLoading
															? "Saving..."
															: "Save"}
													</Button>
													<Button
														size="sm"
														variant="ghost"
														onClick={
															descriptionField.cancelEdit
														}
														className="h-8 px-3"
														disabled={updateLoading}
													>
														<X className="h-4 w-4 mr-1" />
														Cancel
													</Button>
												</div>
											</div>
										) : (
											<div>
												{descriptionField.value ||
													"No description provided for this agent."}
											</div>
										)}
									</div>
								</div>
							</div>
						)}
					</TabsContent>
					<TabsContent value="knowledge" className="h-full">
						{loadedTabs.has("knowledge") && (
							<Suspense fallback={<div>Loading...</div>}>
								<AgentMemory agentData={agentData} />
							</Suspense>
						)}
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
