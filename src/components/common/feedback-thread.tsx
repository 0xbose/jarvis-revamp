"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, MessageSquare, FileText, HelpCircle, User, Check } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { FeedbackThread as FeedbackThreadType } from "@/hooks/use-message-grouping";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMessageGrouping } from "@/hooks/use-message-grouping";
import { Button } from "@/components/ui/button";

interface FeedbackThreadProps {
  thread: FeedbackThreadType;
  isLast?: boolean;
  onNotificationYes?: (notification: any) => Promise<void>;
  onNotificationNo?: (notification: any) => Promise<void>;
  onFeedbackProceed?: (question: string, answer: string) => Promise<void>;
  onFeedbackSubmit?: (question: string, answer: string, feedback: string) => Promise<void>;
  workflowStatus?: string;
  pollingStoppedAt?: Date | null;
  onRefreshPolling?: () => void;
}

export function FeedbackThread({
  thread,
  isLast = false,
  onNotificationYes,
  onNotificationNo,
  onFeedbackProceed,
  onFeedbackSubmit,
  workflowStatus,
  pollingStoppedAt,
  onRefreshPolling,
}: FeedbackThreadProps) {
  const [isOpen, setIsOpen] = useState(false); // Feedback threads collapsed by default
  const { getFeedbackThreadTitle } = useMessageGrouping();

  const title = getFeedbackThreadTitle(thread);
  const messages = [thread.response, thread.question, thread.answer].filter(Boolean);
  const hasAnswer = !!thread.answer;
  const isCompleted = hasAnswer;

  // Auto-open if this feedback thread contains recent polled data
  useEffect(() => {
    if (thread.isRecent) {
      setIsOpen(true);
    }
  }, [thread.isRecent]);

  return (
    <div className="relative">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="relative flex items-start">
          <div className="flex-1 min-w-0">
            <CollapsibleTrigger className="w-full">
              <div className={`flex items-center justify-between p-3 border rounded-md transition-all duration-300 ${
                thread.isRecent 
                  ? 'border-green-300 bg-green-50/50 dark:bg-green-950/20 shadow-sm' 
                  : 'border-border/50 bg-muted/50 hover:bg-muted/70'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-foreground flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-blue-400" />
                      {title}
                      {thread.isRecent && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 animate-pulse">
                          New
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-2">
              <div className="space-y-3 pl-6 border-l border-border">
                {/* Response/Data first (if exists) */}
                {thread.response && (
                  <div className="border border-border rounded-lg bg-card/50">
                    <div className="p-3 border-b border-border bg-muted/30">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        <span>Response & Data</span>
                      </div>
                    </div>
                    <ChatMessage
                      key={thread.response.id}
                      message={thread.response}
                      isLast={!thread.question && !thread.answer}
                      onNotificationYes={onNotificationYes}
                      onNotificationNo={onNotificationNo}
                      onFeedbackProceed={onFeedbackProceed}
                      onFeedbackSubmit={onFeedbackSubmit}
                      workflowStatus={workflowStatus}
                      pollingStoppedAt={pollingStoppedAt}
                      onRefreshPolling={onRefreshPolling}
                    />
                  </div>
                )}

                        {/* Question second (if exists) */}
                        {thread.question && (
                          <div className="border border-border rounded-lg bg-muted/20">
                            <div className="p-3 border-b border-border bg-muted/30">
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <HelpCircle className="w-4 h-4" />
                                <span>Question</span>
                              </div>
                            </div>
                            <div className="p-3">
                              <div className="text-sm text-foreground mb-3">
                                {thread.question.content}
                              </div>
                              
                              {/* Show feedback buttons if no answer yet */}
                              {!hasAnswer && (
                                <div className="space-y-3">
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={async () => {
                                        if (onFeedbackProceed && thread.question?.content) {
                                          await onFeedbackProceed(
                                            thread.question.content,
                                            "Yes, proceed"
                                          );
                                        }
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="text-green-500 hover:text-green-400 bg-green-950/60 hover:bg-green-950/70 border border-green-800/50 hover:border-green-800/70"
                                    >
                                      <Check className="w-4 h-4" />
                                      Yes, proceed
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        // Handle feedback input
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="text-blue-500 hover:text-blue-400 bg-blue-950/60 hover:bg-blue-950/70 border border-blue-800/50 hover:border-blue-800/70"
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                      Provide feedback
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Show actual user answer from polling below the question */}
                              {thread.answer && (
                                <div className="mt-3 pt-3 border-t border-border">
                                  <div className="text-sm text-muted-foreground mb-2">
                                    User's Response:
                                  </div>
                                  <div className="text-sm text-foreground bg-muted/30 p-2 rounded border">
                                    {thread.answer.content}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Remove the separate "Your Answer" section since we're showing it below the question */}
                        {/* {thread.answer && (
                          <div className="border border-border rounded-lg bg-card/50">
                            <div className="p-3 border-b border-border bg-muted/30">
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <User className="w-4 h-4" />
                                <span>Your Answer</span>
                              </div>
                            </div>
                            <ChatMessage
                              key={thread.answer.id}
                              message={thread.answer}
                              isLast={true}
                              onNotificationYes={onNotificationYes}
                              onNotificationNo={onNotificationNo}
                              onFeedbackProceed={onFeedbackProceed}
                              onFeedbackSubmit={onFeedbackSubmit}
                              workflowStatus={workflowStatus}
                              pollingStoppedAt={pollingStoppedAt}
                              onRefreshPolling={onRefreshPolling}
                            />
                          </div>
                        )} */}
              </div>
            </CollapsibleContent>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
