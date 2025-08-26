"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, MessageSquare, FileText, HelpCircle } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { FeedbackThread } from "./feedback-thread";
import type { SubnetGroup as SubnetGroupType } from "@/hooks/use-message-grouping";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMessageGrouping } from "@/hooks/use-message-grouping";

interface SubnetGroupProps {
  group: SubnetGroupType;
  isLast?: boolean;
  onNotificationYes?: (notification: any) => Promise<void>;
  onNotificationNo?: (notification: any) => Promise<void>;
  onFeedbackProceed?: (question: string, answer: string) => Promise<void>;
  onFeedbackSubmit?: (question: string, answer: string, feedback: string) => Promise<void>;
  workflowStatus?: string;
  pollingStoppedAt?: Date | null;
  onRefreshPolling?: () => void;
}

export function SubnetGroup({
  group,
  isLast = false,
  onNotificationYes,
  onNotificationNo,
  onFeedbackProceed,
  onFeedbackSubmit,
  workflowStatus,
  pollingStoppedAt,
  onRefreshPolling,
}: SubnetGroupProps) {
  const [isOpen, setIsOpen] = useState(true); // Subnets open by default
  const { getSubnetTitle, getSubnetStatusIcon } = useMessageGrouping();

  const title = getSubnetTitle(group);
  const hasFeedbackThreads = group.feedbackThreads.length > 0;
  const hasMainMessages = group.mainMessages.length > 0;

  // Auto-open if this subnet contains recent polled data
  useEffect(() => {
    if (group.isRecent) {
      setIsOpen(true);
    }
  }, [group.isRecent]);

  return (
    <div className="relative mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="relative flex items-start">
          <div className="flex-1 min-w-0">
            <CollapsibleTrigger className="w-full">
              <div className={`flex items-center justify-between p-4 border rounded-lg transition-all duration-300 ${
                group.isRecent 
                  ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm' 
                  : 'border-border bg-card hover:bg-card/80'
              }`}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-base font-semibold text-foreground capitalize flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      {title}
                      {group.isRecent && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse">
                          New Data
                        </span>
                      )}
                    </div>
                   
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-2 ml-4">
              <div className="space-y-4 pl-6 border-l border-border">
                {/* Main subnet messages */}
                {hasMainMessages && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4" />
                      <span>Main Content</span>
                    </div>
                    {group.mainMessages.map((message, index) => (
                      <div key={message.id} className="border border-border rounded-lg bg-card/50">
                        <ChatMessage
                          message={message}
                          isLast={index === group.mainMessages.length - 1 && !hasFeedbackThreads}
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
                )}

                {/* Feedback threads */}
                {hasFeedbackThreads && (
                  <div className="space-y-3">
                    {group.feedbackThreads.map((thread, index) => (
                      <FeedbackThread
                        key={`feedback-${thread.feedbackIndex}`}
                        thread={thread}
                        isLast={index === group.feedbackThreads.length - 1}
                        onNotificationYes={onNotificationYes}
                        onNotificationNo={onNotificationNo}
                        onFeedbackProceed={onFeedbackProceed}
                        onFeedbackSubmit={onFeedbackSubmit}
                        workflowStatus={workflowStatus}
                        pollingStoppedAt={pollingStoppedAt}
                        onRefreshPolling={onRefreshPolling}
                      />
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
