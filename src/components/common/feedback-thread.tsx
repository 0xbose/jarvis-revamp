"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, MessageSquare, FileText, HelpCircle, User, Check } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { FeedbackThread as FeedbackThreadType } from "@/hooks/use-message-grouping";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMessageGrouping } from "@/hooks/use-message-grouping";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


interface FeedbackThreadProps {
  thread: FeedbackThreadType;
  isLast?: boolean;
  currentWorkflowData?: any;

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

  currentWorkflowData,

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
  const hasAnswer = !!thread.answer;

  // Helper function to check if feedback buttons should be shown for a question
  const shouldShowFeedbackButtons = (message: any): boolean => {
    if (message.type !== "question") return false;
    if (message.questionData?.type !== "feedback") return false;

    // Check if workflow is completed
    const isWorkflowComplete =
      currentWorkflowData?.workflowStatus === "completed" ||
      currentWorkflowData?.workflowStatus === "failed" ||
      currentWorkflowData?.workflowStatus === "stopped" ||
      workflowStatus === "completed" ||
      workflowStatus === "failed" ||
      workflowStatus === "stopped";

    if (isWorkflowComplete) return false;

    // Check if there's already an answer in feedback history
    if (message.sourceId?.includes("feedback") && currentWorkflowData?.subnets) {
      const subnetIndex = message.subnetIndex;
      if (subnetIndex !== undefined && currentWorkflowData.subnets[subnetIndex]) {
        const subnet = currentWorkflowData.subnets[subnetIndex];
        if (subnet.feedbackHistory) {
          const hasAnswer = subnet.feedbackHistory.some(
            (feedback: any) =>
              feedback.feedback_question === message.questionData?.text &&
              feedback.user_answer &&
              feedback.user_answer.trim() !== ""
          );
          if (hasAnswer) {
            return false; // Don't show feedback buttons if already answered
          }
        }
      }
    }

    return true;
  };

  // Get a more descriptive title for the feedback thread
  const getThreadTitle = () => {
    if (thread.question?.content) {
      return thread.question.content.length > 50 
        ? `${thread.question.content.slice(0, 50)}...` 
        : thread.question.content;
    }
    if (thread.response?.prompt) {
      return thread.response.prompt.length > 50
        ? `${thread.response.prompt.slice(0, 50)}...`
        : thread.response.prompt;
    }
    return `Feedback Thread ${thread.feedbackIndex + 1}`;
  };

  // Feedback threads remain closed by default

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 border border-primary/10 transition-colors rounded-lg">
          <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              {isOpen ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground transition-transform duration-200" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground transition-transform duration-200" />
              )}
            </div>
            <HelpCircle className="w-4 h-4 flex-shrink-0 text-blue-400" />
            <span className="font-medium truncate text-left">{getThreadTitle()}</span>
            {thread.isRecent && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 animate-pulse flex-shrink-0">
                New
              </span>
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-primary/10 rounded-lg">
       
            <div className="space-y-0">
              {/* Response/Data section */}
              {thread.response && (
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
              )}

              {/* Question section */}
              {thread.question && (
                <>
                  
                  <ChatMessage
                    key={thread.question.id}
                    message={thread.question}
                    isLast={!thread.answer}
                    onNotificationYes={onNotificationYes}
                    onNotificationNo={onNotificationNo}
                    onFeedbackProceed={onFeedbackProceed}
                    onFeedbackSubmit={onFeedbackSubmit}
                    showFeedbackButtons={shouldShowFeedbackButtons(thread.question)}
                    workflowStatus={workflowStatus}
                    pollingStoppedAt={pollingStoppedAt}
                    onRefreshPolling={onRefreshPolling}
                  />
                </>
              )}

              {/* Answer section */}
              {thread.answer && (
                <>
                  
                  <ChatMessage
                    key={thread.answer.id}
                    message={thread.answer}
                    isLast={true}
                    onNotificationYes={onNotificationYes}
                    onNotificationNo={onNotificationNo}
                    onFeedbackProceed={onFeedbackProceed}
                    onFeedbackSubmit={onFeedbackSubmit}
                    showFeedbackButtons={false}
                    workflowStatus={workflowStatus}
                    pollingStoppedAt={pollingStoppedAt}
                    onRefreshPolling={onRefreshPolling}
                  />
                </>
              )}
            </div>
          
      </CollapsibleContent>
    </Collapsible>
  );
}
