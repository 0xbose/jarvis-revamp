"use client";

import React, {
	useState,
	useRef,
	useEffect,
	useCallback,
	Suspense,
	useMemo,
} from "react";
import { useWallet } from "@/hooks/use-wallet";
import { apiKeyManager } from "@/utils/api-key-manager";
import { API_CONFIG } from "@/config/constants";
import { toast } from "sonner";
import ChatInput from "@/components/common/chat-input";
import { ChatMsg } from "@/types/chat";
import { ChatMessage } from "@/components/common/chat-message";
import { useGlobalStore } from "@/stores/global-store";
import { useRouter, useSearchParams } from "next/navigation";
import ChatSkeleton from "@/components/common/chat-skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getChatMessages } from "@/controllers/chat/chat.query";
import { QUERY_KEYS } from "@/utils/query-keys";
import SelectionAskJarvis from "@/components/common/selection-ask-jarvis";
import { getAvailableModels } from "@/controllers/models/models.query";
import SelectionCardComponent from "@/components/common/SelectionCard";
import { workflowExecutor } from "@/utils/workflow-executor";
import { getAgentDetailByCollectionAndNftId } from "@/controllers/agents/agents.query";
import { AgentChatContainer } from "@/components/common/agent-chat-container";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StreamResponse {
	type: "update" | "final" | "chat_chunk";
	content?: string;
	data?: {
		result?: {
			chatId?: string;
			workflowId?: string;
			type?: string;
			message?: string;
			userAddress?: string;
			nftId?: string;
			includeHistory?: boolean;
			maxHistoryMessages?: number;
			streaming?: boolean;
		};
	};
	success?: boolean;
	message?: string;
	done?: boolean;
	userAddress?: string;
	nftId?: string;
}

function mapFetchedMessagesToChatMsgs(fetchedMessages: any): ChatMsg[] {
	if (
		!fetchedMessages ||
		!fetchedMessages.success ||
		!Array.isArray(fetchedMessages.data?.messages)
	) {
		return [];
	}
	return fetchedMessages.data.messages.map((msg: any, idx: number) => ({
		id: `${msg.timestamp || idx}`,
		type: msg.role === "user" ? "chat_user" : "chat_response",
		content: msg.content,
		timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
	}));
}

