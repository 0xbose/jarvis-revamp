"use client";

import React, { useEffect, useRef } from "react";
import { ChatMessage } from "./chat-message";
import { SubnetGroup } from "./subnet-group";
import { ChatMsg } from "@/types/chat";
import { useMessageGrouping } from "@/hooks/use-message-grouping";

interface ChatMessagesGroupedProps {
  messages: ChatMsg[];
  urlWorkflowId?: string;
  currentWorkflowData?: any;
  workflowStatus?: string;
  completedFeedback: Set<number>;
  pendingNotifications: ChatMsg[];
  pollingStoppedAt?: Date | null;
  onNotificationYes: (notification: any) => Promise<void>;
  onNotificationNo: (notification: any) => Promise<void>;
  onFeedbackProceed: (question: string, answer: string) => Promise<void>;
  onFeedbackSubmit: (question: string, answer: string, feedback: string) => Promise<void>;
  onRefreshPolling: () => void;
  selectedAgent?: any;
  isReadOnly?: boolean;
  onRetrySubnet?: (subnetIndex: number) => Promise<void>;
  retryingSubnetIndex?: number | null;
}

export function ChatMessagesGrouped({
  messages,
  urlWorkflowId,
  currentWorkflowData,
  workflowStatus,
  completedFeedback,
  pendingNotifications,
  pollingStoppedAt,
  onNotificationYes,
  onNotificationNo,
  onFeedbackProceed,
  onFeedbackSubmit,
  onRefreshPolling,
  selectedAgent,
  isReadOnly = false,
  onRetrySubnet,
  retryingSubnetIndex,
}: ChatMessagesGroupedProps) {
  const { groupMessagesBySubnet } = useMessageGrouping();
  
  // Track previous messages to identify new polled data
  const previousMessagesRef = useRef<ChatMsg[]>([]);
  
  // Filter messages first (same logic as original)
  const filteredMessages = messages.filter((message) => {
    if (
      typeof message.content === "string" &&
      message.content.trim().toLowerCase() === "yes, proceed" &&
      message.type !== "answer"
    ) {
      return false;
    }

    // Filter out unwanted system messages and status messages
    if (message.content === "Workflow executed successfully" ||
        message.content === "awaiting response" ||
        message.content === "completed" ||
        message.content === "in_progress" ||
        message.content === "pending") {
      return false;
    }

    // Filter out feedback processing messages
    if (message.content?.includes("Feedback submitted successfully") ||
        message.content?.includes("Feedback processed successfully") ||
        message.content?.includes("Resuming workflow")) {
      return false;
    }

    // Filter out generic response messages
    if (message.type === "response" && 
        (message.content === "Response" || 
         message.content === "Your answer" ||
         message.content === "Proceeding with current result")) {
      return false;
    }

    // Filter out empty JSON responses
    if (typeof message.content === "string" && 
        message.content.trim() === "{}") {
      return false;
    }

    const isWorkflowCompleted =
      currentWorkflowData?.workflowStatus === "completed" ||
      currentWorkflowData?.workflowStatus === "failed" ||
      currentWorkflowData?.workflowStatus === "stopped" ||
      workflowStatus === "completed" ||
      workflowStatus === "failed" ||
      workflowStatus === "stopped";

    // Don't filter out feedback questions even if workflow is stopped
    if (
      isWorkflowCompleted &&
      message.type === "question" &&
      message.questionData?.type !== "feedback"
    ) {
      return false;
    }

    return true;
  });
  
  // Group messages by subnet and feedback threads, passing previous messages to identify recent data
  const { systemMessages, subnetGroups } = groupMessagesBySubnet(filteredMessages, previousMessagesRef.current);
  

  
  // Update previous messages after grouping (so next render will compare against current state)
  useEffect(() => {
    previousMessagesRef.current = messages;
  }, [messages]);

  // Helper function to determine if feedback buttons should be shown
  const shouldShowFeedbackButtons = (message: ChatMsg): boolean => {
    // Don't show feedback buttons in read-only mode
    if (isReadOnly) return false;
    
    if (message.type !== "question") return false;
    if (message.questionData?.type !== "feedback") return false;

    // Check if already completed
    if (completedFeedback.has(message.questionData.itemID)) return false;

    // Check workflow completion status
    const isWorkflowComplete =
      currentWorkflowData?.workflowStatus === "completed" ||
      currentWorkflowData?.workflowStatus === "failed" ||
      currentWorkflowData?.workflowStatus === "stopped" ||
      workflowStatus === "completed" ||
      workflowStatus === "failed" ||
      workflowStatus === "stopped";

    if (isWorkflowComplete) return false;

    // Check if waiting for response
    const currentSubnetStatus =
      message.subnetIndex !== undefined
        ? currentWorkflowData?.subnets?.[message.subnetIndex]?.status
        : null;

    const isWaitingForResponse =
      message.subnetStatus === "awaiting_response" ||
      currentSubnetStatus === "awaiting_response" ||
      currentWorkflowData?.workflowStatus === "awaiting_response" ||
      workflowStatus === "awaiting_response";

    // For feedback history questions, also check if they're from feedback history
    if (message.sourceId?.includes("feedback")) {
      // If this is a feedback history question, check if it has an answer
      const subnetIndex = message.subnetIndex;
      if (subnetIndex !== undefined && currentWorkflowData?.subnets?.[subnetIndex]) {
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

    return isWaitingForResponse;
  };

  return (
    <>
      {/* System messages (user messages, general responses) */}
      {systemMessages.map((message, index) => (
        <ChatMessage
          key={`${urlWorkflowId}-${message.id}`}
          message={message}
          isLast={false}
          onNotificationYes={onNotificationYes}
          onNotificationNo={onNotificationNo}
          isPendingNotification={pendingNotifications.some((n) => n.id === message.id)}
          onFeedbackProceed={onFeedbackProceed}
          onFeedbackSubmit={onFeedbackSubmit}
          showFeedbackButtons={shouldShowFeedbackButtons(message)}
          workflowStatus={workflowStatus || currentWorkflowData?.workflowStatus}
          pollingStoppedAt={pollingStoppedAt}
          onRefreshPolling={onRefreshPolling}
          onRetrySubnet={onRetrySubnet}
          retryingSubnetIndex={retryingSubnetIndex}
        />
      ))}

      {/* Grouped subnet messages with collapsible functionality */}
      {subnetGroups.map((group, index) => (
        <SubnetGroup
          key={`subnet-${group.subnetIndex}-${urlWorkflowId}`}
          group={group}
          isLast={index === subnetGroups.length - 1}
          currentWorkflowData={currentWorkflowData}

          onNotificationYes={onNotificationYes}
          onNotificationNo={onNotificationNo}
          onFeedbackProceed={onFeedbackProceed}
          onFeedbackSubmit={onFeedbackSubmit}
          workflowStatus={workflowStatus || currentWorkflowData?.workflowStatus}
          pollingStoppedAt={pollingStoppedAt}
          onRefreshPolling={onRefreshPolling}
          selectedAgent={selectedAgent}
          onRetrySubnet={onRetrySubnet}
          retryingSubnetIndex={retryingSubnetIndex}
        />
      ))}
    </>
  );
}
