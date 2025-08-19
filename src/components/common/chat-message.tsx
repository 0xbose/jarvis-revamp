"use client";

import { base64ToDataUrl } from "@/lib/utils";
import Image from "next/image";
import { useState, useEffect } from "react";
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
	RefreshCw,
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
	pollingStoppedAt?: Date | null;
	onRefreshPolling?: () => void;
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
	pollingStoppedAt,
	onRefreshPolling,
}: ChatMessageProps) {
	const [showFeedbackInput, setShowFeedbackInput] = useState(false);
	const [feedbackText, setFeedbackText] = useState("");
	const [hideAuthButton, setHideAuthButton] = useState(false);
	const [hideFeedbackButtons, setHideFeedbackButtons] = useState(false);
	const [hideNotificationButtons, setHideNotificationButtons] =
		useState(false);
	const [showAuthConfirmation, setShowAuthConfirmation] = useState(false);
	const [feedbackProcessed, setFeedbackProcessed] = useState(false);

	// New state for button interaction tracking during workflow execution
	const [clickedButtonType, setClickedButtonType] = useState<string | null>(
		null
	);
	const [isButtonPending, setIsButtonPending] = useState(false);

	// Helper function to check if refresh UI should be shown
	const shouldShowRefreshUI = () => {
		if (!pollingStoppedAt || !onRefreshPolling) return false;

		const timeSinceStoppedMs = Date.now() - pollingStoppedAt.getTime();
		const oneMinuteMs = 60 * 1000;

		return (
			workflowStatus === "waiting_response" &&
			timeSinceStoppedMs > oneMinuteMs &&
			message.subnetStatus === "waiting_response" &&
			isLast
		);
	};

	const isWorkflowActivelyExecuting = () => {
		return (
			workflowStatus === "running" ||
			workflowStatus === "in_progress" ||
			workflowStatus === "waiting_response" ||
			workflowStatus === "pending"
		);
	};

	const shouldDisableButtons = () => {
		return isWorkflowActivelyExecuting() && isButtonPending;
	};

	const getButtonClassName = (baseClassName: string, buttonType: string) => {
		const isThisButtonClicked = clickedButtonType === buttonType;
		const isDisabled = shouldDisableButtons();

		if (isDisabled && isThisButtonClicked) {
			return `${baseClassName} opacity-100 ring-2 ring-blue-400/50 bg-blue-950/80 border-blue-600`;
		} else if (isDisabled && !isThisButtonClicked) {
			return `${baseClassName} opacity-50 cursor-not-allowed`;
		}

		return baseClassName;
	};

	const shouldHideInteractiveElements = () => {
		const shouldHide =
			message.subnetStatus !== "waiting_response" &&
			workflowStatus !== "waiting_response";

		if (
			message.type === "question" &&
			message.questionData?.type === "feedback"
		) {
			return false;
		}

		if (message.subnetStatus) {
			if (message.subnetStatus === "pending" && message.questionData) {
				return false;
			}
			const hideBasedOnStatus =
				message.subnetStatus !== "waiting_response";

			return hideBasedOnStatus;
		}

		return shouldHide;
	};

	const shouldHideMessageContent = () => {
		return false;
	};

	const shouldHideAuthButton = () =>
		shouldHideInteractiveElements() || hideAuthButton;
	const shouldHideFeedbackButtons = () => {
		// If feedback was already processed for this specific message, hide the buttons
		if (feedbackProcessed) {
			return true;
		}

		const hideInteractive = shouldHideInteractiveElements();
		const shouldHide = hideInteractive || hideFeedbackButtons;

		if (
			message.type === "question" &&
			message.questionData?.type === "feedback"
		) {
			console.log(`🔍 shouldHideFeedbackButtons for feedback question:`, {
				messageId: message.id,
				hideInteractive,
				hideFeedbackButtons,
				feedbackProcessed,
				shouldHide,
				questionText: message.questionData?.text?.slice(0, 30),
			});
		}

		return shouldHide;
	};
	const shouldHideNotificationButtons = () =>
		shouldHideInteractiveElements() || hideNotificationButtons;

	// Reset button states when workflow completes or is no longer actively executing
	useEffect(() => {
		if (!isWorkflowActivelyExecuting()) {
			setClickedButtonType(null);
			setIsButtonPending(false);
			// When workflow completes, hide the buttons that were interacted with
			if (clickedButtonType) {
				if (clickedButtonType.includes("notification")) {
					setHideNotificationButtons(true);
				}
				if (clickedButtonType.includes("feedback")) {
					setFeedbackProcessed(true);
				}
				if (clickedButtonType.includes("auth")) {
					setHideAuthButton(true);
				}
			}
		}
	}, [workflowStatus, clickedButtonType]);

	// Reset button states when showing feedback input to clear any stuck states
	useEffect(() => {
		if (showFeedbackInput) {
			setClickedButtonType(null);
			setIsButtonPending(false);
		}
	}, [showFeedbackInput]);

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
					<div className="relative Z-0 flex-shrink-0 ml-0.5 mr-4 pt-1">
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
												if (shouldDisableButtons())
													return;

												// Set button state for workflow execution
												if (
													isWorkflowActivelyExecuting()
												) {
													setClickedButtonType(
														"notification-yes"
													);
													setIsButtonPending(true);
												} else {
													// Hide the notification buttons immediately when clicked (only for history/non-executing workflows)
													setHideNotificationButtons(
														true
													);
												}

												onNotificationYes(message);
											}}
											variant="outline"
											size="sm"
											disabled={
												shouldDisableButtons() &&
												clickedButtonType !==
													"notification-yes"
											}
											className={getButtonClassName(
												"flex items-center gap-2 text-green-500 hover:text-green-400 bg-green-950/60 hover:bg-green-950/70 border border-green-800/50 hover:border-green-800/70",
												"notification-yes"
											)}
										>
											<Check className="w-4 h-4" />
											Yes
										</Button>
										<Button
											onClick={() => {
												if (shouldDisableButtons())
													return;

												// Set button state for workflow execution
												if (
													isWorkflowActivelyExecuting()
												) {
													setClickedButtonType(
														"notification-no"
													);
													setIsButtonPending(true);
												} else {
													// Hide the notification buttons immediately when clicked (only for history/non-executing workflows)
													setHideNotificationButtons(
														true
													);
												}

												onNotificationNo(message);
											}}
											variant="outline"
											size="sm"
											disabled={
												shouldDisableButtons() &&
												clickedButtonType !==
													"notification-no"
											}
											className={getButtonClassName(
												"flex items-center gap-2 text-red-500 hover:text-red-400 bg-red-950/60 hover:bg-red-950/70 border border-red-800/50 hover:border-red-800/70",
												"notification-no"
											)}
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
					<div className="relative Z-0 flex-shrink-0 ml-0.5 mr-4 pt-1">
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
											if (shouldDisableButtons()) return;

											// Set button state for workflow execution
											if (isWorkflowActivelyExecuting()) {
												setClickedButtonType(
													"authenticate"
												);
												setIsButtonPending(true);
											}

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
											if (
												!isWorkflowActivelyExecuting()
											) {
												setHideAuthButton(true);
											}
										}}
										variant="outline"
										size="sm"
										disabled={
											shouldDisableButtons() &&
											clickedButtonType !== "authenticate"
										}
										className={getButtonClassName(
											"flex items-center gap-2 text-gray-300 hover:text-gray-400 bg-sidebar/30 hover:bg-sidebar/20 border border-border hover:border-border/70",
											"authenticate"
										)}
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
													if (shouldDisableButtons())
														return;

													// Set button state for workflow execution
													if (
														isWorkflowActivelyExecuting()
													) {
														setClickedButtonType(
															"feedback-proceed"
														);
														setIsButtonPending(
															true
														);
													}

													// Mark feedback as processed for this specific message
													setFeedbackProcessed(true);

													try {
														if (
															onFeedbackProceed &&
															message.questionData
																?.text
														) {
															await onFeedbackProceed(
																message
																	.questionData
																	.text,
																"Yes, proceed"
															);
														}
													} catch (error) {
														console.error(
															"Error proceeding with feedback:",
															error
														);
														// Show feedback buttons again if failed
														setFeedbackProcessed(
															false
														);
														// Reset button state
														setClickedButtonType(
															null
														);
														setIsButtonPending(
															false
														);
													}
												}}
												variant="outline"
												size="sm"
												disabled={
													shouldDisableButtons() &&
													clickedButtonType !==
														"feedback-proceed"
												}
												className={getButtonClassName(
													"flex items-center gap-2 text-green-500 hover:text-green-400 bg-green-950/60 hover:bg-green-950/70 border border-green-800/50 hover:border-green-800/70",
													"feedback-proceed"
												)}
											>
												<Check className="w-4 h-4" />
												Yes, proceed
											</Button>
											<Button
												onClick={() => {
													if (shouldDisableButtons())
														return;

													// Don't set button pending state for just showing the input
													// The pending state should only be set when actually submitting
													setShowFeedbackInput(true);
												}}
												variant="outline"
												size="sm"
												disabled={
													shouldDisableButtons() &&
													clickedButtonType !==
														"feedback-input"
												}
												className={getButtonClassName(
													"flex items-center gap-2 text-blue-500 hover:text-blue-400 bg-blue-950/60 hover:bg-blue-950/70 border border-blue-800/50 hover:border-blue-800/70",
													"feedback-input"
												)}
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
														// Don't proceed if no feedback text
														if (
															!feedbackText.trim()
														) {
															return;
														}

														// Don't proceed if button is disabled for other reasons
														if (
															isButtonPending &&
															clickedButtonType !==
																"feedback-submit"
														) {
															return;
														}

														try {
															// Set button state for workflow execution
															if (
																isWorkflowActivelyExecuting()
															) {
																setClickedButtonType(
																	"feedback-submit"
																);
																setIsButtonPending(
																	true
																);
															}

															// Mark feedback as processed for this specific message
															setFeedbackProcessed(
																true
															);

															if (
																onFeedbackSubmit &&
																message
																	.questionData
																	?.text
															) {
																await onFeedbackSubmit(
																	message
																		.questionData
																		.text,
																	"User feedback",
																	feedbackText.trim()
																);

																setFeedbackText(
																	""
																);
																setShowFeedbackInput(
																	false
																);
															}
														} catch (error) {
															console.error(
																"Error submitting feedback:",
																error
															);
															// Show feedback buttons again if failed
															setFeedbackProcessed(
																false
															);
														} finally {
															// Always reset button state
															setClickedButtonType(
																null
															);
															setIsButtonPending(
																false
															);
														}
													}}
													variant="outline"
													size="sm"
													disabled={
														!feedbackText.trim() ||
														(isButtonPending &&
															clickedButtonType !==
																"feedback-submit")
													}
													className={getButtonClassName(
														"flex items-center gap-2 text-blue-500 hover:text-blue-400 bg-blue-950/60 hover:bg-blue-950/70 border border-blue-800/50 hover:border-blue-800/70",
														"feedback-submit"
													)}
												>
													<MessageSquare className="w-4 h-4" />
													Submit
												</Button>
											</div>
											<Button
												onClick={() => {
													setShowFeedbackInput(false);
													setFeedbackText("");
													// Reset button states when canceling
													setClickedButtonType(null);
													setIsButtonPending(false);
												}}
												variant="outline"
												size="sm"
												disabled={
													shouldDisableButtons() &&
													clickedButtonType !==
														"feedback-cancel"
												}
												className={getButtonClassName(
													"text-gray-400 hover:text-gray-300 bg-gray-950/60 hover:bg-gray-950/70 border border-gray-800/50 hover:border-gray-800/70",
													"feedback-cancel"
												)}
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
													if (shouldDisableButtons())
														return;

													// Set button state for workflow execution
													if (
														isWorkflowActivelyExecuting()
													) {
														setClickedButtonType(
															"auth-confirm"
														);
														setIsButtonPending(
															true
														);
													}

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

														// Mark feedback as processed for this specific message
														setFeedbackProcessed(
															true
														);
													}
												}}
												variant="outline"
												size="sm"
												disabled={
													shouldDisableButtons() &&
													clickedButtonType !==
														"auth-confirm"
												}
												className={getButtonClassName(
													"flex items-center gap-2 text-green-500 hover:text-green-400 bg-green-950/60 hover:bg-green-950/70 border border-green-800/50 hover:border-green-800/70",
													"auth-confirm"
												)}
											>
												<Check className="w-4 h-4" />
												Yes, Authenticated
											</Button>
											<Button
												onClick={() => {
													if (shouldDisableButtons())
														return;

													setShowAuthConfirmation(
														false
													);
													setHideAuthButton(false);
													// Reset button states when canceling
													setClickedButtonType(null);
													setIsButtonPending(false);
												}}
												variant="outline"
												size="sm"
												disabled={
													shouldDisableButtons() &&
													clickedButtonType !==
														"auth-cancel"
												}
												className={getButtonClassName(
													"text-gray-400 hover:text-gray-300 bg-gray-950/60 hover:bg-gray-950/70 border border-gray-800/50 hover:border-gray-800/70",
													"auth-cancel"
												)}
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
					<div className="relative Z-0 flex-shrink-0 ml-0.5 mr-4 pt-1">
						<div className="size-3 rounded-full border-2 border-gray-700 bg-gray-500"></div>
					</div>
					<div className="flex-1 min-w-0 p-4 border border-border/50 rounded-lg">
						<div className="text-sm mb-1 flex items-center gap-2">
							<span className="italic text-gray-400">
								Your answer
								{message.toolName &&
									` for ${
										message.toolName
											.charAt(0)
											.toUpperCase() +
										message.toolName.slice(1)
									} Agent`}
							</span>
						</div>
						{isMarkdownContent(message.content) ? (
							<div className="w-fit px-5 py-2 rounded-lg border border-border bg-sidebar/20 text-foreground text-sm leading-relaxed">
								<MDXRenderer content={message.content} />
							</div>
						) : (
							convertUrlsToLinks(message.content)
						)}
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
							{/* <Check className="size-2 text-white" /> */}
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
					<div className="relative Z-0 flex-shrink-0 ml-0.5 mr-4 pt-1">
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
						{message.prompt && (
							<div className="mb-3 py-6">
								<div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
									<MessageSquare className="w-3 h-3" />
									<span>Prompt</span>
								</div>
								<div className="text-sm text-gray-300 italic">
									{convertUrlsToLinks(message.prompt)}
								</div>
							</div>
						)}
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

						{/* Show refresh UI when polling has stopped for more than 1 minute */}
						{shouldShowRefreshUI() && (
							<div className="mt-4 p-3 border border-yellow-500/30 rounded-lg bg-yellow-950/20">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-yellow-400">
										<AlertCircle className="w-4 h-4" />
										<span className="text-sm font-medium">
											Checking for updates...
										</span>
									</div>
									<Button
										onClick={() => {
											if (onRefreshPolling) {
												onRefreshPolling();
											}
										}}
										variant="outline"
										size="sm"
										className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 bg-yellow-950/60 hover:bg-yellow-950/70 border border-yellow-800/50 hover:border-yellow-800/70"
									>
										<RefreshCw className="w-4 h-4" />
										Refresh
									</Button>
								</div>
								<p className="text-xs text-yellow-300/70 mt-2">
									Click refresh to check for the latest updates.
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="relative mb-0">
			{!isLast &&
				message.content !== "Workflow executed successfully" && (
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
				<div className="relative Z-0 flex-shrink-0 ml-0.5 mr-4 pt-1">
					{message.content === "Workflow executed successfully" ? (
						<div className="size-3 rounded-full border-2 border-green-600 bg-green-500 flex items-center justify-center"></div>
					) : (
						<div className="size-3 rounded-full border-2 border-gray-700 bg-gray-500"></div>
					)}
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
					{message.prompt && (
						<div className="mb-3 py-6">
							<div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
								<MessageSquare className="w-3 h-3" />
								<span>Prompt</span>
							</div>
							<div className="text-sm text-gray-300 italic">
								{convertUrlsToLinks(message.prompt)}
							</div>
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
					{message.imageData && message.isImage && (
						<div className="mt-3">
							<Image
								src={base64ToDataUrl(
									message.imageData,
									message.contentType || "image/jpeg"
								)}
								alt="Generated image"
								width={400}
								height={400}
								className="rounded-lg border border-border/50"
							/>
							<Button
								onClick={() => {
									const link = document.createElement("a");
									link.href = base64ToDataUrl(
										message.imageData!,
										message.contentType || "image/jpeg"
									);
									link.download =
										"generated_image." +
										(message.contentType?.split("/")[1] ||
											"jpg");
									link.click();
								}}
								variant="outline"
								size="sm"
								className="mt-2 text-xs"
							>
								<DownloadIcon className="w-3 h-3 mr-1" />
								Download Image
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
