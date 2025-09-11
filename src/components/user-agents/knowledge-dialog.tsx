import React, { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Save, Loader2, Trash2, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	fetchKnowledgeBaseRecords,
	KnowledgeRecord,
	KnowledgeBaseResponse,
} from "@/controllers/knowledge/knowledge.query";
import {
	saveKnowledgeRecord,
	deleteKnowledgeRecord,
} from "@/controllers/knowledge/knowledge.mutations";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { toast } from "sonner";

interface KnowledgeDialogProps {
	isOpen: boolean;
	onClose: () => void;
	skyBrowser: SkyMainBrowser | null;
	userAddress: string;
	agentData: any;
	selectedNftId: string | null;
	agentId?: string;
	isWorkflowDeployed?: boolean;
	agentName?: string;
}

export default function KnowledgeDialog({
	isOpen,
	onClose,
	skyBrowser,
	userAddress,
	agentData,
	selectedNftId,
	agentId,
	agentName,
	isWorkflowDeployed = false,
}: KnowledgeDialogProps) {
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState<"swarm" | "agent">("swarm");
	const [selectedRecord, setSelectedRecord] =
		useState<KnowledgeRecord | null>(null);
	const [content, setContent] = useState("");
	const [isAddingNew, setIsAddingNew] = useState(false);
	const [deleteConfirmation, setDeleteConfirmation] = useState<{
		isOpen: boolean;
		record: KnowledgeRecord | null;
	}>({ isOpen: false, record: null });

	// Query for swarm knowledge
	const {
		data: swarmRecords,
		isLoading: isLoadingSwarm,
		refetch: refetchSwarm,
	} = useQuery({
		queryKey: ["knowledge-records", "swarm", agentId, selectedNftId],
		queryFn: () =>
			fetchKnowledgeBaseRecords({
				skyBrowser: skyBrowser!,
				userAddress,
				agentData,
				selectedNftId: selectedNftId!,
				agentId,
				knowledgeType: "swarm",
			}),
		enabled: isOpen && !!skyBrowser && !!selectedNftId,
		staleTime: 2 * 60 * 1000, // 2 minutes - knowledge data stays fresh for 2 minutes
		gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
	});

	// Query for agent knowledge
	const {
		data: agentRecords,
		isLoading: isLoadingAgent,
		refetch: refetchAgent,
	} = useQuery({
		queryKey: ["knowledge-records", "agent", agentId, selectedNftId],
		queryFn: () =>
			fetchKnowledgeBaseRecords({
				skyBrowser: skyBrowser!,
				userAddress,
				agentData,
				selectedNftId: selectedNftId!,
				agentId,
				knowledgeType: "agent",
			}),
		enabled: isOpen && !!skyBrowser && !!selectedNftId && !!agentId,
		staleTime: 2 * 60 * 1000, // 2 minutes - knowledge data stays fresh for 2 minutes
		gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
	});

	const currentRecords =
		activeTab === "swarm"
			? swarmRecords?.data?.records || []
			: agentRecords?.data?.records || [];
	const isLoading = activeTab === "swarm" ? isLoadingSwarm : isLoadingAgent;

	const handleRefresh = () => {
		if (activeTab === "swarm") {
			refetchSwarm();
		} else {
			refetchAgent();
		}
	};

	// Save mutation
	const saveMutation = useMutation({
		mutationFn: saveKnowledgeRecord,
		onSuccess: () => {
			toast.success(
				selectedRecord
					? "Record updated successfully"
					: "Record saved successfully"
			);
			// Invalidate and refetch
			queryClient.invalidateQueries({
				queryKey: [
					"knowledge-records",
					activeTab,
					agentId,
					selectedNftId,
				],
			});
			// Reset form state
			setIsAddingNew(false);
			setSelectedRecord(null);
			setContent("");
			if (isWorkflowDeployed) {
				onClose();
			}
		},
		onError: (error) => {
			console.error("Save mutation error:", error);
			toast.error("Failed to save record");
		},
	});

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: deleteKnowledgeRecord,
		onSuccess: () => {
			toast.success("Record deleted successfully");
			// Invalidate and refetch
			queryClient.invalidateQueries({
				queryKey: [
					"knowledge-records",
					activeTab,
					agentId,
					selectedNftId,
				],
			});
			// Clear selection if the deleted record was selected
			if (selectedRecord?.id === deleteConfirmation.record?.id) {
				setSelectedRecord(null);
				setContent("");
			}
			setDeleteConfirmation({ isOpen: false, record: null });
		},
		onError: () => {
			toast.error("Failed to delete record");
			setDeleteConfirmation({ isOpen: false, record: null });
		},
	});

	useEffect(() => {
		if (isOpen) {
			// Reset state when dialog opens
			setSelectedRecord(null);
			setContent("");
			setIsAddingNew(false);
		}
	}, [isOpen]);

	const handleRecordSelect = (record: KnowledgeRecord) => {
		setSelectedRecord(record);
		setContent(record.content);
		setIsAddingNew(false);
	};

	const handleAddNew = () => {
		setSelectedRecord(null);
		setContent("");
		setIsAddingNew(true);
	};

	const handleSave = () => {
		if (!content.trim()) {
			toast.error("Please enter content to save");
			return;
		}

		if (!skyBrowser || !selectedNftId) {
			toast.error("Missing required data for saving");
			return;
		}

		saveMutation.mutate({
			skyBrowser,
			userAddress,
			agentData,
			selectedNftId,
			agentId,
			knowledgeType: activeTab,
			content,
			recordId: selectedRecord?.id,
		});
	};

	const handleDeleteClick = (
		e: React.MouseEvent,
		record: KnowledgeRecord
	) => {
		e.preventDefault();
		e.stopPropagation();
		setDeleteConfirmation({ isOpen: true, record });
	};

	const handleDeleteConfirm = () => {
		if (!deleteConfirmation.record || !skyBrowser || !selectedNftId) return;

		deleteMutation.mutate({
			skyBrowser,
			userAddress,
			agentData,
			selectedNftId,
			agentId,
			knowledgeType: activeTab,
			recordId: deleteConfirmation.record.id,
		});
	};

	const handleDeleteCancel = () => {
		setDeleteConfirmation({ isOpen: false, record: null });
	};

	const formatTimestamp = (timestamp: string) => {
		return new Date(timestamp).toLocaleString();
	};

	return (
		<>
			<Dialog open={isOpen} onOpenChange={onClose}>
				<DialogContent className="!w-[80vw] !max-w-none !h-[80svh] overflow-hidden">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							{agentName}
							<Button
								size="sm"
								variant="outline"
								onClick={handleRefresh}
								disabled={isLoading}
								className="ml-3 h-6 w-6 p-0"
								title="Refresh records"
							>
								{isLoading ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									<RefreshCw className="h-3 w-3" />
								)}
							</Button>
						</DialogTitle>
						<DialogDescription className="text-sm text-muted-foreground">
							Manage knowledge records for your agent. New entries
							may take time to save.
						</DialogDescription>
					</DialogHeader>

					<Tabs
						value={activeTab}
						onValueChange={(value) =>
							setActiveTab(value as "swarm" | "agent")
						}
						className="flex-1 flex flex-col w-full"
					>
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="swarm">
								Swarm Knowledge
							</TabsTrigger>
							<TabsTrigger value="agent" disabled={!agentId}>
								Agent Memory
							</TabsTrigger>
						</TabsList>

						<TabsContent
							value={activeTab}
							className="flex-1 flex flex-col"
						>
							<div className="flex gap-4 h-[60vh]">
								{/* Left Panel - Record IDs */}
								<div className="w-1/3 border border-gray rounded-lg p-4 overflow-y-auto">
									<div className="flex items-center justify-between mb-4">
										<h3 className="font-medium">Records</h3>
										<Button
											size="sm"
											onClick={handleAddNew}
											className="h-8 w-8 p-0"
											variant="outline"
											type="button"
										>
											<Plus className="h-4 w-4" />
										</Button>
									</div>

									{isLoading ? (
										<div className="flex items-center justify-center py-8">
											<Loader2 className="h-6 w-6 animate-spin" />
											<span className="ml-2">
												Loading records...
											</span>
										</div>
									) : currentRecords.length === 0 ? (
										<div className="text-center py-8 text-muted-foreground">
											<p>No records found</p>
											<Button
												size="sm"
												onClick={handleAddNew}
												className="mt-2"
												variant="outline"
												type="button"
											>
												<Plus className="h-4 w-4 mr-2" />
												Add First Record
											</Button>
										</div>
									) : (
										<div className="space-y-2">
											{currentRecords.map((record) => (
												<div
													key={record.id}
													className={`p-2.5 border border-gray rounded-lg cursor-pointer transition-colors group ${
														selectedRecord?.id ===
														record.id
															? "bg-primary/10 border-primary"
															: "hover:bg-muted/50"
													}`}
													onClick={() =>
														handleRecordSelect(
															record
														)
													}
												>
													<div className="flex items-start justify-between gap-x-2">
														<div className="flex-1 min-w-0">
															<div className="text-sm font-medium truncate">
																{record.id}
															</div>
															<div className="text-xs text-muted-foreground">
																{formatTimestamp(
																	record.timestamp
																)}
															</div>
															<div className="text-xs text-muted-foreground line-clamp-1">
																{record.content}
															</div>
														</div>
														<div className="flex-shrink-0">
															<Button
																size="sm"
																variant="ghost"
																className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-transparent"
																onClick={(e) =>
																	handleDeleteClick(
																		e,
																		record
																	)
																}
																disabled={
																	deleteMutation.isPending
																}
																type="button"
															>
																{deleteMutation.isPending ? (
																	<Loader2 className="h-3 w-3 animate-spin" />
																) : (
																	<Trash2 className="h-3 w-3" />
																)}
															</Button>
														</div>
													</div>
												</div>
											))}
										</div>
									)}
								</div>

								{/* Right Panel - Content */}
								<div className="flex-1 flex flex-col">
									<div className="flex items-center justify-between mb-4">
										<h3 className="font-medium">
											{isAddingNew
												? "Add New Record"
												: selectedRecord
												? "Edit Record"
												: "Content"}
										</h3>
										{(isAddingNew || selectedRecord) && (
											<Button
												onClick={handleSave}
												disabled={
													saveMutation.isPending ||
													!content.trim()
												}
												size="sm"
												type="button"
											>
												{saveMutation.isPending ? (
													<Loader2 className="h-4 w-4 animate-spin mr-2" />
												) : (
													<Save className="h-4 w-4 mr-2" />
												)}
												{selectedRecord
													? "Update"
													: "Save"}
											</Button>
										)}
									</div>

									<div className="flex-1">
										<Textarea
											value={content}
											onChange={(e) =>
												setContent(e.target.value)
											}
											placeholder={
												isAddingNew
													? "Enter content for new record..."
													: selectedRecord
													? "Edit record content..."
													: "Select a record to view or edit content..."
											}
											className="h-full resize-none border-gray text-foreground"
											disabled={
												!isAddingNew && !selectedRecord
											}
										/>
									</div>

									{selectedRecord && (
										<div className="mt-2 p-3 bg-muted/50 rounded-lg">
											<div className="text-sm text-muted-foreground">
												<span className="font-medium text-foreground">
													Record ID:
												</span>{" "}
												<span className="text-sm">
													{selectedRecord.id}
												</span>
											</div>
											<div className="text-sm text-muted-foreground">
												<span className="font-medium text-foreground">
													Created:
												</span>{" "}
												<span className="text-sm">
													{formatTimestamp(
														selectedRecord.timestamp
													)}
												</span>
											</div>
										</div>
									)}
								</div>
							</div>
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={deleteConfirmation.isOpen}
				onOpenChange={handleDeleteCancel}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Knowledge Base Record</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this knowledge base
							record? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={handleDeleteCancel}
							disabled={deleteMutation.isPending}
							type="button"
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteConfirm}
							disabled={deleteMutation.isPending}
							type="button"
						>
							{deleteMutation.isPending ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin mr-2" />
									Deleting...
								</>
							) : (
								<>
									<Trash2 className="h-4 w-4 mr-2" />
									Delete Record
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
