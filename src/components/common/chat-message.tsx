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
	User,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { MDXRenderer, isMarkdownContent } from "./mdx-renderer";
import { ChatMsg } from "@/types/chat";
import Link from "next/link";
import { LoadingDots } from "../ui/loading-dots";

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

	// Test state for simulating timeout scenarios
	const [showTestTimeout, setShowTestTimeout] = useState(false);

	// New state for button interaction tracking during workflow execution
	const [clickedButtonType, setClickedButtonType] = useState<string | null>(
		null
	);
	const [isButtonPending, setIsButtonPending] = useState(false);

	// Helper function to check if refresh UI should be shown
	const shouldShowRefreshUI = () => {
		// Case 1: Show refresh UI for timeout messages
		if (message.isTimeoutMessage && message.showRefreshButton) {
			console.log(
				"🔍 Debug: Should show refresh UI - Case 1: timeout message with showRefreshButton",
				{
					messageId: message.id,
					isTimeoutMessage: message.isTimeoutMessage,
					showRefreshButton: message.showRefreshButton,
				}
			);
			return true;
		}

		// Case 2: Show refresh UI when polling has stopped for more than 5 minutes
		if (!pollingStoppedAt || !onRefreshPolling) {
			console.log(
				"🔍 Debug: Should show refresh UI - Case 2: missing requirements",
				{
					pollingStoppedAt: !!pollingStoppedAt,
					onRefreshPolling: !!onRefreshPolling,
				}
			);
			return false;
		}

		const timeSinceStoppedMs = Date.now() - pollingStoppedAt.getTime();
		const fiveMinutesMs = 5 * 60 * 1000; // Updated to 5 minutes

		const shouldShow =
			workflowStatus === "awaiting_response" &&
			timeSinceStoppedMs > fiveMinutesMs &&
			message.subnetStatus === "awaiting_response" &&
			isLast;

		console.log(
			"🔍 Debug: Should show refresh UI - Case 2: calculated result",
			{
				workflowStatus,
				timeSinceStoppedMs,
				fiveMinutesMs,
				messageSubnetStatus: message.subnetStatus,
				isLast,
				shouldShow,
			}
		);

		return shouldShow;
	};

	// Debug logging for timeout messages
	if (message.isTimeoutMessage) {
		console.log("🔍 Debug: Processing timeout message", {
			messageId: message.id,
			isTimeoutMessage: message.isTimeoutMessage,
			showRefreshButton: message.showRefreshButton,
			messageType: message.type,
			shouldShowRefreshUI: shouldShowRefreshUI(),
		});
	}

	const isWorkflowActivelyExecuting = () => {
		return (
			workflowStatus === "running" ||
			workflowStatus === "in_progress" ||
			workflowStatus === "waiting" ||
			workflowStatus === "awaiting_response" ||
			workflowStatus === "pending"
		);
	};

	const shouldDisableButtons = () => {
		// Only disable buttons if workflow is actively executing AND button is pending
		// But allow authentication confirmation buttons to work even when other buttons are pending
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
			message.subnetStatus !== "awaiting_response" &&
			workflowStatus !== "awaiting_response";

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
				message.subnetStatus !== "awaiting_response";

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
				<div className="flex-1 min-w-0 pb-4 overflow-hidden">
					<h2 className="text-2xl font-bold text-white leading-tight mb-2 capitalize break-words">
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
				<div className="flex-1 min-w-0 p-4">
					<div className="text-sm font-medium mb-2 flex items-center gap-2 text-gray-400">
						<Bell className="w-4 h-4" />
						<span>Notification</span>
					</div>
					<div className="overflow-hidden">
						<div className="text-foreground text-sm leading-relaxed break-words">
							{isMarkdownContent(message.content) ? (
								<MDXRenderer content={message.content} />
							) : (
								convertUrlsToLinks(message.content)
							)}

						</div>
						
						{/* Interactive Elements Section - Moved to Bottom */}
						{isPendingNotification &&
							onNotificationYes &&
							onNotificationNo &&
							!shouldHideNotificationButtons() && (
								<div className="flex gap-3 mt-4">
									<Button
										onClick={() => {
											if (shouldDisableButtons()) return;

											if (isWorkflowActivelyExecuting()) {
												setClickedButtonType("notification-yes");
												setIsButtonPending(true);
											} else {
												setHideNotificationButtons(true);
											}

											onNotificationYes(message);
										}}
										variant="outline"
										size="sm"
										disabled={shouldDisableButtons() && clickedButtonType !== "notification-yes"}
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
											if (shouldDisableButtons()) return;


											if (isWorkflowActivelyExecuting()) {
												setClickedButtonType("notification-no");
												setIsButtonPending(true);
											} else {
												setHideNotificationButtons(true);
											}

											onNotificationNo(message);
										}}
										variant="outline"
										size="sm"
										disabled={shouldDisableButtons() && clickedButtonType !== "notification-no"}
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
			</div>
			</div>
		);
	}

	if (message.type === "question") {
		const isAuthentication =
			message.questionData?.type === "authentication";
		return (
			<div className="relative mb-0 w-full flex justify-end">
				<div className="flex-1 min-w-0 p-4 w-fit flex justify-start">
					<div className="flex justify-center items-start gap-3 flex-row w-fit">
						<div className="flex-shrink-0 size-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">

							{isAuthentication ? (
								<LucideCircleQuestionMark className="size-5 text-primary" />
							) : (
								<AlertCircle className="size-5 text-primary" />
							)}
						</div>
						<div className="flex-1 min-w-0 bg-primary/5 rounded-lg p-3 border border-primary/10 w-fit">
							<div className="text-foreground text-sm leading-relaxed">
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

							{/* Interactive Elements Section - Moved to Bottom */}
							<div className="mt-4 space-y-3">
								{/* Feedback buttons */}
								{showFeedbackButtons && !shouldHideFeedbackButtons() && (
									<div className="p-3 border border-border bg-background/15 rounded-lg">
										{!showFeedbackInput ? (
											<div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
												<Button
													onClick={async () => {
														if (shouldDisableButtons()) return;

														if (isWorkflowActivelyExecuting()) {
															setClickedButtonType("feedback-proceed");
															setIsButtonPending(true);
														}

														setFeedbackProcessed(true);

														try {
															if (onFeedbackProceed && message.questionData?.text) {
																await onFeedbackProceed(
																	message.questionData.text,
																	"Yes, proceed"
																);
															}
														} catch (error) {
															console.error("Error proceeding with feedback:", error);
															setFeedbackProcessed(false);
															setClickedButtonType(null);
															setIsButtonPending(false);
														}
													}}
													variant="outline"
													size="sm"
													disabled={shouldDisableButtons() && clickedButtonType !== "feedback-proceed"}
													className={getButtonClassName(
														"flex-1 sm:flex-initial flex items-center justify-center gap-2 h-9 px-4 text-green-400 hover:text-green-300 bg-green-950/40 hover:bg-green-950/60 border-green-800/40 hover:border-green-700/60 transition-all duration-200",
														"feedback-proceed"
													)}
												>
													<Check className="w-4 h-4" />
													Yes, proceed
												</Button>
												<Button
													onClick={() => {
														if (shouldDisableButtons()) return;
														setShowFeedbackInput(true);
													}}
													variant="outline"
													size="sm"
													disabled={shouldDisableButtons() && clickedButtonType !== "feedback-input"}
													className={getButtonClassName(
														"flex-1 sm:flex-initial flex items-center justify-center gap-2 h-9 px-4 text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-950/60 border-blue-800/40 hover:border-blue-700/60 transition-all duration-200",
														"feedback-input"
													)}
												>
													<MessageSquare className="w-4 h-4" />
													Provide feedback
												</Button>
											</div>
										) : (
											<div className="space-y-3">
												<div>
													<Input
														value={feedbackText}
														onChange={(e) => setFeedbackText(e.target.value)}
														placeholder="Type your feedback here..."
														className="w-full h-10 border border-border placeholder:text-muted-foreground text-muted-foreground"
														onKeyDown={(e) => {
															if (e.key === 'Enter' && !e.shiftKey && feedbackText.trim()) {
																e.preventDefault();
																const submitButton = e.currentTarget.parentElement?.nextElementSibling?.querySelector('button:last-child') as HTMLButtonElement;
																submitButton?.click();
															}
														}}
													/>
												</div>
												<div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
													<Button
														onClick={() => {
															setShowFeedbackInput(false);
															setFeedbackText("");
															setClickedButtonType(null);
															setIsButtonPending(false);
														}}
														variant="outline"
														size="sm"
														disabled={shouldDisableButtons() && clickedButtonType !== "feedback-cancel"}
														className={getButtonClassName(
															"flex-1 sm:flex-initial h-9 px-4 text-muted-foreground hover:text-muted-foreground/80 bg-background/10 hover:bg-background/20 border border-border hover:border-border/70 transition-all duration-200",
															"feedback-cancel"
														)}
													>
														Cancel
													</Button>
													<Button
														onClick={async () => {
															if (!feedbackText.trim()) return;
															if (isButtonPending && clickedButtonType !== "feedback-submit") return;

															try {
																if (isWorkflowActivelyExecuting()) {
																	setClickedButtonType("feedback-submit");
																	setIsButtonPending(true);
																}

																setFeedbackProcessed(true);

																if (onFeedbackSubmit && message.questionData?.text) {
																	await onFeedbackSubmit(
																		message.questionData.text,
																		"User feedback",
																		feedbackText.trim()
																	);

																	setFeedbackText("");
																	setShowFeedbackInput(false);
																}
															} catch (error) {
																console.error("Error submitting feedback:", error);
																setFeedbackProcessed(false);
															} finally {
																setClickedButtonType(null);
																setIsButtonPending(false);
															}
														}}
														variant="outline"
														size="sm"
														disabled={!feedbackText.trim() || (isButtonPending && clickedButtonType !== "feedback-submit")}
														className={getButtonClassName(
															"flex-1 sm:flex-initial flex items-center justify-center gap-2 h-9 px-4 text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-950/60 border-blue-800/40 hover:border-blue-700/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200",
															"feedback-submit"
														)}
													>
														<MessageSquare className="w-4 h-4" />
														Submit
													</Button>
												</div>
											</div>
										)}
									</div>
								)}

								{/* Authentication button */}
								{isAuthentication && !shouldHideAuthButton() && (
									<div className="space-y-2">
										<Button
											onClick={() => {
												if (shouldDisableButtons()) return;

												if (isWorkflowActivelyExecuting()) {
													setClickedButtonType("authenticate");
													setIsButtonPending(true);
												}

												const authUrl = message.questionData?.authUrl;
												
												if (authUrl) {
													console.log("Opening auth URL from questionData:", authUrl);
													window.open(authUrl, "_blank", "noopener,noreferrer");
												} else {
													console.log("No authUrl in questionData, falling back to text parsing");
													
													const questionText = message.questionData?.text || message.content;
													const urlMatch = questionText.match(/https?:\/\/[^\s]+/);
													if (urlMatch) {
														console.log("Found URL in text:", urlMatch[0]);
														window.open(urlMatch[0], "_blank", "noopener,noreferrer");
													} else {
														console.log("No URL found in text content");
													}
												}

												console.log("🔐 Setting showAuthConfirmation to true");
												setShowAuthConfirmation(true);
												if (!isWorkflowActivelyExecuting()) {
													setHideAuthButton(true);
												}
											}}
											variant="outline"
											size="sm"
											disabled={shouldDisableButtons() && clickedButtonType !== "authenticate"}
											className={getButtonClassName(
												"flex items-center gap-2 text-foreground hover:text-foreground/80 bg-background/10 hover:bg-background/20 border border-border hover:border-border/70",
												"authenticate"
											)}
										>
											<ExternalLinkIcon className="w-4 h-4" />
											Authenticate
										</Button>
									</div>
								)}

								{/* Authentication Confirmation UI */}
								{showAuthConfirmation && message.questionData?.type === "authentication" && (
									<div className="space-y-3 p-3 border border-border/50 rounded-lg bg-background/30">
										<div className="flex items-center gap-2 text-foreground mb-2">
											<AlertCircle className="w-4 h-4" />
											<span className="text-sm font-medium">
												Authentication Required
											</span>
										</div>
										<p className="text-gray-300 text-sm mb-3">
											Have you completed the authentication process in the new tab?
										</p>
										<div className="flex gap-3">
											<Button
												onClick={async () => {
													console.log("🔐 Yes, Authenticated button clicked!");
													
													if (isWorkflowActivelyExecuting()) {
														console.log("🔐 Setting auth-confirm button state");
														setClickedButtonType("auth-confirm");
														setIsButtonPending(true);
													}

													setShowAuthConfirmation(false);

													if (onFeedbackProceed && message.questionData?.text) {
														console.log("🔐 Calling onFeedbackProceed with:", {
															question: message.questionData.text,
															answer: "Yes, I have authenticated successfully"
														});
														
														await onFeedbackProceed(
															message.questionData.text,
															"Yes, I have authenticated successfully"
														);

														setFeedbackProcessed(true);
													} else {
														console.log("🔐 onFeedbackProceed or questionData.text not available:", {
															onFeedbackProceed: !!onFeedbackProceed,
															questionData: message.questionData,
															questionText: message.questionData?.text
														});
													}
												}}
												variant="outline"
												size="sm"
												disabled={false}
												className="flex items-center gap-2 text-green-500 hover:text-green-400 bg-green-950/60 hover:bg-green-950/70 border border-green-800/50 hover:border-green-800/70"
											>
												<Check className="w-4 h-4" />
												Yes, Authenticated
											</Button>
											<Button
												onClick={() => {
													console.log("🔐 Cancel button clicked!");
													
													setShowAuthConfirmation(false);
													setHideAuthButton(false);
													setClickedButtonType(null);
													setIsButtonPending(false);
												}}
												variant="outline"
												size="sm"
												disabled={false}
												className="text-gray-400 hover:text-gray-300 bg-gray-950/60 hover:bg-gray-950/70 border border-gray-800/50 hover:border-gray-800/70"
											>
												<X className="w-4 h-4" />
												Cancel
											</Button>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (message.type === "answer") {
		return (
			<div className="relative mb-0 w-full flex justify-end">
				<div className="flex-1 min-w-0 p-4 w-fit flex justify-end">
					<div className="flex justify-center items-start gap-3 flex-row-reverse w-fit">
						<div className="flex-shrink-0 size-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
							<User className="size-5 text-primary" />
						</div>
						<div className="flex-1 min-w-0 bg-primary/5 rounded-lg p-3 border border-primary/10 w-fit">
							{isMarkdownContent(message.content) ? (
								<div className="text-foreground text-sm leading-relaxed overflow-hidden">
									<MDXRenderer content={message.content} />
								</div>
							) : (
								<div className="text-foreground text-sm leading-relaxed break-words overflow-hidden">
									{convertUrlsToLinks(message.content)}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Workflow subnet message - shows status of individual workflow steps
	if (message.type === "workflow_subnet") {

		const getStatusText = () => {
			switch (message.subnetStatus) {
				case "pending":
					return "Queued";
				case "in_progress":
					return "Processing";
				case "awaiting_response":
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
				<div className="relative flex items-start">
					<div className="flex-1 min-w-0 p-4">
						{/* {message.toolName && (

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
						)} */}


						{message.content && (
							<div
								className={`text-sm leading-relaxed ${
									message.subnetStatus === "failed"
										? "text-red-200"
										: "text-gray-200"
								}`}
							>
								<div className="flex items-center gap-2">
									{isMarkdownContent(message.content) ? (
										<MDXRenderer content={message.content} />
									) : (
										<div className="whitespace-pre-wrap break-words overflow-hidden">
											{convertUrlsToLinks(message.content)}
										</div>
									)}
									{message.showLoadingDots && (
										<LoadingDots className="ml-2" />
									)}
								</div>
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

						{/* Interactive Elements Section - Moved to Bottom */}
						<div className="mt-4 space-y-3">
							{/* Show refresh UI when polling has stopped for more than 5 minutes */}
							{shouldShowRefreshUI() && (
								<div className="p-3 border border-yellow-500/30 rounded-lg bg-yellow-950/20">
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

							{/* Show timeout message with refresh button */}
							{message.isTimeoutMessage && message.showRefreshButton && (
								<div className="p-3 border border-border rounded-lg bg-muted/20">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2 text-yellow-400">
											<AlertTriangleIcon className="w-4 h-4 text-yellow-400" />
											<span className="text-sm font-medium">
												Polling Timeout
											</span>
										</div>
									</div>
									<p className="text-xs text-orange-300/70 mt-2">
										Polling has been running for more than 5 minutes. Click refresh to continue monitoring the workflow.
									</p>
									<div className="mt-3 flex justify-end">
										<Button
											onClick={() => {
												console.log("🔍 Debug: Refresh button clicked");
												if (onRefreshPolling) {
													onRefreshPolling();
												}
											}}
											variant="outline"
											size="sm"
											className="flex items-center gap-2 text-gray-400 hover:text-gray-300 bg-muted/20 hover:bg-muted/30 border border-border/50 hover:border-border/70"
										>
											<RefreshCw className="w-4 h-4" />
											Refresh
										</Button>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="relative mb-0">
			<div className="relative flex items-start">
				<div className="flex-1 min-w-0 px-4 pb-4 overflow-hidden">
					<div className="text-gray-200 text-sm leading-relaxed overflow-hidden">
						<div className="mb-2">
							<div className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-2">
								<Check className="size-4" />
								<span>Response</span>
							</div>
						</div>
						<div className="flex items-start gap-2">
							<div className="flex-1 min-w-0">
								{isMarkdownContent(message.content) ? (
									<MDXRenderer content={message.content} />
								) : (
									<div className="whitespace-pre-wrap break-words overflow-hidden">
										{convertUrlsToLinks(message.content)}
									</div>
								)}
							</div>
						</div>
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
