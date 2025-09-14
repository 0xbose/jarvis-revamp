"use client";

import React, {
	useState,
	useRef,
	useEffect,
	useCallback,
	Suspense,
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

function ChatPageContent() {
	const [messages, setMessages] = useState<ChatMsg[]>([]);
	const [prompt, setPrompt] = useState("");
	const [mode, setMode] = useState<"chat" | "agent">("chat");
	const [isStreaming, setIsStreaming] = useState(false);
	const [currentChatId, setCurrentChatId] = useState<string | null>(null);
	const [streamingMessage, setStreamingMessage] = useState("");

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const hasAutoSubmittedRef = useRef<boolean>(false);

	// Scroll management refs
	const isUserScrollingRef = useRef<boolean>(false);
	const shouldAutoScrollRef = useRef<boolean>(true);
	const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const lastMessageCountRef = useRef<number>(0);
	const isScrollingToBottomRef = useRef<boolean>(false);

	const { skyBrowser, address, isConnected, loading } = useWallet();
	const { prompt: globalPrompt, setPrompt: setGlobalPrompt } =
		useGlobalStore();
	const router = useRouter();
	const searchParams = useSearchParams();

	// Check if user is near the bottom of the chat
	const isNearBottom = useCallback(() => {
		const container = messagesContainerRef.current;
		if (!container) return true;

		const threshold = 150; // Increased threshold for better UX
		const { scrollTop, scrollHeight, clientHeight } = container;
		return scrollHeight - scrollTop - clientHeight < threshold;
	}, []);

	// Smooth scroll to bottom with improved performance
	const scrollToBottom = useCallback((force = false, smooth = true) => {
		if (
			!messagesEndRef.current ||
			(!force && !shouldAutoScrollRef.current)
		) {
			return;
		}

		// Prevent multiple simultaneous scroll attempts
		if (isScrollingToBottomRef.current && !force) {
			return;
		}

		isScrollingToBottomRef.current = true;

		// Use requestAnimationFrame for better performance
		requestAnimationFrame(() => {
			messagesEndRef.current?.scrollIntoView({
				behavior: smooth ? "smooth" : "auto",
				block: "end",
			});

			// Reset the flag after animation completes
			setTimeout(
				() => {
					isScrollingToBottomRef.current = false;
				},
				smooth ? 300 : 0
			);
		});
	}, []);

	// Handle scroll events with debouncing
	const handleScroll = useCallback(() => {
		const container = messagesContainerRef.current;
		if (!container) return;

		// Clear existing timeout
		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current);
		}

		// Debounce scroll handling
		scrollTimeoutRef.current = setTimeout(() => {
			const isNearBottomNow = isNearBottom();

			if (isNearBottomNow) {
				// User is at or near bottom - enable auto-scroll
				if (isUserScrollingRef.current) {
					isUserScrollingRef.current = false;
					shouldAutoScrollRef.current = true;
				}
			} else if (!isStreaming) {
				// User scrolled away from bottom (but only disable auto-scroll if not streaming)
				isUserScrollingRef.current = true;
				shouldAutoScrollRef.current = false;
			}
		}, 50); // 50ms debounce
	}, [isNearBottom, isStreaming]);

	// Update URL with chat ID
	const updateUrlWithChatId = useCallback(
		(chatId: string) => {
			const url = new URL(window.location.href);
			url.searchParams.set("chatId", chatId);
			router.replace(url.pathname + url.search, { scroll: false });
		},
		[router]
	);

	// Initialize chatId from URL parameters
	useEffect(() => {
		const chatIdFromUrl = searchParams.get("chatId");
		if (chatIdFromUrl && !currentChatId) {
			setCurrentChatId(chatIdFromUrl);
		}
	}, [searchParams, currentChatId]);

	// Handle streaming message updates
	useEffect(() => {
		if (isStreaming && streamingMessage && shouldAutoScrollRef.current) {
			// Smooth scroll during streaming, but less frequently for better performance
			const scrollInterval = setInterval(() => {
				if (shouldAutoScrollRef.current) {
					scrollToBottom(false, true);
				}
			}, 100);

			return () => clearInterval(scrollInterval);
		}
	}, [streamingMessage, isStreaming, scrollToBottom]);

	// Handle new messages
	useEffect(() => {
		const currentMessageCount = messages.length;
		const hasNewMessages =
			currentMessageCount > lastMessageCountRef.current;

		if (hasNewMessages) {
			lastMessageCountRef.current = currentMessageCount;

			// Always scroll to bottom for new messages if user is near bottom
			if (shouldAutoScrollRef.current || isNearBottom()) {
				shouldAutoScrollRef.current = true;
				scrollToBottom(true, true);
			}
		}
	}, [messages.length, scrollToBottom, isNearBottom]);

	// Handle end of streaming
	useEffect(() => {
		if (!isStreaming && streamingMessage === "" && messages.length > 0) {
			// Streaming just ended, ensure we're at bottom if we should be
			if (shouldAutoScrollRef.current) {
				setTimeout(() => scrollToBottom(true, true), 100);
			}
		}
	}, [isStreaming, streamingMessage, messages.length, scrollToBottom]);

	// Auto-submit prompt from global store
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
	]);

	// Handle wallet connection for auto-submission
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

	// Cleanup timeouts on unmount
	useEffect(() => {
		return () => {
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}
		};
	}, []);

	const addMessage = useCallback(
		(message: Omit<ChatMsg, "id" | "timestamp">) => {
			const newMessage: ChatMsg = {
				...message,
				id: Date.now().toString(),
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, newMessage]);
		},
		[]
	);

	const handleSendMessage = async (message?: string) => {
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

		// Reset scroll state for new conversation
		shouldAutoScrollRef.current = true;
		isUserScrollingRef.current = false;

		addMessage({
			type: "chat_user",
			content: userMessage,
		});

		setIsStreaming(true);
		setStreamingMessage("");

		try {
			const apiKey = await apiKeyManager.getApiKey(skyBrowser, {
				address,
			});
			abortControllerRef.current = new AbortController();

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
						chatId: currentChatId,
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

							const data: StreamResponse = JSON.parse(jsonData);

							if (
								(data.type === "chat_chunk" ||
									data.type === "update") &&
								data.content
							) {
								fullMessage += data.content;
								setStreamingMessage(fullMessage);
							} else if (
								data.type === "final" ||
								(data.success && data.data?.result?.chatId)
							) {
								const chatId = data.data?.result?.chatId;

								if (chatId && !currentChatId) {
									setCurrentChatId(chatId);
									updateUrlWithChatId(chatId);
								}

								addMessage({
									type: "chat_response",
									content: fullMessage,
								});

								setStreamingMessage("");
								return; // Exit the loop
							}
						} catch (parseError) {
							// Ignore JSON parse errors
							console.warn(
								"Failed to parse SSE data:",
								parseError
							);
						}
					}
				}
			} finally {
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
			abortControllerRef.current = null;
		}
	};

	const handleStopStreaming = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		setIsStreaming(false);
		setStreamingMessage("");
	}, []);

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
					<div className="pb-4">
						{messages.map((message) => (
							<ChatMessage
								key={message.id}
								message={message}
								isLast={
									messages.indexOf(message) ===
									messages.length - 1
								}
							/>
						))}

						{/* Streaming message */}
						{isStreaming && streamingMessage && (
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
						{isStreaming && !streamingMessage && (
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

				<div className="absolute bottom-4 left-0 right-0 px-6">
					<ChatInput
						onSend={handleSendMessage}
						onStop={handleStopStreaming}
						mode={mode}
						setMode={setMode}
						prompt={prompt}
						setPrompt={setPrompt}
						isExecuting={isStreaming}
						workflowStatus={isStreaming ? "running" : "completed"}
						hideModeSelection={true}
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
				<div className="flex items-center justify-center h-screen">
					<ChatSkeleton />
				</div>
			}
		>
			<ChatPageContent />
		</Suspense>
	);
}
