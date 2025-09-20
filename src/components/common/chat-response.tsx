"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, memo } from "react";
import { Bot, DownloadIcon } from "lucide-react";
import { Button } from "../ui/button";
import { MDXRenderer, isMarkdownContent } from "./mdx-renderer";
import { ChatMsg } from "@/types/chat";
import { LoadingDots } from "../ui/loading-dots";

interface ChatResponseProps {
	message: ChatMsg;
}

const Linkify = memo(({ text }: { text: string }) => {
	if (!text) return null;

	const parts = text.split(/(https?:\/\/[^\s"',}]+)/g);
	return (
		<>
			{parts.map((part, i) =>
				/^https?:\/\//.test(part) ? (
					<Link
						key={i}
						href={part}
						target="_blank"
						className="text-blue-400 hover:text-blue-300 underline"
					>
						{part.slice(0, 50)}
						{part.length > 50 && "..."}
					</Link>
				) : (
					part
				)
			)}
		</>
	);
});
Linkify.displayName = "Linkify";

const StreamingText = memo(
	({ text, streaming }: { text: string; streaming: boolean }) => {
		const [shown, setShown] = useState("");
		const indexRef = useRef(0);

		useEffect(() => {
			if (!streaming) {
				setShown(text);
				return;
			}

			if (text.length < shown.length) {
				setShown("");
				indexRef.current = 0;
			}

			const timer = setInterval(() => {
				if (indexRef.current >= text.length) {
					clearInterval(timer);
					return;
				}

				const chunk = text.slice(
					indexRef.current,
					indexRef.current + 3
				);
				indexRef.current += chunk.length;
				setShown(text.slice(0, indexRef.current));
			}, 25);

			return () => clearInterval(timer);
		}, [text, streaming]);

		return (
			<>
				<Linkify text={shown} />
				{streaming && (
					<span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse" />
				)}
			</>
		);
	}
);
StreamingText.displayName = "StreamingText";

const DownloadBtn = memo(
	({ url, filename }: { url: string; filename: string }) => {
		const download = () => {
			const a = document.createElement("a");
			a.href = url.includes("/api/image/proxy")
				? new URLSearchParams(url.split("?")[1]).get("url") || url
				: url;
			a.download = filename;
			a.click();
		};

		return (
			<Button
				size="icon"
				className="p-1 bg-background/80"
				onClick={download}
			>
				<DownloadIcon className="w-3 h-3" />
			</Button>
		);
	}
);
DownloadBtn.displayName = "DownloadBtn";

export function ChatResponse({ message }: ChatResponseProps) {
	const [imgLoaded, setImgLoaded] = useState(false);
	const ext = message.contentType?.split("/")[1] || "jpg";

	return (
		<div className="mb-6 flex">
			<div className="flex items-start gap-3 md:max-w-[85%]">
				{/* Avatar */}
				<div className="hidden md:flex size-10 rounded-full bg-secondary/30 border border-secondary items-center justify-center flex-shrink-0">
					<video
						muted
						autoPlay
						playsInline
						loop
						src="/video/agent_avatar.mp4"
						className="size-full object-cover rounded-full"
					/>
				</div>

				{/* Content */}
				<div className="bg-secondary/30 rounded-2xl rounded-tl-md px-4 py-3 border border-secondary/20">
					{/* Text */}
					{message.content ? (
						<div className="text-sm leading-relaxed">
							{isMarkdownContent(message.content) ? (
								<MDXRenderer content={message.content} />
							) : (
								<div className="whitespace-pre-wrap break-words">
									{message.showLoadingDots ? (
										<StreamingText
											text={message.content}
											streaming
										/>
									) : (
										<Linkify text={message.content} />
									)}
								</div>
							)}
						</div>
					) : message.showLoadingDots ? (
						<LoadingDots />
					) : null}

					{/* Media */}
					{message.imageData && (
						<div className="mt-3">
							{message.isImage ? (
								<div className="relative w-fit">
									<Image
										src={message.imageData}
										alt="Generated"
										width={400}
										height={400}
										className="rounded-lg border border-border"
										onLoad={() => setImgLoaded(true)}
										onError={(e) => {
											const img =
												e.target as HTMLImageElement;
											if (
												img.src.includes(
													"/api/image/proxy"
												)
											) {
												const url = new URLSearchParams(
													img.src.split("?")[1]
												).get("url");
												if (url) img.src = url;
											}
										}}
									/>
									{imgLoaded && (
										<div className="absolute top-2 right-2">
											<DownloadBtn
												url={message.imageData}
												filename={`ai_image.${ext}`}
											/>
										</div>
									)}
								</div>
							) : (
								<div className="p-3 border rounded-lg bg-muted/20 flex items-center gap-3">
									<div className="p-2 bg-secondary/10 rounded">
										<svg
											className="w-5 h-5"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.707.293V19a2 2 0 01-2 2z"
											/>
										</svg>
									</div>
									<div className="flex-1">
										<p className="text-sm font-medium">
											{ext.toUpperCase()} file
										</p>
										<p className="text-xs opacity-70">
											{message.contentType}
										</p>
									</div>
									<button
										onClick={() => {
											const a =
												document.createElement("a");
											a.href = message.imageData!;
											a.download = `ai_file.${ext}`;
											a.click();
										}}
										className="px-3 py-1 text-xs bg-secondary rounded hover:opacity-80"
									>
										Download
									</button>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
