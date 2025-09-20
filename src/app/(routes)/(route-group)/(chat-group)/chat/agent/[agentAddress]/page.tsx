"use client";

import React, { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ChatSkeleton from "@/components/common/chat-skeleton";
import { AgentChatContainer } from "@/components/common/agent-chat-container";

function AgentChatPageContent() {
	const params = useParams();
	const searchParams = useSearchParams();
	const agentAddress = params.agentAddress as string;
	const nftId = searchParams.get("nftId") as string;
	const urlWorkflowId = searchParams.get("workflowId");

	return (
		<div className=" h-full flex-1">
			<AgentChatContainer
				agentAddress={agentAddress}
				nftId={nftId}
				urlWorkflowId={urlWorkflowId}
				className="h-full flex-1"
			/>
		</div>
	);
}

export default function AgentChatPage() {
	return (
		<Suspense
			fallback={
				<div
					className="
		md:px-6 mx-auto max-w-6xl"
				>
					<ChatSkeleton />
				</div>
			}
		>
			<AgentChatPageContent />
		</Suspense>
	);
}
