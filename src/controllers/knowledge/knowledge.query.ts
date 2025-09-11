import { fetchKnowledgeBaseRecords as fetchKnowledgeBaseRecordsHelper } from "@/utils/skynetHelper";

export interface KnowledgeRecord {
	id: string;
	content: string;
	timestamp: string;
	metadata?: {
		userAddress: string;
		agentAddress: string;
		level: string;
		editable: boolean;
		createdAt: string;
	};
}

export interface KnowledgeBaseResponse {
	success: boolean;
	data: {
		records: KnowledgeRecord[];
	};
	message?: string;
}

export const fetchKnowledgeBaseRecords = async ({
	skyBrowser,
	userAddress,
	agentData,
	selectedNftId,
	agentId,
	knowledgeType = "swarm",
}: {
	skyBrowser: any;
	userAddress: string;
	agentData: any;
	selectedNftId: string;
	agentId?: string;
	knowledgeType?: "swarm" | "agent";
}): Promise<KnowledgeBaseResponse> => {
	return await fetchKnowledgeBaseRecordsHelper(
		skyBrowser,
		userAddress,
		agentData,
		selectedNftId,
		agentId,
		knowledgeType
	);
};
