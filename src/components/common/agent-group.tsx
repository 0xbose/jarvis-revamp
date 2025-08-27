"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, MessageSquare, History } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { FeedbackThread } from "./feedback-thread";
import type { SubnetGroup as SubnetGroupType } from "@/hooks/use-message-grouping";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMessageGrouping } from "@/hooks/use-message-grouping";

interface AgentGroupProps {
  group: SubnetGroupType;
  isLast?: boolean;
  currentWorkflowData?: any;
  onNotificationYes?: (notification: any) => Promise<void>;
  onNotificationNo?: (notification: any) => Promise<void>;
  onFeedbackProceed?: (question: string, answer: string) => Promise<void>;
  onFeedbackSubmit?: (question: string, answer: string, feedback: string) => Promise<void>;
  workflowStatus?: string;
  pollingStoppedAt?: Date | null;
  onRefreshPolling?: () => void;
  selectedAgent?: any;
}

export function AgentGroup({
  group,
  isLast = false,
  currentWorkflowData,
  onNotificationYes,
  onNotificationNo,
  onFeedbackProceed,
  onFeedbackSubmit,
  workflowStatus,
  pollingStoppedAt,
  onRefreshPolling,
  selectedAgent,
}: AgentGroupProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const { getSubnetTitle } = useMessageGrouping();

  const title = getSubnetTitle(group, currentWorkflowData, selectedAgent);
  const hasFeedbackHistory = group.feedbackThreads.length > 0;
  
  // Parse title to separate main title from status message
  const parseTitleAndStatus = (fullTitle: string) => {
    const parts = fullTitle.split(' • ');
    if (parts.length === 2) {
      return { mainTitle: parts[0], statusMessage: parts[1] };
    }
    // Handle case where there's no separator (when status is empty)
    const agentMatch = fullTitle.match(/^(.+ agent)\s*(.*)$/);
    if (agentMatch) {
      return { mainTitle: agentMatch[1], statusMessage: agentMatch[2].trim() };
    }
    return { mainTitle: fullTitle, statusMessage: '' };
  };
  
  const { mainTitle, statusMessage } = parseTitleAndStatus(title);
  
  // Get prompt for this subnet from currentWorkflowData
  const getSubnetPrompt = () => {
    if (!currentWorkflowData?.subnets) return null;
    const subnet = currentWorkflowData.subnets[group.subnetIndex];
    return subnet?.prompt && subnet.prompt.trim() !== "" ? subnet.prompt : null;
  };
  
  const subnetPrompt = getSubnetPrompt();

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
          // Extract feedback index from sourceId to match the correct feedback item
          const feedbackMatch = message.sourceId.match(/feedback_question_(\d+)/);
          const feedbackIndex = feedbackMatch ? parseInt(feedbackMatch[1]) : null;
          
          if (feedbackIndex !== null && subnet.feedbackHistory) {
            // Sort feedback history the same way as in use-subnet-cache.ts (oldest first)
            const sortedFeedbackHistory = [...subnet.feedbackHistory].sort((a, b) => {
              const timeA = new Date(a.created_at).getTime();
              const timeB = new Date(b.created_at).getTime();
              return timeA - timeB; // oldest first for proper chronological flow
            });
            
            if (sortedFeedbackHistory[feedbackIndex]) {
              const feedbackItem = sortedFeedbackHistory[feedbackIndex];
              // Check if this specific feedback item has a user answer
              const hasAnswer = feedbackItem.user_answer && feedbackItem.user_answer.trim() !== "";
              if (hasAnswer) {
                return false; // Don't show feedback buttons if already answered
              }
            }
          }
        }
      }
    }

    // Check if waiting for response (same logic as chat-messages-grouped.tsx)
    const currentSubnetStatus =
      message.subnetIndex !== undefined
        ? currentWorkflowData?.subnets?.[message.subnetIndex]?.status
        : null;

    const isWaitingForResponse =
      message.subnetStatus === "awaiting_response" ||
      currentSubnetStatus === "awaiting_response" ||
      currentWorkflowData?.workflowStatus === "awaiting_response" ||
      workflowStatus === "awaiting_response";

    console.log(`🔍 shouldShowFeedbackButtons debug for recent question:`, {
      messageType: message.type,
      questionType: message.questionData?.type,
      questionText: message.questionData?.text?.slice(0, 50),
      sourceId: message.sourceId,
      subnetIndex: message.subnetIndex,
      feedbackIndex: message.feedbackIndex,
      isWorkflowComplete,
      currentSubnetStatus,
      workflowStatus: workflowStatus,
      currentWorkflowStatus: currentWorkflowData?.workflowStatus,
      isWaitingForResponse,
      finalResult: isWaitingForResponse
    });

    return isWaitingForResponse;
  };
  
  // Logic for Recent Data:
  // - Find the thread that has isRecent flag (contains new polled data)
  // - If no recent thread, show the latest thread (last in array) in Recent Data
  // - All other threads go to history
  const recentThread = group.feedbackThreads.find(thread => thread.isRecent) || 
                      (group.feedbackThreads.length > 0 ? group.feedbackThreads[group.feedbackThreads.length - 1] : null);
  const historyThreads = group.feedbackThreads.filter(thread => thread !== recentThread);
  const shouldShowHistory = historyThreads.length > 0;
  
  // Also include mainMessages in recent data if they exist
  const hasRecentData = recentThread || group.mainMessages.length > 0;

  console.log(`🔍 Recent thread debug:`, {
    totalThreads: group.feedbackThreads.length,
    recentThreadExists: !!recentThread,
    recentThreadHasQuestion: !!recentThread?.question,
    recentThreadQuestionText: recentThread?.question?.content?.slice(0, 50),
    recentThreadQuestionSourceId: recentThread?.question?.sourceId,
    recentThreadIsRecent: recentThread?.isRecent,
    hasRecentData,
    shouldShowHistory,
    allThreads: group.feedbackThreads.map(t => ({
      feedbackIndex: t.feedbackIndex,
      hasQuestion: !!t.question,
      questionText: t.question?.content?.slice(0, 30),
      isRecent: t.isRecent
    }))
  });

  // Removed auto-open behavior - collapsible stays closed until manually clicked
  // useEffect(() => {
  //   const hasRecentFeedback = group.feedbackThreads.some(thread => thread.isRecent);
  //   if (hasRecentFeedback) {
  //     setIsHistoryOpen(true);
  //   }
  // }, [group.feedbackThreads]);

  return (
    <div className="space-y-4">
      <div className={`border rounded-lg transition-all duration-300 overflow-hidden ${
        group.isRecent 
          ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm' 
          : 'border-border bg-card'
      }`}>
        
        {shouldShowHistory ? (
          <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-start justify-between p-4 hover:bg-card/80 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 mt-1">
                    {isHistoryOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform duration-200" />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-base font-semibold text-foreground capitalize flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      <span>{mainTitle}</span>
                      {statusMessage && (
                        <span className="text-sm font-normal italic text-muted-foreground transform -rotate-1">
                          • {statusMessage}
                        </span>
                      )}
                      {historyThreads.some(thread => thread.isRecent) && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse">
                          New Data
                        </span>
                      )}
                    </div>
                    {subnetPrompt && (
                      <div className="pr-16 mr-4">
                        <div className="text-sm text-muted-foreground mt-1 italic overflow-hidden" style={{
                          display: isHistoryOpen ? 'block' : '-webkit-box',
                          WebkitLineClamp: isHistoryOpen ? 'unset' : 3,
                          WebkitBoxOrient: isHistoryOpen ? 'unset' : 'vertical',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word'
                        }}>
                          {subnetPrompt}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <History className="w-4 h-4" />
                    <span className="text-sm font-medium">History</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded-full min-w-[20px] text-center">
                      {historyThreads.length}
                    </span>
                  </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="border-t border-border bg-muted/10">
              <div className="p-4 space-y-1">
                {historyThreads.map((thread, index) => (
                  <div key={thread.threadKey} className="border border-border/30 rounded-lg bg-background/50 hover:bg-background/70 transition-colors">
                    <FeedbackThread
                      thread={thread}
                      isLast={index === historyThreads.length - 1}
                      currentWorkflowData={currentWorkflowData}
                      onNotificationYes={onNotificationYes}
                      onNotificationNo={onNotificationNo}
                      onFeedbackProceed={onFeedbackProceed}
                      onFeedbackSubmit={onFeedbackSubmit}
                      workflowStatus={workflowStatus}
                      pollingStoppedAt={pollingStoppedAt}
                      onRefreshPolling={onRefreshPolling}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="flex items-start justify-between p-4">
            <div className="flex items-start gap-3">
              <div className="text-left">
                <div className="text-base font-semibold text-foreground capitalize flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <span>{mainTitle}</span>
                  {statusMessage && (
                    <span className="text-sm font-normal italic text-muted-foreground transform -rotate-1">
                      • {statusMessage}
                    </span>
                  )}
                  {/* {group.isRecent && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse">
                      New Data
                    </span>
                  )} */}
                </div>
                {subnetPrompt && (
                  <div className="pr-16 mr-4">
                    <div className="text-sm text-muted-foreground mt-2 italic overflow-hidden" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word'
                    }}>
                      {subnetPrompt}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <History className="w-4 h-4" />
              <span className="text-sm font-medium">History</span>
            </div>
          </div>
        )}
      </div>

      {hasRecentData && (
        <div className="space-y-3">
          {/* Show the most recent feedback thread (0th index) in Recent Data */}
          {recentThread && (
            <div className="border border-primary/10 rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-0">
                {/* Response/Data Message */}
                {recentThread.response && (
                  <ChatMessage
                    message={recentThread.response}
                    isLast={!recentThread.question && !recentThread.answer}
                    onNotificationYes={onNotificationYes}
                    onNotificationNo={onNotificationNo}
                    onFeedbackProceed={onFeedbackProceed}
                    onFeedbackSubmit={onFeedbackSubmit}
                    showFeedbackButtons={false}
                    workflowStatus={workflowStatus}
                    pollingStoppedAt={pollingStoppedAt}
                    onRefreshPolling={onRefreshPolling}
                  />
                )}

                {/* Question Message */}
                {recentThread.question && (
                  <>
                    {console.log(`🔍 Rendering recent question ChatMessage:`, {
                      questionText: recentThread.question.content?.slice(0, 50),
                      sourceId: recentThread.question.sourceId,
                      showFeedbackButtons: shouldShowFeedbackButtons(recentThread.question),
                      questionType: recentThread.question.questionData?.type,
                      messageType: recentThread.question.type
                    })}
                    <ChatMessage
                      message={recentThread.question}
                      isLast={!recentThread.answer}
                      onNotificationYes={onNotificationYes}
                      onNotificationNo={onNotificationNo}
                      onFeedbackProceed={onFeedbackProceed}
                      onFeedbackSubmit={onFeedbackSubmit}
                      showFeedbackButtons={shouldShowFeedbackButtons(recentThread.question)}
                      workflowStatus={workflowStatus}
                      pollingStoppedAt={pollingStoppedAt}
                      onRefreshPolling={onRefreshPolling}
                    />
                  </>
                )}

                {/* Answer Message */}
                {recentThread.answer && (
                  <>
                   
                    <ChatMessage
                      message={recentThread.answer}
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
            </div>
          )}

          {/* Also show any mainMessages if they exist */}
          {group.mainMessages.map((message, index) => (
            <div key={message.id} className="border border-border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow">
              <ChatMessage
                message={message}
                isLast={index === group.mainMessages.length - 1 && !recentThread}
                onNotificationYes={onNotificationYes}
                onNotificationNo={onNotificationNo}
                onFeedbackProceed={onFeedbackProceed}
                onFeedbackSubmit={onFeedbackSubmit}
                showFeedbackButtons={true}
                workflowStatus={workflowStatus}
                pollingStoppedAt={pollingStoppedAt}
                onRefreshPolling={onRefreshPolling}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
