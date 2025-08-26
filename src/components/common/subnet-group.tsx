"use client";


import React from "react";
import { AgentGroup } from "./agent-group";
import type { SubnetGroup as SubnetGroupType } from "@/hooks/use-message-grouping";


interface SubnetGroupProps {
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

export function SubnetGroup({
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
}: SubnetGroupProps) {
  return (
    <div className="relative mb-4">
      <AgentGroup
        group={group}
        isLast={isLast}
        currentWorkflowData={currentWorkflowData}
        onNotificationYes={onNotificationYes}
        onNotificationNo={onNotificationNo}
        onFeedbackProceed={onFeedbackProceed}
        onFeedbackSubmit={onFeedbackSubmit}
        workflowStatus={workflowStatus}
        pollingStoppedAt={pollingStoppedAt}
        onRefreshPolling={onRefreshPolling}
        selectedAgent={selectedAgent}
      />
    </div>
  );
}
