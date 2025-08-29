import { ChatMsg } from "@/types/chat";

export interface MessageDeduplicationOptions {
  isWorkflowCompleted: boolean;
  subnetsWithNewFeedbackQuestions: Set<number>;
  newMessages: ChatMsg[];
}

/**
 * Checks if a new message is a duplicate of an existing message
 */
export function isDuplicateMessage(
  newMsg: ChatMsg,
  existingMsgs: ChatMsg[]
): boolean {
  return existingMsgs.some((existingMsg) => {
    // Special handling for image regeneration - if new message has different image data, it's not a duplicate
    if (newMsg.imageData && existingMsg.imageData) {
      if (newMsg.imageData !== existingMsg.imageData) {
        return false;
      }
    }

    // Handle workflow_subnet <-> response type duplicates
    if (
      (newMsg.type === "workflow_subnet" && existingMsg.type === "response") ||
      (newMsg.type === "response" && existingMsg.type === "workflow_subnet")
    ) {
      if (
        newMsg.subnetIndex === existingMsg.subnetIndex &&
        newMsg.content &&
        existingMsg.content &&
        (newMsg.content.includes(existingMsg.content.slice(0, 100)) ||
          existingMsg.content.includes(newMsg.content.slice(0, 100)))
      ) {
        // Check if this is an image regeneration case
        if (newMsg.imageData && existingMsg.imageData && newMsg.imageData !== existingMsg.imageData) {
          return false;
        }
        return true;
      }
    }

    // Handle question message duplicates
    if (newMsg.type === "question" && existingMsg.type === "question") {
      if (
        newMsg.subnetIndex === existingMsg.subnetIndex &&
        newMsg.content === existingMsg.content &&
        newMsg.questionData?.text === existingMsg.questionData?.text
      ) {
        return true;
      }
    }

    // Handle answer message duplicates
    if (newMsg.type === "answer" && existingMsg.type === "answer") {
      if (
        newMsg.subnetIndex === existingMsg.subnetIndex &&
        newMsg.content === existingMsg.content
      ) {
        return true;
      }
    }

    // Handle response message duplicates
    if (newMsg.type === "response" && existingMsg.type === "response") {
      // Check by sourceId first
      if (
        newMsg.sourceId &&
        existingMsg.sourceId &&
        newMsg.sourceId === existingMsg.sourceId
      ) {
        return true;
      }

      // Check by content and metadata (excluding feedback messages)
      if (
        !newMsg.sourceId?.includes("feedback") &&
        !existingMsg.sourceId?.includes("feedback")
      ) {
        if (
          newMsg.subnetIndex === existingMsg.subnetIndex &&
          newMsg.toolName === existingMsg.toolName &&
          newMsg.content === existingMsg.content
        ) {
          // Check if this is an image regeneration case
          if (newMsg.imageData && existingMsg.imageData && newMsg.imageData !== existingMsg.imageData) {
            return false;
          }
          return true;
        }
      }
    }

    // Handle workflow_subnet message duplicates
    if (newMsg.type === "workflow_subnet" && existingMsg.type === "workflow_subnet") {
      if (
        newMsg.subnetIndex === existingMsg.subnetIndex &&
        newMsg.toolName === existingMsg.toolName &&
        newMsg.subnetStatus === existingMsg.subnetStatus &&
        newMsg.content === existingMsg.content
      ) {
        // Check if this is an image regeneration case
        if (newMsg.imageData && existingMsg.imageData && newMsg.imageData !== existingMsg.imageData) {
          return false;
        }
        return true;
      }
    }

    return false;
  });
}

/**
 * Filters existing messages based on workflow completion and new message context
 */
