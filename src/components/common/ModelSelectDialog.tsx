"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Cpu, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAvailableModels } from "@/controllers/models/models.query";
import { useWallet } from "@/hooks/use-wallet";
import { useGlobalStore } from "@/stores/global-store";

interface ModelSelectDialogProps {
	buttonClassName?: string;
	buttonSize?: "sm" | "default" | "lg" | "icon";
	value?: { id: string; name: string } | null;
	onChange?: (model: { id: string; name: string }) => void;
	buttonLabel?: string;
	// When true, do not read/write to the global selectedModel store
	disableGlobalSync?: boolean;
}

export default function ModelSelectDialog({
	buttonClassName,
	buttonSize = "sm",
	value,
	onChange,
	buttonLabel,
	disableGlobalSync = false,
}: ModelSelectDialogProps) {
	const { selectedModel, setSelectedModel } = useGlobalStore();
	const { skyBrowser, address } = useWallet();
	const [open, setOpen] = React.useState(false);

	const { data: models, isLoading } = useQuery<any>({
		queryKey: ["models-dialog"],
		queryFn: () =>
			getAvailableModels({
				skyBrowser,
				web3Context: { address },
			}),
		enabled: !!address,
		retry: true,
	});

	const modelItems: { id: string; name: string }[] = Array.isArray(
		models?.data?.models
	)
		? models.data.models
		: Array.isArray(models)
		? models
		: [];

	const [modelSearch, setModelSearch] = React.useState("");
	const normalizedQuery = modelSearch.trim().toLowerCase();
	const filteredModels = normalizedQuery
		? modelItems.filter(
				(m) =>
					(m.name || "").toLowerCase().includes(normalizedQuery) ||
					(m.id || "").toLowerCase().includes(normalizedQuery)
		  )
		: modelItems;

	const active = disableGlobalSync ? value : value || selectedModel;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					size={buttonSize}
					className={`w-fit max-w-48 bg-background border border-border text-xs cursor-pointer ${
						active
							? "border-accent bg-accent/20 hover:bg-accent/25 !text-accent"
							: ""
					} ${buttonClassName || ""}`}
				>
					<Cpu className="mr-2 h-3.5 w-3.5" />
					<span className="max-w-40 truncate">
						{buttonLabel || active?.name || "Select model"}
					</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="!w-[92vw] !h-[80svh] max-h-[600px] md:!max-h-[800px] !max-w-3xl flex flex-col border-none rounded-3xl pb-6 ">
				<DialogHeader className="absolute top-0 left-0 w-full rounded-t-3xl bg-background z-10 h-14 pt-2 px-6 md:px-8 flex justify-center">
					<DialogTitle className="flex items-center gap-2">
						<Cpu />
						<span className="text-foreground">Models</span>
					</DialogTitle>
				</DialogHeader>
				<div className="mt-9 md:px-6 flex-1 min-h-0 flex flex-col overflow-y-auto scrollbar-thin">
					<div className="mb-2">
						<Input
							placeholder="Search models by name or id..."
							value={modelSearch}
							onChange={(e) => setModelSearch(e.target.value)}
						/>
					</div>
					<div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
						{isLoading ? (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="size-4 animate-spin" />{" "}
								Loading models...
							</div>
						) : filteredModels.length === 0 ? (
							<div className="text-sm text-muted-foreground">
								No models match your search.
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{filteredModels.map((m) => (
									<button
										key={m.id}
										className={`text-left p-3 rounded-lg border ${
											active?.id === m.id
												? "border-accent bg-accent/10"
												: "border-border hover:bg-muted/30"
										}`}
										onClick={() => {
											onChange?.(m);
											if (!disableGlobalSync) {
												setSelectedModel(m);
											}
											setOpen(false);
										}}
									>
										<div className="text-sm font-medium text-foreground">
											{m.name}
										</div>
										<div className="text-xs text-muted-foreground break-all">
											{m.id}
										</div>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
				<div className="md:px-6">
					<DialogClose asChild>
						<Button className="w-full">Done</Button>
					</DialogClose>
				</div>
			</DialogContent>
		</Dialog>
	);
}
