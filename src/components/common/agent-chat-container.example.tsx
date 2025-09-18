// Example usage of AgentChatContainer component

import React from "react";
import { AgentChatContainer } from "./agent-chat-container";

// Example 1: Basic usage (same as the original page)
export function BasicAgentChatExample() {
	return (
		<AgentChatContainer
			agentAddress="0x1234567890abcdef"
			nftId="123"
			urlWorkflowId="workflow-456"
		/>
	);
}

// Example 2: Read-only mode (for viewing completed workflows)
export function ReadOnlyAgentChatExample() {
	return (
		<AgentChatContainer
			agentAddress="0x1234567890abcdef"
			nftId="123"
			urlWorkflowId="workflow-456"
			isReadOnly={true}
			showChatInput={false}
			className="max-w-4xl mx-auto"
		/>
	);
}

// Example 3: With callbacks for custom behavior
export function AgentChatWithCallbacksExample() {
	const handleAgentLoad = (agent: any) => {
		console.log("Agent loaded:", agent);
		// Custom logic when agent loads
	};

	const handleError = (error: string) => {
		console.error("Agent chat error:", error);
		// Custom error handling
	};

	const handleWorkflowStart = (workflowId: string) => {
		console.log("Workflow started:", workflowId);
		// Custom workflow start logic
	};

	const handleWorkflowComplete = (workflowId: string, result: any) => {
		console.log("Workflow completed:", workflowId, result);
		// Custom workflow completion logic
	};

	return (
		<AgentChatContainer
			agentAddress="0x1234567890abcdef"
			nftId="123"
			urlWorkflowId="workflow-456"
			onAgentLoad={handleAgentLoad}
			onError={handleError}
			onWorkflowStart={handleWorkflowStart}
			onWorkflowComplete={handleWorkflowComplete}
			className="custom-chat-container"
		/>
	);
}

// Example 4: Modal or embedded usage
export function EmbeddedAgentChatExample() {
	return (
		<div className="modal-content">
			<h2>Agent Chat</h2>
			<AgentChatContainer
				agentAddress="0x1234567890abcdef"
				nftId="123"
				autoSubmitPrompt={false}
				className="h-96"
			/>
		</div>
	);
}

// Example 5: Comparison view (multiple instances)
export function ComparisonAgentChatExample() {
	return (
		<div className="grid grid-cols-2 gap-4">
			<div>
				<h3>Agent A</h3>
				<AgentChatContainer
					agentAddress="0x1111111111111111"
					nftId="111"
					urlWorkflowId="workflow-111"
					className="h-96"
				/>
			</div>
			<div>
				<h3>Agent B</h3>
				<AgentChatContainer
					agentAddress="0x2222222222222222"
					nftId="222"
					urlWorkflowId="workflow-222"
					className="h-96"
				/>
			</div>
		</div>
	);
}