export function filterExistingMessages(
  prevMessages: ChatMsg[],
  options: MessageDeduplicationOptions
): ChatMsg[] {
  const { isWorkflowCompleted, subnetsWithNewFeedbackQuestions, newMessages } = options;

  return prevMessages.filter((msg) => {
    // Remove old workflow_subnet messages when new feedback questions are detected
    if (
      msg.type === "workflow_subnet" &&
      msg.subnetIndex !== undefined &&
      subnetsWithNewFeedbackQuestions.has(msg.subnetIndex) &&
      !msg.sourceId?.includes("feedback")
    ) {
      return false;
    }

    // Always keep user, response, question, and notification messages
    if (["user", "response", "question", "notification"].includes(msg.type)) {
      return true;
    }

    // Handle workflow_subnet messages
    if (msg.type === "workflow_subnet" && msg.subnetIndex !== undefined) {
      // If workflow is completed, remove all processing/contacting messages
      if (
        isWorkflowCompleted &&
        msg.subnetStatus === "in_progress" &&
        (msg.content?.includes("Processing") ||
          msg.content?.includes("Contacting") ||
          msg.content?.includes("agent...") ||
          (msg.content === "" && msg.showLoadingDots))
      ) {
        return false;
      }

      // Keep messages with actual content (responses from completed subnets)
      if (
        msg.content &&
        !msg.content.includes("Processing") &&
        !msg.content.includes("Waiting for") &&
        !msg.content.includes("Queued for") &&
        !msg.content.includes("Contacting") &&
        !(msg.content === "" && msg.showLoadingDots)
      ) {
        return true;
      }

      // For completed workflows, also keep messages with "done" status that have actual content
      if (
        isWorkflowCompleted &&
        msg.subnetStatus === "done" &&
        msg.content &&
        msg.content.trim() !== ""
      ) {
        return true;
      }

      const hasNewMessageForSubnet = newMessages.some(
        (newMsg) =>
          newMsg.type === "workflow_subnet" &&
          newMsg.subnetIndex === msg.subnetIndex &&
          (newMsg.subnetStatus === "done" || newMsg.subnetStatus === "awaiting_response")
      );

      // Check if new message has different image data (image regeneration case)
      const hasNewImageData = newMessages.some(
        (newMsg) =>
          newMsg.type === "workflow_subnet" &&
          newMsg.subnetIndex === msg.subnetIndex &&
          newMsg.imageData &&
          msg.imageData &&
          newMsg.imageData !== msg.imageData
      );

      if (hasNewImageData) {
        return false;
      }

      // Remove processing messages that are replaced by new messages
      if (
        msg.subnetStatus === "in_progress" &&
        (msg.content?.includes("Processing") ||
          msg.content?.includes("Contacting") ||
          (msg.content === "" && msg.showLoadingDots)) &&
        hasNewMessageForSubnet
      ) {
        return false;
      }

      // Keep processing messages that don't have replacements
      if (
        msg.subnetStatus === "in_progress" &&
        (msg.content?.includes("Processing") ||
          msg.content?.includes("Contacting") ||
          (msg.content === "" && msg.showLoadingDots)) &&
        !hasNewMessageForSubnet
      ) {
        return true;
      }

      // Keep waiting response and pending messages
      if (
        (msg.subnetStatus === "awaiting_response" && msg.content?.includes("Waiting for")) ||
        (msg.subnetStatus === "pending" && msg.content?.includes("Queued for")) ||
        (msg.subnetStatus === "pending" && msg.content && !msg.content.includes("Queued for"))
      ) {
        return true;
      }

      // Remove old status updates
      return false;
    }

    // Keep all other message types
    return true;
  });
}

/**
 * Extracts subnet indices that have new feedback questions
 */
export function extractSubnetsWithNewFeedbackQuestions(newMessages: ChatMsg[]): Set<number> {
  const subnetsWithNewFeedbackQuestions = new Set<number>();
  
  newMessages.forEach((msg) => {
    if (
      msg.type === "question" &&
      msg.questionData?.type === "feedback" &&
      msg.subnetIndex !== undefined
    ) {
      subnetsWithNewFeedbackQuestions.add(msg.subnetIndex);
    }
  });

  return subnetsWithNewFeedbackQuestions;
}

/**
 * Removes duplicate messages from new messages
 */
export function removeDuplicateMessages(
  newMessages: ChatMsg[],
  existingMessages: ChatMsg[]
): ChatMsg[] {
  return newMessages.filter((newMsg) => !isDuplicateMessage(newMsg, existingMessages));
}

/**
 * Reorganizes messages to put completion message at the end
 */
export function reorganizeMessages(messages: ChatMsg[]): ChatMsg[] {
  const completionIndex = messages.findIndex(
    (msg) => msg.content === "Workflow executed successfully"
  );

  if (completionIndex === -1) {
    return messages;
  }

  const completionMessage = messages[completionIndex];
  const messagesWithoutCompletion = [
    ...messages.slice(0, completionIndex),
    ...messages.slice(completionIndex + 1),
  ];

  return [...messagesWithoutCompletion, completionMessage];
}

/**
 * Main function to process and deduplicate messages
 */
export function processAndDeduplicateMessages(
  prevMessages: ChatMsg[],
  newMessages: ChatMsg[],
  workflowStatus: string
): {
  filteredMessages: ChatMsg[];
  uniqueNewMessages: ChatMsg[];
  finalMessages: ChatMsg[];
} {
  const isWorkflowCompleted = ["completed", "failed", "stopped"].includes(workflowStatus);
  const subnetsWithNewFeedbackQuestions = extractSubnetsWithNewFeedbackQuestions(newMessages);

  // Filter existing messages
  const filteredMessages = filterExistingMessages(prevMessages, {
    isWorkflowCompleted,
    subnetsWithNewFeedbackQuestions,
    newMessages,
  });

  // Remove duplicates from new messages
  const uniqueNewMessages = removeDuplicateMessages(newMessages, filteredMessages);

  // Combine messages
  const messagesWithNew = [...filteredMessages, ...uniqueNewMessages];

  // Reorganize to put completion message at the end
  const finalMessages = reorganizeMessages(messagesWithNew);

  return {
    filteredMessages,
    uniqueNewMessages,
    finalMessages,
  };
}
