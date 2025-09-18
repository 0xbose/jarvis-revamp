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
		chatId?: string;
		isSending?: boolean;
		isCollapsed?: boolean;
	};
	const [selectionCards, setSelectionCards] = useState<SelectionCard[]>([]);

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
			console.log("🔍 Fetching messages for chatId:", chatIdFromUrl);
			const result = await getChatMessages({
				chatId: chatIdFromUrl as string,
				skyBrowser,
				web3Context: { address },
			});
			console.log("📥 Fetched messages result:", result);
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
			chatIdFromUrl && // Ensure we have a chatId from URL
			currentChatId === chatIdFromUrl // Ensure we're loading the correct chat
		) {
			const mapped = mapFetchedMessagesToChatMsgs(fetchedMessages);

			console.log(
				"Loading messages for chatId:",
				chatIdFromUrl,
				"Messages count:",
				mapped.length,
				"Current messages count:",
				messages.length
			);

			// Always use server data when switching chats to avoid stale data
			// Only merge local messages if we're in the same chat and have streaming messages
			if (
				currentChatId === chatIdFromUrl &&
				mapped.length >= messages.length
			) {
				// Server has same or more messages, use server data
				console.log(
					"📥 Server has same/more messages, using server data:",
					mapped.length,
					"vs local:",
					messages.length
				);
				setMessages(mapped);
			} else if (
				currentChatId === chatIdFromUrl &&
				messages.length > mapped.length
			) {
				// Local has more messages (likely streaming messages), keep local but merge with server
				console.log(
					"📥 Local has more messages, merging with server data:",
					messages.length,
					"vs server:",
					mapped.length
				);

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
				// Fresh chat or different chat - use server data directly
				console.log(
					"📥 Fresh chat load, using server data:",
					mapped.length
				);
				setMessages(mapped);
			}

			if (fetchedMessages.data?.chatId && !currentChatId) {
				console.log(
					"🔄 Setting currentChatId from fetched messages:",
					fetchedMessages.data.chatId
				);
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
		console.log(
			"🔄 chatIdFromUrl changed:",
			chatIdFromUrl,
			"currentChatId:",
			currentChatId
		);
		if (chatIdFromUrl && chatIdFromUrl !== currentChatId) {
			console.log("🔄 Updating currentChatId from URL:", chatIdFromUrl);
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
		async (message?: string, modelIdOverride?: string, cardId?: string) => {
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
					console.log(
						"📋 Local messages after adding user message:",
						updated.length
					);
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

				console.log(
					"📤 Sending message with chatId:",
					currentChatId,
					"cardId:",
					cardId
				);

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

										console.log(
											"📝 Adding response message locally:",
											responseMessage.id
										);
										setMessages((prev) => {
											const updated = [
												...prev,
												responseMessage,
											];
											console.log(
												"📋 Local messages after adding response:",
												updated.length
											);
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
					// Delay query invalidation to give server time to save messages
					setTimeout(() => {
						console.log(
							"🔄 Invalidating chat history queries after delay"
						);
						queryClient.invalidateQueries({
							queryKey: [QUERY_KEYS.HISTORY, address],
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

	const handleCardSend = useCallback(
		(cardId: string, text: string, modelId: string) => {
			handleSendMessage(text, modelId, cardId);
		},
		[handleSendMessage]
	);

	const handleCardOpenChat = useCallback(
		(chatId: string, cardId: string) => {
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

			// Remove any existing cache for this chat to force fresh fetch
			queryClient.removeQueries({
				queryKey: ["chat-messages", chatId],
			});

			// Navigate to the new chat
			router.push(`/chat?chatId=${chatId}`);
		},
		[queryClient, router]
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

	// Handler for "Instruct Agent" - create a card (existing behavior)
	const handleInstructAgent = useCallback(
		(selectedText: string) => {
			const id = `${Date.now()}_${Math.random()
				.toString(36)
				.slice(2, 7)}`;
			setSelectionCards((prev) => [
				{
					id,
					text: selectedText,
					modelId: selectedModel?.id || models[0]?.id,
					isCollapsed: true,
				},
				...prev,
			]);
		},
		[selectedModel, models]
	);

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
					<div className="pb-4 px-6 mx-auto max-w-6xl relative chat-page-messages-root">
						<SelectionAskJarvis
							rootSelector=".chat-page-messages-root"
							onAsk={handleAskJarvis}
							onInstructAgent={handleInstructAgent}
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
					<div className="absolute top-0 right-6 bottom-0 w-96 flex flex-col gap-3 overflow-x-hidden overflow-y-auto scrollbar-hide py-4">
						{selectionCards.map((card) => (
							<SelectionCardComponent
								key={card.id}
								card={card}
								models={models}
								selectedModel={selectedModel}
								isStreaming={isStreaming}
								onTextChange={handleCardTextChange}
								onModelChange={handleCardModelChange}
								onSend={handleCardSend}
								onOpenChat={(chatId, cardId) =>
									handleCardOpenChat(chatId, cardId)
								}
								onRemove={handleCardRemove}
								onToggleCollapse={handleCardToggleCollapse}
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