function ChatPageContent() {
	const [messages, setMessages] = useState<ChatMsg[]>([]);
	const [prompt, setPrompt] = useState("");
	const [mode, setMode] = useState<"chat" | "agent">("chat");
	const [isStreaming, setIsStreaming] = useState(false);
	const [currentChatId, setCurrentChatId] = useState<string | null>(null);
	const [streamingMessage, setStreamingMessage] = useState("");
	const [isInitialLoad, setIsInitialLoad] = useState(false);
	const [isCardStreaming, setIsCardStreaming] = useState(false);

	// Right-side selection cards state (multiple small cards)
	type SelectionCard = {
		id: string;
		text: string;
		modelId?: string;
		agentId?: string;
		chatId?: string;
		workflowId?: string;
		isSending?: boolean;
		isCollapsed?: boolean;
	};
	const [selectionCards, setSelectionCards] = useState<SelectionCard[]>([]);

	// Comparison mode state
	const [isComparisonMode, setIsComparisonMode] = useState(false);
	const [comparisonData, setComparisonData] = useState<{
		cardId: string;
		chatId: string;
		agentId: string;
		agentAddress?: string;
		nftId?: string;
	} | null>(null);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const chatInputRef = useRef<HTMLTextAreaElement>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const hasAutoSubmittedRef = useRef<boolean>(false);

	// Scroll management refs
	const isUserScrollingRef = useRef<boolean>(false);
	const shouldAutoScrollRef = useRef<boolean>(true);
	const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const lastMessageCountRef = useRef<number>(0);
	const isScrollingToBottomRef = useRef<boolean>(false);

	const { skyBrowser, address, isConnected, loading } = useWallet();
	const {
		prompt: globalPrompt,
		setPrompt: setGlobalPrompt,
		selectedModel,
		selectedAgent,
	} = useGlobalStore();
	const router = useRouter();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();
	const chatIdFromUrl = searchParams.get("chatId");

	const {
		data: fetchedMessages,
		isLoading: isLoadingMessages,
		isFetched: isFetchedMessages,
		refetch: refetchMessages,
	} = useQuery<any>({
		queryKey: ["chat-messages", chatIdFromUrl],
		queryFn: async () => {
			const result = await getChatMessages({
				chatId: chatIdFromUrl as string,
				skyBrowser,
				web3Context: { address },
			});
			return result;
		},
		enabled: !!chatIdFromUrl,
		retry: false,
		refetchOnWindowFocus: false,
		staleTime: 1000 * 60 * 5, // 5 minutes - data is fresh for 5 minutes
		gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache for 30 minutes
	});

	// Fetch available models for the panel's model selector
	const { data: modelsData } = useQuery<any[]>({
		queryKey: ["available-models", address],
		queryFn: () =>
			getAvailableModels({
				skyBrowser,
				web3Context: { address },
			}),
		enabled: !!skyBrowser && !!address,
		retry: false,
		refetchOnWindowFocus: false,
	});

	const models = useMemo(() => {
		if (!modelsData) return [] as any[];
		// Some backends wrap the array in { data: [...] } or return an object; normalize here
		const maybeArray = Array.isArray(modelsData)
			? modelsData
			: Array.isArray((modelsData as any).data)
			? (modelsData as any).data
			: [];
		return maybeArray.map((m: any) => ({
			id: m.id || m.modelId || m.value,
			name: m.name || m.label || m.id || m.modelId,
		}));
	}, [modelsData]);

	// Ensure newly added cards get a default model
	useEffect(() => {
		setSelectionCards((prev) =>
			prev.map((c) =>
				c.modelId
					? c
					: {
							...c,
							modelId: selectedModel?.id || models[0]?.id,
					  }
			)
		);
	}, [selectedModel, models]);

	// Set messages from fetchedMessages and show bottom-most messages directly (no scroll)
	useEffect(() => {
		if (
			fetchedMessages &&
			fetchedMessages.success &&
			Array.isArray(fetchedMessages.data?.messages) &&
			!isStreaming &&
			chatIdFromUrl // Ensure we have a chatId from URL
		) {
			const mapped = mapFetchedMessagesToChatMsgs(fetchedMessages);

			// Always use server data when switching chats to avoid stale data
			// Only merge local messages if we're in the same chat and have streaming messages
			if (
				currentChatId === chatIdFromUrl &&
				mapped.length >= messages.length
			) {
				// Server has same or more messages, use server data
				setMessages(mapped);
			} else if (
				currentChatId === chatIdFromUrl &&
				messages.length > mapped.length
			) {
				// Local has more messages (likely streaming messages), keep local but merge with server

				// Find the last server message timestamp to avoid duplicates
				const lastServerMessage = mapped[mapped.length - 1];
				const lastServerTime =
					lastServerMessage?.timestamp?.getTime() || 0;

				// Keep local messages that are newer than the last server message
				const localMessagesToKeep = messages.filter(
					(msg) => msg.timestamp.getTime() > lastServerTime
				);

				// Merge server messages with newer local messages
				const mergedMessages = [...mapped, ...localMessagesToKeep];
				setMessages(mergedMessages);
			} else {
				// Fresh chat, different chat, or initial load - use server data directly
				setMessages(mapped);
			}

			if (fetchedMessages.data?.chatId && !currentChatId) {
				setCurrentChatId(fetchedMessages.data.chatId);
			}

			// Mark as initial load and disable auto-scroll
			setIsInitialLoad(true);
			shouldAutoScrollRef.current = false;
			isUserScrollingRef.current = true;

			// Set the message count to prevent the "new messages" effect from triggering
			lastMessageCountRef.current = mapped.length;

			// Instead of scrolling, directly show the bottom-most messages by setting scrollTop
			setTimeout(() => {
				const container = messagesContainerRef.current;
				if (container) {
					container.scrollTop = container.scrollHeight;
				}
				// Re-enable auto-scroll for future new messages
				setTimeout(() => {
					shouldAutoScrollRef.current = true;
					isUserScrollingRef.current = false;
					setIsInitialLoad(false);
				}, 100);
			}, 50);
		}
	}, [
		fetchedMessages,
		isStreaming,
		currentChatId,
		chatIdFromUrl,
		messages.length,
	]);

	const isNearBottom = useCallback(() => {
		const container = messagesContainerRef.current;
		if (!container) return true;

		const threshold = 150;
		const { scrollTop, scrollHeight, clientHeight } = container;
		return scrollHeight - scrollTop - clientHeight < threshold;
	}, []);

	const scrollToBottom = useCallback((force = false, smooth = true) => {
		if (
			!messagesEndRef.current ||
			(!force && !shouldAutoScrollRef.current)
		) {
			return;
		}

		if (isScrollingToBottomRef.current && !force) {
			return;
		}

		isScrollingToBottomRef.current = true;

		requestAnimationFrame(() => {
			try {
				messagesEndRef.current?.scrollIntoView({
					behavior: smooth ? "smooth" : "auto",
					block: "end",
				});
			} catch (error) {
				console.warn("Scroll error:", error);
			}

			setTimeout(
				() => {
					isScrollingToBottomRef.current = false;
				},
				smooth ? 300 : 0
			);
		});
	}, []);

	const handleScroll = useCallback(() => {
		const container = messagesContainerRef.current;
		if (!container) return;

		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current);
		}

		scrollTimeoutRef.current = setTimeout(() => {
			const isNearBottomNow = isNearBottom();

			if (isNearBottomNow) {
				if (isUserScrollingRef.current && !isInitialLoad) {
					isUserScrollingRef.current = false;
					shouldAutoScrollRef.current = true;
				}
			} else {
				// User has scrolled away from bottom - disable auto-scroll
				// This should happen regardless of streaming state
				if (!isInitialLoad) {
					isUserScrollingRef.current = true;
					shouldAutoScrollRef.current = false;
				}
			}
		}, 50);
	}, [isNearBottom, isInitialLoad]);

	const updateUrlWithChatId = useCallback(
		(chatId: string) => {
			try {
				const url = new URL(window.location.href);
				url.searchParams.set("chatId", chatId);
				router.replace(url.pathname + url.search, { scroll: false });
			} catch (error) {
				console.warn("Failed to update URL:", error);
			}
		},
		[router]
	);

	useEffect(() => {
		if (chatIdFromUrl && chatIdFromUrl !== currentChatId) {
			setCurrentChatId(chatIdFromUrl);

			// Clear local messages state when switching to a different chat
			setMessages([]);
			setStreamingMessage("");
			setIsStreaming(false);
			setIsCardStreaming(false);

			// Reset scroll state
			setIsInitialLoad(false);
			shouldAutoScrollRef.current = true;
			isUserScrollingRef.current = false;
			lastMessageCountRef.current = 0;
		}
	}, [chatIdFromUrl, currentChatId]);

	useEffect(() => {
		if (isStreaming && streamingMessage && shouldAutoScrollRef.current) {
			const scrollInterval = setInterval(() => {
				// Only auto-scroll if user hasn't manually scrolled away
				if (
					shouldAutoScrollRef.current &&
					!isUserScrollingRef.current
				) {
					scrollToBottom(false, true);
				}
			}, 100);

			return () => clearInterval(scrollInterval);
		}
	}, [streamingMessage, isStreaming, scrollToBottom]);

	useEffect(() => {
		const currentMessageCount = messages.length;
		const hasNewMessages =
			currentMessageCount > lastMessageCountRef.current;

		if (hasNewMessages && !isInitialLoad) {
			lastMessageCountRef.current = currentMessageCount;

			// Only auto-scroll if user is near bottom or auto-scroll is enabled
			if (shouldAutoScrollRef.current || isNearBottom()) {
				shouldAutoScrollRef.current = true;
				scrollToBottom(true, true);
			}
		}
	}, [messages.length, scrollToBottom, isNearBottom, isInitialLoad]);

	useEffect(() => {
		if (
			!isStreaming &&
			streamingMessage === "" &&
			messages.length > 0 &&
			!isInitialLoad
		) {
			// Only auto-scroll when streaming ends if user hasn't manually scrolled away
			if (shouldAutoScrollRef.current && !isUserScrollingRef.current) {
				setTimeout(() => scrollToBottom(true, true), 100);
			}
		}
	}, [
		isStreaming,
		streamingMessage,
		messages.length,
		scrollToBottom,
		isInitialLoad,
	]);

	const handleSendMessage = useCallback(
		async (
			message?: string,
			modelIdOverride?: string,
			cardId?: string,
			agentId?: string
		) => {
			const userMessage = message || prompt.trim();
			if (!userMessage || isStreaming) return;

			if (!skyBrowser || !address) {
				toast.error("Please connect your wallet first");
				return;
			}

			if (!API_CONFIG.CHAT_ACCESSPOINT_URL) {
				toast.error("Chat access point URL not configured");
				return;
			}

			setPrompt("");

			// Only add messages to current chat if this is not a card send
			if (!cardId) {
				shouldAutoScrollRef.current = true;
				isUserScrollingRef.current = false;
				setIsInitialLoad(false);

				const newMessage: ChatMsg = {
					id: Date.now().toString(),
					type: "chat_user",
					content: userMessage,
					timestamp: new Date(),
				};
				setMessages((prev) => {
					const updated = [...prev, newMessage];
					return updated;
				});

				setIsStreaming(true);
				setStreamingMessage("");
				setIsCardStreaming(false);
			} else {
				// For card sends, just set streaming state
				setIsStreaming(true);
				setIsCardStreaming(true);
			}

			// If this is a card send, mark it as sending
			if (cardId) {
				setSelectionCards((prev) =>
					prev.map((c) =>
						c.id === cardId ? { ...c, isSending: true } : c
					)
				);
			}

			try {
				const apiKey = await apiKeyManager.getApiKey(skyBrowser, {
					address,
				});
				abortControllerRef.current = new AbortController();

				// Handle agent-based requests
				if (agentId && selectedAgent) {
					// Fetch full agent details with subnet_list
					let agentDetail;
					try {
						const agentAddress =
							("collection_address" in selectedAgent
								? selectedAgent.collection_address
								: null) ||
							("nft_address" in selectedAgent
								? selectedAgent.nft_address
								: null);

						if (!agentAddress) {
							throw new Error("No agent address found");
						}

						agentDetail = await getAgentDetailByCollectionAndNftId(
							agentAddress,
							selectedAgent.nft_id
						);

						if (!agentDetail) {
							throw new Error("Failed to fetch agent details");
						}
					} catch (error) {
						console.error(
							"❌ Failed to fetch agent details:",
							error
						);
						toast.error(
							"Failed to fetch agent details. Please try again."
						);
						return;
					}

					const workflowId =
						await workflowExecutor.executeAgentWorkflow(
							agentDetail as any,
							userMessage,
							address,
							skyBrowser,
							{ address },
							(data) => {
								// Handle agent workflow status updates here if needed
							}
						);

					// Store workflowId in the SelectionCard if this is a card send
					if (cardId) {
						setSelectionCards((prev) =>
							prev.map((c) =>
								c.id === cardId
									? {
											...c,
											workflowId,
											isSending: false,
									  }
									: c
							)
						);
					}

					setTimeout(() => {
						queryClient.invalidateQueries({
							queryKey: [
								"chat-messages",
								chatIdFromUrl,
								QUERY_KEYS.HISTORY,
								address,
							],
						});
					}, 1000);

					setStreamingMessage("");
					return;
				}

				// Check if we have an agentId but no selectedAgent
				if (agentId && !selectedAgent) {
					toast.error("Please select an agent first");
					return;
				}

				// Handle chat-based requests (existing logic)
				const response = await fetch(
					`${API_CONFIG.CHAT_ACCESSPOINT_URL}/natural-request?stream=true`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"x-api-key": apiKey,
						},
						body: JSON.stringify({
							prompt: userMessage,
							chatId: cardId ? null : currentChatId, // No chatId for card sends
							modelId: modelIdOverride ?? selectedModel?.id,
						}),
						signal: abortControllerRef.current.signal,
					}
				);

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				if (!response.body) {
					throw new Error("No response body");
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";
				let fullMessage = "";

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split("\n");
						buffer = lines.pop() || "";

						for (const line of lines) {
							if (!line.trim() || !line.startsWith("data: "))
								continue;

							try {
								const jsonData = line.slice(6).trim();
								if (!jsonData) continue;

								const data: StreamResponse =
									JSON.parse(jsonData);

								if (
									(data.type === "chat_chunk" ||
										data.type === "update") &&
									data.content
								) {
									fullMessage += data.content;
									// Only show streaming message for non-card sends
									if (!cardId) {
										setStreamingMessage(fullMessage);
									}
								} else if (
									data.type === "final" ||
									(data.success &&
										data.data?.result?.chatId) ||
									data.done
								) {
									const chatId = data.data?.result?.chatId;

									if (chatId && !currentChatId && !cardId) {
										setCurrentChatId(chatId);
										updateUrlWithChatId(chatId);
									}

									// If this is a card send, store the chatId in the card
									if (cardId && chatId) {
										setSelectionCards((prev) =>
											prev.map((c) =>
												c.id === cardId
													? {
															...c,
															chatId,
															isSending: false,
													  }
													: c
											)
										);
									}

									// Only add response message to current chat for non-card sends
									if (!cardId) {
										const responseMessage: ChatMsg = {
											id: (Date.now() + 1).toString(),
											type: "chat_response",
											content: fullMessage,
											timestamp: new Date(),
										};

										setMessages((prev) => {
											const updated = [
												...prev,
												responseMessage,
											];
											return updated;
										});
									}

									setStreamingMessage("");
									return;
								}
							} catch (parseError) {
								console.warn(
									"Failed to parse SSE data:",
									parseError
								);
							}
						}
					}
				} finally {
					setTimeout(() => {
						queryClient.invalidateQueries({
							queryKey: [
								"chat-messages",
								chatIdFromUrl,
								QUERY_KEYS.HISTORY,
								address,
							],
						});
					}, 1000); // 1 second delay
					reader.releaseLock();
				}
			} catch (error) {
				if (error instanceof Error && error.name !== "AbortError") {
					console.error("Chat error:", error);
					toast.error("Failed to send message. Please try again.");
				}
				setStreamingMessage("");
			} finally {
				setIsStreaming(false);
				setIsCardStreaming(false);
				abortControllerRef.current = null;

				// Reset card sending state
				if (cardId) {
					setSelectionCards((prev) =>
						prev.map((c) =>
							c.id === cardId ? { ...c, isSending: false } : c
						)
					);
				}
			}
		},
		[
			prompt,
			isStreaming,
			skyBrowser,
			address,
			currentChatId,
			updateUrlWithChatId,
			selectedModel,
			selectedAgent,
		]
	);

	useEffect(() => {
		if (
			globalPrompt?.trim() &&
			!isStreaming &&
			messages.length === 0 &&
			!hasAutoSubmittedRef.current &&
			skyBrowser &&
			address
		) {
			hasAutoSubmittedRef.current = true;
			setPrompt(globalPrompt);
			setGlobalPrompt("");
			setTimeout(() => handleSendMessage(globalPrompt), 100);
		}
	}, [
		globalPrompt,
		isStreaming,
		messages.length,
		setGlobalPrompt,
		skyBrowser,
		address,
		handleSendMessage,
	]);

	useEffect(() => {
		if (
			globalPrompt?.trim() &&
			!hasAutoSubmittedRef.current &&
			!loading &&
			!isConnected
		) {
			setPrompt(globalPrompt);
			setGlobalPrompt("");
			hasAutoSubmittedRef.current = true;
		}
	}, [globalPrompt, loading, isConnected, setGlobalPrompt]);

	useEffect(() => {
		return () => {
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, []);

	const handleStopStreaming = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		setIsStreaming(false);
		setStreamingMessage("");
	}, []);

	// Card handlers
	const handleCardTextChange = useCallback((cardId: string, text: string) => {
		setSelectionCards((prev) =>
			prev.map((c) => (c.id === cardId ? { ...c, text } : c))
		);
	}, []);

	const handleCardModelChange = useCallback(
		(cardId: string, modelId: string) => {
			setSelectionCards((prev) =>
				prev.map((c) => (c.id === cardId ? { ...c, modelId } : c))
			);
		},
		[]
	);

	const handleCardAgentChange = useCallback(
		(cardId: string, agentId: string) => {
			setSelectionCards((prev) =>
				prev.map((c) => (c.id === cardId ? { ...c, agentId } : c))
			);
		},
		[]
	);

	const handleCardSend = useCallback(
		(cardId: string, text: string, modelId?: string, agentId?: string) => {
			handleSendMessage(text, modelId, cardId, agentId);
		},
		[handleSendMessage]
	);

	const handleCardOpenChat = useCallback(
		(chatId: string, cardId: string) => {
			const card = selectionCards.find((c) => c.id === cardId);
			if (!card) return;

			setSelectionCards((prev) => prev.filter((c) => c.id !== cardId));

			// Clear messages and reset state
			setMessages([]);
			setCurrentChatId(null);
			setStreamingMessage("");
			setIsStreaming(false);
			setIsCardStreaming(false);

			// Reset scroll state
			setIsInitialLoad(false);
			shouldAutoScrollRef.current = true;
			isUserScrollingRef.current = false;
			lastMessageCountRef.current = 0;

			// Check if this is an agent request
			if (card.agentId && card.workflowId && selectedAgent) {
				// For agent requests, navigate to agent response page
				const agentAddress =
					("collection_address" in selectedAgent
						? selectedAgent.collection_address
						: null) ||
					("collection_id" in selectedAgent
						? selectedAgent.collection_id
						: null) ||
					("nft_address" in selectedAgent
						? selectedAgent.nft_address
						: null);
				const nftId =
					"nft_id" in selectedAgent ? selectedAgent.nft_id : null;

				if (agentAddress && nftId) {
					router.push(
						`/chat/agent/${agentAddress}?nftId=${nftId}&workflowId=${card.workflowId}`
					);
					return;
				}
			}

			// For regular chat requests, remove any existing cache and navigate to chat
			queryClient.removeQueries({
				queryKey: ["chat-messages", chatId],
			});

			// Navigate to the new chat
			router.push(`/chat?chatId=${chatId}`);
		},
		[queryClient, router, selectionCards, selectedAgent]
	);

	const handleCardRemove = useCallback((cardId: string) => {
		setSelectionCards((prev) => prev.filter((c) => c.id !== cardId));
	}, []);

	const handleCardToggleCollapse = useCallback((cardId: string) => {
		setSelectionCards((prev) =>
			prev.map((c) =>
				c.id === cardId ? { ...c, isCollapsed: !c.isCollapsed } : c
			)
		);
	}, []);

	const handleCardCompare = useCallback(
		(cardId: string, chatIdOrWorkflowId: string, agentId: string) => {
			const card = selectionCards.find((c) => c.id === cardId);
			if (!card) return;

			// Get agent details to extract address and nftId
			const agentAddress =
				("collection_address" in selectedAgent
					? selectedAgent.collection_address
					: null) ||
				("collection_id" in selectedAgent
					? selectedAgent.collection_id
					: null) ||
				("nft_address" in selectedAgent
					? selectedAgent.nft_address
					: null);
			const nftId =
				"nft_id" in selectedAgent ? selectedAgent.nft_id : null;

			setComparisonData({
				cardId,
				chatId: card.chatId || chatIdOrWorkflowId, // Use chatId if available, otherwise use the passed value
				agentId,
				agentAddress: agentAddress || undefined,
				nftId: nftId || undefined,
			});
			setIsComparisonMode(true);
		},
		[selectionCards, selectedAgent]
	);

	// Handler for "Ask Jarvis" - focus input and scroll to bottom
	const handleAskJarvis = useCallback(
		(selectedText: string) => {
			// Set the prompt with the selected text
			setPrompt(selectedText);

			// Focus the chat input
			setTimeout(() => {
				if (chatInputRef.current) {
					chatInputRef.current.focus();
					// Scroll to bottom to show the input
					scrollToBottom(true, true);
				}
			}, 100);
		},
		[scrollToBottom]
	);

	// Handler for "Instruct Agent" - create a card with agent selection
	const handleInstructAgent = useCallback((selectedText: string) => {
		const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		setSelectionCards((prev) => [
			{
				id,
				text: selectedText,
				agentId: "agent",
				isCollapsed: false,
			},
			...prev.map((card) => ({ ...card, isCollapsed: true })),
		]);
	}, []);

	const handleCopy = useCallback((selectedText: string) => {
		navigator.clipboard.writeText(selectedText);
	}, []);

	if (isComparisonMode && comparisonData) {
		return (
			<div className="flex h-screen max-h-screen bg-background">
				{/* Left side - Model Chat */}
				<div className="flex-1 flex flex-col min-h-0 border-r border-border">
					{/* Model Chat Header */}
					<div className="px-6 py-4 border-b border-border bg-sidebar/30">
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 bg-blue-500 rounded-full"></div>
							<h3 className="text-sm font-semibold text-foreground">
								Model Response
							</h3>
						</div>
					</div>
					<div className="flex-1 min-h-0 flex flex-col">
						<div
							ref={messagesContainerRef}
							className="flex-1 px-4 pt-6 overflow-y-auto scrollbar-hide"
							onScroll={handleScroll}
						>
							<div className="pb-4 px-6 mx-auto max-w-4xl relative chat-page-messages-root">
								<SelectionAskJarvis
									rootSelector=".chat-page-messages-root"
									onAsk={handleAskJarvis}
									onInstructAgent={handleInstructAgent}
									onCopy={handleCopy}
								/>
								{messages.map((message, idx) => (
									<ChatMessage
										key={message.id}
										message={message}
										isLast={idx === messages.length - 1}
									/>
								))}

								{/* Streaming message */}
								{isStreaming &&
									streamingMessage &&
									!isCardStreaming && (
										<ChatMessage
											message={{
												id: "streaming",
												type: "chat_response",
												content: streamingMessage,
												timestamp: new Date(),
												showLoadingDots: true,
											}}
											isLast={true}
										/>
									)}

								{/* Typing indicator */}
								{isStreaming &&
									!streamingMessage &&
									!isCardStreaming && (
										<ChatMessage
											message={{
												id: "typing",
												type: "chat_response",
												content: "",
												timestamp: new Date(),
												showLoadingDots: true,
											}}
											isLast={true}
										/>
									)}
							</div>
							<div ref={messagesEndRef} />
						</div>
						{/* Model Chat Input */}
						<div className="px-6 py-4">
							<ChatInput
								ref={chatInputRef}
								onSend={handleSendMessage}
								onStop={handleStopStreaming}
								mode={mode}
								setMode={setMode}
								prompt={prompt}
								setPrompt={setPrompt}
								isExecuting={isStreaming}
								workflowStatus={
									isStreaming ? "running" : "completed"
								}
								disableAgentSelection={true}
							/>
						</div>
					</div>
				</div>

				{/* Right side - Agent Chat */}
				<div className="flex-1 flex flex-col min-h-0">
					{/* Agent Chat Header */}
					<div className="px-6 py-4 border-b border-border bg-sidebar/30">
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 bg-green-500 rounded-full"></div>
							<h3 className="text-sm font-semibold text-foreground">
								Agent Response
							</h3>
						</div>
					</div>
					<div className="flex-1 min-h-0">
						{comparisonData.agentAddress && comparisonData.nftId ? (
							<AgentChatContainer
								agentAddress={comparisonData.agentAddress}
								nftId={comparisonData.nftId}
								urlWorkflowId={comparisonData.chatId} // Use chatId as workflowId for agent requests
								className="flex-1 h-full"
								showChatInput={true}
								showSkeleton={true}
							/>
						) : (
							<div className="flex-1 flex items-center justify-center">
								<p className="text-muted-foreground">
									Agent details not available for comparison
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Close comparison button */}
				<Button
					onClick={() => {
						setIsComparisonMode(false);
						setComparisonData(null);
					}}
					className="absolute top-1.5 right-4 z-10 p-2 h-10 bg-background border border-border rounded-full shadow-lg hover:bg-sidebar transition-colors"
				>
					<X className="size-4" />
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen max-h-screen bg-background relative">
			<div className="flex-1 min-h-0">
				<div
					ref={messagesContainerRef}
					className="px-4 pt-6 h-full overflow-y-auto scrollbar-hide"
					onScroll={handleScroll}
					style={{
						scrollBehavior: "smooth",
						height: "calc(100vh - 8rem)",
					}}
				>
					<div className="pb-4 md:px-6 mx-auto max-w-6xl relative chat-page-messages-root">
						<SelectionAskJarvis
							rootSelector=".chat-page-messages-root"
							onAsk={handleAskJarvis}
							onInstructAgent={handleInstructAgent}
							onCopy={handleCopy}
						/>
						{messages.map((message, idx) => (
							<ChatMessage
								key={message.id}
								message={message}
								isLast={idx === messages.length - 1}
							/>
						))}

						{/* Streaming message */}
						{isStreaming &&
							streamingMessage &&
							!isCardStreaming && (
								<ChatMessage
									message={{
										id: "streaming",
										type: "chat_response",
										content: streamingMessage,
										timestamp: new Date(),
										showLoadingDots: true,
									}}
									isLast={true}
								/>
							)}

						{/* Typing indicator */}
						{isStreaming &&
							!streamingMessage &&
							!isCardStreaming && (
								<ChatMessage
									message={{
										id: "typing",
										type: "chat_response",
										content: "",
										timestamp: new Date(),
										showLoadingDots: true,
									}}
									isLast={true}
								/>
							)}
					</div>
					<div ref={messagesEndRef} />
				</div>

				{selectionCards.length > 0 && (
					<div className="absolute top-0 right-6 bottom-0 md:w-96 w-full flex flex-col gap-3 overflow-x-hidden overflow-y-auto scrollbar-hide py-4">
						{selectionCards.map((card) => (
							<SelectionCardComponent
								key={card.id}
								card={card}
								models={models}
								selectedModel={selectedModel}
								selectedAgent={selectedAgent}
								isStreaming={isStreaming}
								onTextChange={handleCardTextChange}
								onModelChange={handleCardModelChange}
								onAgentChange={handleCardAgentChange}
								onSend={handleCardSend}
								onOpenChat={(chatId, cardId) =>
									handleCardOpenChat(chatId, cardId)
								}
								onRemove={handleCardRemove}
								onToggleCollapse={handleCardToggleCollapse}
								onCompare={handleCardCompare}
							/>
						))}
					</div>
				)}
				<div className="absolute bottom-4 left-0 right-0 px-6 mx-auto max-w-6xl">
					<ChatInput
						ref={chatInputRef}
						onSend={handleSendMessage}
						onStop={handleStopStreaming}
						mode={mode}
						setMode={setMode}
						prompt={prompt}
						setPrompt={setPrompt}
						isExecuting={isStreaming}
						workflowStatus={isStreaming ? "running" : "completed"}
						disableAgentSelection={true}
					/>
				</div>
			</div>
		</div>
	);
}

export default function ChatPage() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-screen px-6 mx-auto max-w-6xl">
					<ChatSkeleton />
				</div>
			}
		>
			<ChatPageContent />
		</Suspense>
	);
}
