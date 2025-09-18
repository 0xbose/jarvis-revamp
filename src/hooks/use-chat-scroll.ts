import { useCallback, useEffect, useRef, useState } from "react";

export const useChatScroll = () => {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const chatContainerRef = useRef<HTMLDivElement>(null);
	const [isUserScrolling, setIsUserScrolling] = useState(false);
	const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const lastMessageCountRef = useRef(0);

	const scrollToBottom = useCallback(() => {
		if (messagesEndRef.current && !isUserScrolling) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [isUserScrolling]);

	const handleScroll = useCallback(() => {
		if (!chatContainerRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } =
			chatContainerRef.current;
		const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold

		if (!isAtBottom) {
			setIsUserScrolling(true);
		} else {
			setIsUserScrolling(false);
		}

		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current);
		}

		scrollTimeoutRef.current = setTimeout(() => {
			const { scrollTop, scrollHeight, clientHeight } =
				chatContainerRef.current!;
			const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

			if (isAtBottom) {
				setIsUserScrolling(false);
			}
		}, 1000);
	}, []);

	const useScrollOnNewMessages = (messageCount: number) => {
		useEffect(() => {
			if (messageCount > lastMessageCountRef.current) {
				scrollToBottom();
			}
			lastMessageCountRef.current = messageCount;
		}, [messageCount, scrollToBottom]);
	};

	useEffect(() => {
		return () => {
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}
		};
	}, []);

	return {
		messagesEndRef,
		chatContainerRef,
		isUserScrolling,
		handleScroll,
		scrollToBottom,
		useScrollOnNewMessages,
	};
};
