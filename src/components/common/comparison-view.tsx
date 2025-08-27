"use client";
import React, { useState, useRef, useEffect } from "react";
import { WorkflowPanel } from "./workflow-panel";
import { AgentDetail, Agent } from "@/types";
import { Button } from "../ui/button";
import { X, ArrowLeftRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface ComparisonViewProps {
	agentId: string;
	primaryWorkflowId: string;
	compareWorkflowId: string;
	selectedAgent: AgentDetail | Agent | null;
}

export function ComparisonView({
	agentId,
	primaryWorkflowId,
	compareWorkflowId,
	selectedAgent,
}: ComparisonViewProps) {
	const router = useRouter();
	const [isSwapping, setIsSwapping] = useState(false);
	const swapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const handleExitComparison = () => {
		// Navigate back to single workflow view
		router.push(`/chat/agent/${agentId}?workflowId=${primaryWorkflowId}`);
	};

	const handleSwapWorkflows = () => {
		// Prevent rapid clicking by implementing debounce
		if (isSwapping) return;

		setIsSwapping(true);
		
		// Clear any existing timeout
		if (swapTimeoutRef.current) {
			clearTimeout(swapTimeoutRef.current);
		}

		// Swap primary and comparison workflows
		router.push(`/chat/agent/${agentId}?workflowId=${compareWorkflowId}&compare=${primaryWorkflowId}`);

		// Reset the debounce state after 2 seconds
		swapTimeoutRef.current = setTimeout(() => {
			setIsSwapping(false);
		}, 2000);
	};

	// Cleanup timeout on component unmount
	useEffect(() => {
		return () => {
			if (swapTimeoutRef.current) {
				clearTimeout(swapTimeoutRef.current);
			}
		};
	}, []);

	return (
		<div className="relative w-full h-full container mx-auto flex flex-col">
			{/* Header with controls */}
			<div className="flex items-center justify-between px-3 py-2 border-b bg-background">
				<h2 className="font-medium text-sm">Workflow Comparison</h2>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleSwapWorkflows}
						disabled={isSwapping}
						className="h-7 px-2 hover:bg-card "
					>
						<ArrowLeftRight className="h-3 w-3" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleExitComparison}
						className="h-7 px-2 hover:bg-card"
					>
						<X className="h-3 w-3" />
					</Button>
				</div>
			</div>

			{/* Split view */}
			<div className="flex-1 flex overflow-hidden">
				{/* Left Panel - Primary Workflow */}
				<WorkflowPanel
					workflowId={primaryWorkflowId}
					agentId={agentId}
					selectedAgent={selectedAgent}
					title="Primary Workflow"
					isReadOnly={true}
					className="flex-1 border-r"
				/>

				{/* Right Panel - Comparison Workflow */}
				<WorkflowPanel
					workflowId={compareWorkflowId}
					agentId={agentId}
					selectedAgent={selectedAgent}
					title="Comparison Workflow"
					isReadOnly={true}
					className="flex-1"
				/>
			</div>
		</div>
	);
}
