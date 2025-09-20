"use client";

import Image from "next/image";
import { User, DownloadIcon } from "lucide-react";
import { Button } from "../ui/button";
import { ChatMsg } from "@/types/chat";

interface ChatUserProps {
	message: ChatMsg;
}

export function ChatUser({ message }: ChatUserProps) {
	return (
		<div className="relative mb-6">
			<div className="flex justify-end">
				<div className="flex items-start gap-3 max-w-[80%] flex-row-reverse">
					{/* User Avatar - moved to left side */}
					<div className="hidden md:flex-shrink-0 size-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
						<User className="size-4 text-primary" />
					</div>
					<div className="flex-1 min-w-0">
						<div className="bg-primary/10 rounded-2xl rounded-tl-md px-4 py-3 border border-primary/20">
							<p className="text-foreground text-sm leading-relaxed break-words">
								{message.content}
							</p>

							{/* Image attachment if present */}
							{message.imageData && (
								<div className="mt-3">
									{message.isImage ? (
										<div className="relative w-fit">
											<Image
												src={message.imageData}
												alt="User uploaded image"
												width={300}
												height={300}
												className="rounded-lg border border-border max-w-full h-auto"
												onError={(e) => {
													console.error(
														"Failed to load user image:",
														e
													);
												}}
											/>
											<div className="absolute top-2 right-2">
												<Button
													size="icon"
													className="p-1 bg-background/80"
													onClick={() => {
														const link =
															document.createElement(
																"a"
															);
														link.href =
															message.imageData!;
														link.download =
															"user_image." +
															((message.contentType &&
																message.contentType.split(
																	"/"
																)[1]) ||
																"jpg");
														link.click();
													}}
												>
													<DownloadIcon className="w-3 h-3 text-foreground" />
												</Button>
											</div>
										</div>
									) : (
										<div className="p-3 border border-border rounded-lg bg-muted/20">
											<div className="flex items-center gap-3">
												<div className="p-2 bg-primary/10 rounded-lg">
													<svg
														className="w-5 h-5 text-primary"
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
																	.split(
																		"/"
																	)[1]
																	.toUpperCase()
															: "File"}{" "}
														attachment
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
														link.href =
															message.imageData!;
														link.download = `user_file.${
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
				</div>
			</div>
		</div>
	);
}
