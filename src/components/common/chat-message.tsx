"use client";

import { base64ToDataUrl } from "@/lib/utils";
import Image from "next/image";
import { useState } from "react";
import {
	CircleIcon as CircleQuestionMark,
	CircleAlert,
	ExternalLinkIcon,
	Bell,
	Check,
	X,
	AlertTriangleIcon,
	LucideCircleQuestionMark,
	DownloadIcon,
	AlertCircle,
	MessageSquare,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { MDXRenderer, isMarkdownContent } from "./mdx-renderer";
import { ChatMsg } from "@/types/chat";
import Link from "next/link";

function convertUrlsToLinks(text: string): React.ReactNode {
	if (!text || typeof text !== "string") return text;

	const urlRegex = /(https?:\/\/[^\s]+)/g;
	const parts = text.split(urlRegex);

	return parts.map((part, index) => {
		if (urlRegex.test(part)) {
			return (
				<Link
					key={index}
					href={part}
					target="_blank"
					className="text-blue-400 hover:text-blue-300 underline transition-colors"
				>
					{part.length > 50 ? `${part.substring(0, 50)}...` : part}
				</Link>
			);
		}
		return part;
	});
}

interface ChatMessageProps {
	message: ChatMsg;
	isLast?: boolean;
	onNotificationYes?: (notification: any) => Promise<void>;
	onNotificationNo?: (notification: any) => Promise<void>;
	isPendingNotification?: boolean;
	onFeedbackProceed?: (question: string, answer: string) => Promise<void>;
	onFeedbackSubmit?: (
		question: string,
		answer: string,
		feedback: string
	) => Promise<void>;
	showFeedbackButtons?: boolean;
	workflowStatus?: string;
}

export function ChatMessage({
	message,
	isLast = false,
	onNotificationYes,
	onNotificationNo,
	isPendingNotification = false,
	onFeedbackProceed,
	onFeedbackSubmit,
	showFeedbackButtons = false,
	workflowStatus,
}: ChatMessageProps) {
	const [showFeedbackInput, setShowFeedbackInput] = useState(false);
	const [feedbackText, setFeedbackText] = useState("");
	const [hideAuthButton, setHideAuthButton] = useState(false);
	const [hideFeedbackButtons, setHideFeedbackButtons] = useState(false);
	const [hideNotificationButtons, setHideNotificationButtons] =
		useState(false);
	const [showAuthConfirmation, setShowAuthConfirmation] = useState(false);

	const shouldHideInteractiveElements = () => {
		const shouldHide =
			message.subnetStatus !== "waiting_response" &&
			workflowStatus !== "waiting_response";

		if (message.subnetStatus) {
			if (message.subnetStatus === "pending" && message.questionData) {
				return false;
			}
			return message.subnetStatus !== "waiting_response";
		}

		return shouldHide;
	};

	const shouldHideMessageContent = () => {
		return false;
	};

	console.log(`🔍 ChatMessage debug:`, {
		messageType: message.type,
		subnetStatus: message.subnetStatus,
		workflowStatus,
		shouldHideInteractiveElements: shouldHideInteractiveElements(),
		shouldHideMessageContent: shouldHideMessageContent(),
		showFeedbackButtons,
		hasQuestionData: !!message.questionData,
		questionType: message.questionData?.type,
		isAuthentication: message.questionData?.type === "authentication",
		isFeedback: message.questionData?.type === "feedback",
		isNotification: message.questionData?.type === "notification",
	});

	const shouldHideAuthButton = () =>
		shouldHideInteractiveElements() || hideAuthButton;
	const shouldHideFeedbackButtons = () =>
		shouldHideInteractiveElements() || hideFeedbackButtons;
	const shouldHideNotificationButtons = () =>
		shouldHideInteractiveElements() || hideNotificationButtons;

	if (message.type === "user") {
		return (
			<div className="relative mb-0">
				<div className="flex-1 min-w-0 pb-4">
					<h2 className="text-2xl font-bold text-white leading-tight mb-2 capitalize">
						{message.content}
					</h2>
					{message.imageData && (
						<div className="mt-3">
							{message.isImage ? (
								<div className="flex flex-col items-start gap-2">
									<Image
										src={base64ToDataUrl(
											message.imageData,
											message.contentType || "image/jpeg"
										)}
										alt="Generated image"
										width={400}
										height={400}
										className="rounded-lg border border-border max-w-full h-auto"
										onError={(e) => {
											console.error(
												"Failed to load image:",
												e
											);
										}}
									/>
									<Button
										onClick={() => {
											const link =
												document.createElement("a");
											link.href = base64ToDataUrl(
												message.imageData!,
												message.contentType ||
													"image/jpeg"
											);
											link.download =
												"generated_image." +
												((message.contentType &&
													message.contentType.split(
														"/"
													)[1]) ||
													"jpg");
											link.click();
										}}
										variant="outline"
										size="sm"
									>
										<DownloadIcon className="w-4 h-4" />
										Download
									</Button>
								</div>
							) : (
								<div className="p-4 border border-border rounded-lg bg-muted/20">
									<div className="flex items-center gap-3">
										<div className="p-2 bg-primary/10 rounded-lg">
											<svg
												className="w-6 h-6 text-primary"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.293.707l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
												/>
											</svg>
										</div>
										<div className="flex-1">
											<p className="text-sm font-medium text-foreground">
												{message.contentType
													? message.contentType
															.split("/")[1]
															.toUpperCase()
													: "File"}{" "}
												generated
											</p>
											<p className="text-xs text-muted-foreground">
												{message.contentType ||
													"Unknown type"}
											</p>
										</div>
										<button
											onClick={() => {
												const link =
													document.createElement("a");
												link.href = base64ToDataUrl(
													message.imageData!,
													message.contentType ||
														"application/octet-stream"
												);
												link.download = `generated_file.${
													message.contentType?.split(
														"/"
													)[1] || "bin"
												}`;
												link.click();
											}}
											className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
										>
											Download
										</button>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		);
	}

	// Notification message - for system notifications
	if (message.type === "notification") {
		return (
			<div className="relative mb-0">
				{!isLast && (
					<div
						className="absolute left-2 top-0 w-px h-full z-0 overflow-hidden"
						style={{ height: "calc(100% + 1.5rem)" }}
					>
						<div className="absolute inset-0 bg-gray-600"></div>
						<div
							className="absolute w-full bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-60"
							style={{
								height: "60px",
								animation: "flowDown 2s ease-in-out infinite",
								animationDelay: "0.5s",
							}}
						></div>
					</div>
				)}
				<div className="relative flex items-start">
					<div className="relative z-10 flex-shrink-0 ml-0.5 mr-4 pt-1">
						<div className="size-3 rounded-full border-2 border-gray-700 bg-gray-500"></div>
					</div>
					<div className="flex-1 min-w-0 p-4 border border-border/50 rounded-lg">
						<div className="text-sm font-medium mb-2 flex items-center gap-2 text-gray-400">
							<Bell className="w-4 h-4" />
							<span>Notification</span>
							{message.toolName && (
								<>
									<span className="text-gray-600">•</span>
									<span className="italic">
										{message.toolName
											.charAt(0)
											.toUpperCase() +
											message.toolName.slice(1)}{" "}
										Agent
									</span>
								</>
							)}
						</div>
						<div>
							<div className="text-foreground text-sm leading-relaxed">
								{isMarkdownContent(message.content) ? (
									<MDXRenderer content={message.content} />
								) : (
									convertUrlsToLinks(message.content)
								)}
							</div>
							{/* Show Yes/No buttons if this is a pending notification and workflow is not in progress */}
							{isPendingNotification &&
								onNotificationYes &&
								onNotificationNo &&
								!shouldHideNotificationButtons() && (
									<div className="flex gap-3 mt-4">
										<Button
											onClick={() => {
												// Hide the notification buttons immediately when clicked
												setHideNotificationButtons(
													true
												);
												onNotificationYes(message);
											}}
											variant="outline"
											size="sm"
											className="flex items-center gap-2 text-green-500 hover:text-green-400 bg-green-950/60 hover:bg-green-950/70 border border-green-800/50 hover:border-green-800/70"
										>
											<Check className="w-4 h-4" />
											Yes
										</Button>
										<Button
											onClick={() => {
												// Hide the notification buttons immediately when clicked
												setHideNotificationButtons(
													true
												);
												onNotificationNo(message);
											}}
											variant="outline"
											size="sm"
											className="flex items-center gap-2 text-red-500 hover:text-red-400 bg-red-950/60 hover:bg-red-950/70 border border-red-800/50 hover:border-red-800/70"
										>
											<X className="w-4 h-4" />
											No
										</Button>
									</div>
								)}
						</div>

						{/* <div className="text-xs text-gray-500 mt-2">
							{message.timestamp.toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</div> */}
					</div>
				</div>
			</div>
		);
	}

	if (message.type === "question") {
		const isAuthentication =
			message.questionData?.type === "authentication";
		return (
			<div className="relative mb-0">
				{!isLast && (
					<div
						className="absolute left-2 top-0 w-px h-full z-0 overflow-hidden"
						style={{ height: "calc(100% + 1.5rem)" }}
					>
						<div className="absolute inset-0 bg-gray-600"></div>
						<div
							className="absolute w-full bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-60"
							style={{
								height: "60px",
								animation: "flowDown 2s ease-in-out infinite",
								animationDelay: "1s",
							}}
						></div>
					</div>
				)}
				<div className="relative flex items-start">
					<div className="relative z-10 flex-shrink-0 ml-0.5 mr-4 pt-1">
						<div className="size-3 rounded-full border-2 border-gray-700 bg-gray-500"></div>
					</div>
					<div className="flex-1 min-w-0 p-4 border border-border/50 rounded-lg">
						<div className="text-sm font-medium mb-2 flex items-center gap-2 text-gray-400">
							{isAuthentication ? (
								<LucideCircleQuestionMark className="w-4 h-4" />
							) : (
								<AlertCircle className="size-4 " />
							)}
							<span>
								{message.questionData?.type
									? message.questionData.type
											.charAt(0)
											.toUpperCase() +
									  message.questionData.type.slice(1)
									: "Question"}
							</span>
							{message.toolName && (
								<>
									<span className="text-gray-600">•</span>
									<span className="italic">
										{message.toolName
											.charAt(0)
											.toUpperCase() +
											message.toolName.slice(1)}{" "}
										Agent
									</span>
								</>
							)}
						</div>
						<div>
							<div className="text-foreground text-sm leading-relaxed overflow-hidden">
								{(() => {
									const content =
										message.questionData?.text ||
										message.content;
									return isMarkdownContent(content) ? (
										<MDXRenderer content={content} />
									) : (
										convertUrlsToLinks(content)
									);
								})()}
							</div>
							{isAuthentication && !shouldHideAuthButton() ? (
								<div className="mt-3 space-y-2">
									{message.questionData?.expiresAt && (
										<p className="text-xs text-gray-400 mt-2">
											Expires at{" "}
											<span>
												{new Date(
													message.questionData.expiresAt
												).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
												})}
											</span>
										</p>
									)}
									<Button
										onClick={() => {
											const questionText =
												message.questionData?.text ||
												message.content;
											console.log(
												"Auth button clicked - questionText:",
												questionText
											);

											const authUrlMatch =
												questionText.match(
													/Auth URL:\s*(https?:\/\/[^\s]+)/
												);
											console.log(
												"Auth URL match result:",
												authUrlMatch
											);

											if (authUrlMatch) {
												const authUrl = authUrlMatch[1];
												console.log(
													"Opening auth URL:",
													authUrl
												);
												window.open(
													authUrl,
													"_blank",
													"noopener,noreferrer"
												);
											} else {
												console.log(
													"No Auth URL found in message content"
												);
												// Try alternative patterns
												const altUrlMatch1 =
													questionText.match(
														/https?:\/\/[^\s]+/
													);
												const altUrlMatch2 =
													questionText.match(
														/URL:\s*(https?:\/\/[^\s]+)/
													);
												console.log(
													"Alternative URL patterns:",
													{
														altUrlMatch1,
														altUrlMatch2,
													}
												);

												if (altUrlMatch1) {
													console.log(
														"Found URL with alternative pattern:",
														altUrlMatch1[0]
													);
													window.open(
														altUrlMatch1[0],
														"_blank",
														"noopener,noreferrer"
													);
												}
											}

											// Show authentication confirmation UI after opening the link
											setShowAuthConfirmation(true);
											setHideAuthButton(true);
										}}
										variant="outline"
										size="sm"
										className="flex items-center gap-2 text-gray-300 hover:text-gray-400 bg-sidebar/30 hover:bg-sidebar/20 border border-border hover:border-border/70"
									>
										<ExternalLinkIcon className="w-4 h-4" />
										Authenticate
									</Button>
								</div>
							) : null}

							{showFeedbackButtons &&
							!shouldHideFeedbackButtons() ? (
								<div className="mt-4 space-y-3">
									{!showFeedbackInput ? (
										<div className="flex gap-3">
											<Button
												onClick={async () => {
													// Hide the feedback buttons immediately when clicked
													setHideFeedbackButtons(
														true
													);

													if (
														onFeedbackProceed &&
														message.questionData
															?.text
													) {
														await onFeedbackProceed(
															message.questionData
																.text,
															"Yes, proceed"
														);
													}
												}}
												variant="outline"
												size="sm"
												className="flex items-center gap-2 text-green-500 hover:text-green-400 bg-green-950/60 hover:bg-green-950/70 border border-green-800/50 hover:border-green-800/70"
											>
												<Check className="w-4 h-4" />
												Yes, proceed
											</Button>
											<Button
												onClick={() => {
													// Don't hide feedback buttons, just show input
													setShowFeedbackInput(true);
												}}
												variant="outline"
												size="sm"
												className="flex items-center gap-2 text-blue-500 hover:text-blue-400 bg-blue-950/60 hover:bg-blue-950/70 border border-blue-800/50 hover:border-blue-800/70"
											>
												<MessageSquare className="w-4 h-4" />
												Provide feedback
											</Button>
										</div>
									) : (
										<div className="space-y-3">
											<div className="flex gap-2">
												<Input
													value={feedbackText}
													onChange={(e) =>
														setFeedbackText(
															e.target.value
														)
													}
													placeholder="Type your feedback here..."
													className="flex-1"
												/>
												<Button
													onClick={async () => {
														if (
															onFeedbackSubmit &&
															message.questionData
																?.text &&
															feedbackText.trim()
														) {
															await onFeedbackSubmit(
																message
																	.questionData
																	.text,
																"User feedback",
																feedbackText.trim()
															);
															setFeedbackText("");
															setShowFeedbackInput(
																false
															);
															// Hide the feedback buttons after successful submission
															setHideFeedbackButtons(
																true
															);
														}
													}}
													variant="outline"
													size="sm"
													className="flex items-center gap-2 text-blue-500 hover:text-blue-400 bg-blue-950/60 hover:bg-blue-950/70 border border-blue-800/50 hover:border-blue-800/70"
													disabled={
														!feedbackText.trim()
													}
												>
													<MessageSquare className="w-4 h-4" />
													Submit
												</Button>
											</div>
											<Button
												onClick={() => {
													setShowFeedbackInput(false);
													setFeedbackText("");
												}}
												variant="outline"
												size="sm"
												className="text-gray-400 hover:text-gray-300 bg-gray-950/60 hover:bg-gray-950/70 border border-gray-800/50 hover:border-gray-800/70"
											>
												Cancel
											</Button>
										</div>
									)}
								</div>
							) : null}

							{/* Authentication Confirmation UI */}
							{showAuthConfirmation &&
								message.questionData?.type ===
									"authentication" && (
									<div className="mt-4 space-y-3">
										<div className="flex items-center gap-2 text-blue-400 mb-2">
											<AlertCircle className="w-4 h-4" />
											<span className="text-sm font-medium">
												Authentication Required
											</span>
										</div>
										<p className="text-gray-300 text-sm mb-3">
											Have you completed the
											authentication process in the new
											tab?
										</p>
										<div className="flex gap-3">
											<Button
												onClick={async () => {
													setShowAuthConfirmation(
														false
													);

													if (
														onFeedbackProceed &&
														message.questionData
															?.text
													) {
														await onFeedbackProceed(
															message.questionData
																.text,
															"Yes, I have authenticated successfully"
														);
													}
												}}
												variant="outline"
												size="sm"
												className="flex items-center gap-2 text-green-500 hover:text-green-400 bg-green-950/60 hover:bg-green-950/70 border border-green-800/50 hover:border-green-800/70"
											>
												<Check className="w-4 h-4" />
												Yes, Authenticated
											</Button>
											<Button
												onClick={() => {
													setShowAuthConfirmation(
														false
													);
													setHideAuthButton(false);
												}}
												variant="outline"
												size="sm"
												className="text-gray-400 hover:text-gray-300 bg-gray-950/60 hover:bg-gray-950/70 border border-gray-800/50 hover:border-gray-800/70"
											>
												<X className="w-4 h-4" />
												Cancel
											</Button>
										</div>
									</div>
								)}
						</div>

						{/* <div className="text-xs text-gray-500 mt-2">
							{message.timestamp.toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</div> */}
					</div>
				</div>
			</div>
		);
	}

	// Answer message - user's response to a question
	if (message.type === "answer") {
		return (
			<div className="relative mb-0">
				{!isLast && (
					<div
						className="absolute left-2 top-0 w-px h-full z-0 overflow-hidden"
						style={{ height: "calc(100% + 1.5rem)" }}
					>
						<div className="absolute inset-0 bg-gray-600"></div>
						<div
							className="absolute w-full bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-60"
							style={{
								height: "60px",
								animation: "flowDown 2s ease-in-out infinite",
								animationDelay: "1.5s",
							}}
						></div>
					</div>
				)}
				<div className="relative flex items-start">
					<div className="relative z-10 flex-shrink-0 ml-0.5 mr-4 pt-1">
						<div className="size-3 rounded-full border-2 border-gray-700 bg-gray-500"></div>
					</div>
					<div className="flex-1 min-w-0 p-4 border border-border/50 rounded-lg">
						<div className="text-sm mb-1 flex items-center gap-2">
							<span className="italic text-gray-400">
								Your answer
							</span>
						</div>
						{isMarkdownContent(message.content) ? (
							<div className="w-fit px-5 py-2 rounded-lg border border-border bg-sidebar/20 text-foreground text-sm leading-relaxed">
								<MDXRenderer content={message.content} />
							</div>
						) : (
							convertUrlsToLinks(message.content)
						)}
						{/* <div className="text-xs text-gray-500 mt-2">
							{message.timestamp.toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</div> */}
					</div>
				</div>
			</div>
		);
	}

	// Workflow subnet message - shows status of individual workflow steps
	if (message.type === "workflow_subnet") {
		const getStatusIcon = () => {
			switch (message.subnetStatus) {
				case "in_progress":
				case "waiting_response":
					return (
						<span className="relative flex size-3">
							<span className="absolute h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
							<span className="relative size-3 inline-flex rounded-full bg-accent"></span>
						</span>
					);
				case "failed":
					return (
						<div className="size-3 rounded-full border-2 border-red-600 bg-red-500 flex items-center justify-center">
							<X className="size-2 text-white" />
						</div>
					);
				case "done":
					return (
						<div className="size-3 rounded-full border-2 border-gray-700 bg-gray-500 flex items-center justify-center">
							<Check className="size-2 text-white" />
						</div>
					);
				default:
					// All other statuses: gray, same size and style
					return (
						<div className="size-3 rounded-full border-2 border-gray-700 bg-gray-500"></div>
					);
			}
		};

		const getStatusText = () => {
			switch (message.subnetStatus) {
				case "pending":
					return "Queued";
				case "in_progress":
					return "Processing";
				case "waiting_response":
					return "Waiting for input";
				case "done":
					return "Completed";
				case "failed":
					return "Failed";
				default:
					return "";
			}
		};

		return (
			<div className="relative mb-0">
				{!isLast && (
					<div
						className="absolute left-2 top-0 w-px h-full z-0 overflow-hidden"
						style={{ height: "calc(100% + 1.5rem)" }}
					>
						<div className="absolute inset-0 bg-gray-600"></div>
						<div
							className="absolute w-full bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-60"
							style={{
								height: "60px",
								animation: "flowDown 2s ease-in-out infinite",
								animationDelay: "2s",
							}}
						></div>
					</div>
				)}
				<div className="relative flex items-start">
					<div className="relative z-10 flex-shrink-0 ml-0.5 mr-4 pt-1">
						{getStatusIcon()}
					</div>
					<div
						className={`flex-1 min-w-0 p-4 border rounded-lg ${
							message.subnetStatus === "failed"
								? "border-red-500/50 bg-red-950/20"
								: "border-border"
						}`}
					>
						{message.toolName && (
							<div className="text-sm mb-1 flex items-center gap-2">
								<span
									className={`italic ${
										message.subnetStatus === "failed"
											? "text-red-300"
											: "text-gray-400"
									}`}
								>
									{message.toolName.charAt(0).toUpperCase() +
										message.toolName.slice(1)}{" "}
									Agent
								</span>
								{getStatusText() &&
									message.subnetStatus !== "done" && (
										<>
											<span className="text-gray-600">
												•
											</span>
											<span
												className={`text-xs ${
													message.subnetStatus ===
													"failed"
														? "text-red-400"
														: "text-gray-400"
												}`}
											>
												{getStatusText()}
											</span>
										</>
									)}
							</div>
						)}
						{/* Show content for all subnets, including pending ones with data */}
						{message.content && (
							<div
								className={`text-sm leading-relaxed ${
									message.subnetStatus === "failed"
										? "text-red-200"
										: "text-gray-200"
								}`}
							>
								{isMarkdownContent(message.content) ? (
									<MDXRenderer content={message.content} />
								) : (
									<div className="whitespace-pre-wrap">
										{convertUrlsToLinks(message.content)}
									</div>
								)}
							</div>
						)}
						{/* Display file content if present */}
						{message.imageData && (
							<div className="mt-3">
								{message.isImage ? (
									<Image
										src={base64ToDataUrl(
											message.imageData,
											message.contentType || "image/jpeg"
										)}
										alt="Generated image"
										width={400}
										height={400}
										className="rounded-lg border border-border max-w-full h-auto"
										onError={(e) => {
											console.error(
												"Failed to load image:",
												e
											);
										}}
									/>
								) : (
									<div className="p-4 border border-border rounded-lg bg-muted/20">
										<div className="flex items-center gap-3">
											<div className="p-2 bg-primary/10 rounded-lg">
												<svg
													className="w-6 h-6 text-primary"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.293.707l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
													/>
												</svg>
											</div>
											<div className="flex-1">
												<p className="text-sm font-medium text-foreground">
													{message.contentType
														? message.contentType
																.split("/")[1]
																.toUpperCase()
														: "File"}{" "}
													generated
												</p>
												<p className="text-xs text-muted-foreground">
													{message.contentType ||
														"Unknown type"}
												</p>
											</div>
											<button
												onClick={() => {
													const link =
														document.createElement(
															"a"
														);
													link.href = base64ToDataUrl(
														message.imageData!,
														message.contentType ||
															"application/octet-stream"
													);
													link.download = `generated_file.${
														message.contentType?.split(
															"/"
														)[1] || "bin"
													}`;
													link.click();
												}}
												className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
											>
												Download
											</button>
										</div>
									</div>
								)}
							</div>
						)}
						{/* <div className="text-xs text-gray-500 mt-2">
							{message.timestamp.toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</div> */}
					</div>
				</div>
			</div>
		);
	}

	// Response message - general system responses
	return (
		<div className="relative mb-0">
			{!isLast && (
				<div
					className="absolute left-2 top-0 w-px h-full z-0 overflow-hidden"
					style={{ height: "calc(100% + 1.5rem)" }}
				>
					<div className="absolute inset-0 bg-gray-600"></div>
					<div
						className="absolute w-full bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-60"
						style={{
							height: "60px",
							animation: "flowDown 2s ease-in-out infinite",
							animationDelay: "2.5s",
						}}
					></div>
				</div>
			)}
			<div className="relative flex items-start">
				<div className="relative z-10 flex-shrink-0 ml-0.5 mr-4 pt-1">
					<div className="size-3 rounded-full border-2 border-gray-700 bg-gray-500"></div>
				</div>
				<div className="flex-1 min-w-0 p-4 border border-border/50 rounded-lg">
					{message.toolName && (
						<div className="text-sm mb-1 flex items-center gap-2">
							<span className="italic text-gray-400">
								{message.toolName.charAt(0).toUpperCase() +
									message.toolName.slice(1)}{" "}
								Agent
							</span>
						</div>
					)}
					<div className="text-gray-200 text-sm leading-relaxed">
						{isMarkdownContent(message.content) ? (
							<MDXRenderer content={message.content} />
						) : (
							<div className="whitespace-pre-wrap">
								{convertUrlsToLinks(message.content)}
							</div>
						)}
					</div>
					{/* <div className="text-xs text-gray-500 mt-2">
						{message.timestamp.toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
						})}
					</div> */}
				</div>
			</div>
		</div>
	);
}
