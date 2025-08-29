import { ChatMsg } from "@/types/chat";
import { QueryClient } from "@tanstack/react-query";

// Query key factory for consistent cache keys
export const chatQueryKeys = {
	chat: (workflowId: string) => ["chat", workflowId] as const,
	history: (address: string) => ["history", address] as const,
	workflow: (workflowId: string) => ["workflow", workflowId] as const,
};

export const prefetchChatData = (workflowId: string, queryClient: QueryClient) => {
	if (!workflowId) {
		return;
	}

	// TanStack Query handles caching automatically - no need to check if cached
	queryClient.prefetchQuery({
		queryKey: chatQueryKeys.chat(workflowId),
		queryFn: async () => {
			// Return empty array as default - actual data comes from polling/API
			return [] as ChatMsg[];
		},
		staleTime: 1000 * 60 * 10, // 10 minutes
		gcTime: 1000 * 60 * 60, // 1 hour
	});
};

export const getCachedChatMessages = (
	workflowId: string,
	queryClient: QueryClient
): ChatMsg[] | undefined => {
	if (!queryClient || !workflowId) {
		console.warn('getCachedChatMessages: queryClient or workflowId is missing');
		return undefined;
	}
	return queryClient.getQueryData(chatQueryKeys.chat(workflowId));
};

export const setCachedChatMessages = (
	workflowId: string,
	messages: ChatMsg[],
	queryClient: QueryClient
): void => {
	if (!queryClient || !workflowId) {
		console.warn('setCachedChatMessages: queryClient or workflowId is missing');
		return;
	}
	queryClient.setQueryData(chatQueryKeys.chat(workflowId), messages);
};

export const clearChatCache = (workflowId: string, queryClient: QueryClient): void => {
	if (!queryClient || !workflowId) {
		console.warn('clearChatCache: queryClient or workflowId is missing');
		return;
	}
	queryClient.removeQueries({ queryKey: chatQueryKeys.chat(workflowId) });
};
