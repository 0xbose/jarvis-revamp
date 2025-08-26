import { ChatMsg } from "@/types/chat";

export interface FeedbackThread {
  feedbackIndex: number;
  threadKey: string; // Unique identifier for the thread
  question: ChatMsg | null;
  answer: ChatMsg | null;
  response: ChatMsg | null;
  timestamp: Date;
  isRecent?: boolean; // Flag to indicate if this contains recent polled data
}

export interface SubnetGroup {
  subnetIndex: number;
  toolName: string;
  mainMessages: ChatMsg[]; // Non-feedback messages
  feedbackThreads: FeedbackThread[];
  timestamp: Date;
  status: string;
  isRecent?: boolean; // Flag to indicate if this contains recent polled data
}

export interface MessageGroups {
  systemMessages: ChatMsg[]; // User messages, general responses
  subnetGroups: SubnetGroup[];
}

export const useMessageGrouping = () => {
  const groupMessagesBySubnet = (messages: ChatMsg[], previousMessages?: ChatMsg[]): MessageGroups => {
    const systemMessages: ChatMsg[] = [];
    const subnetGroups: Map<number, SubnetGroup> = new Map();

    // Filter out unwanted status and completion messages
    const filteredMessages = messages.filter((message) => {
      // Filter out workflow status messages
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

      return true;
    });

    // Create a set of previous message IDs to identify new messages
    const previousMessageIds = new Set(previousMessages?.map(m => m.id) || []);

    filteredMessages.forEach((message) => {
      // System-level messages (user messages, general responses)
      if (message.subnetIndex === undefined || message.type === "user") {
        systemMessages.push(message);
        return;
      }

      const subnetIndex = message.subnetIndex;

      // Initialize subnet group if it doesn't exist
      if (!subnetGroups.has(subnetIndex)) {
        subnetGroups.set(subnetIndex, {
          subnetIndex,
          toolName: message.toolName || `Subnet ${subnetIndex}`,
          mainMessages: [],
          feedbackThreads: [],
          timestamp: message.timestamp,
          status: message.subnetStatus || "unknown",
          isRecent: false,
        });
      }

      const group = subnetGroups.get(subnetIndex)!;

      // Check if this message is new (recent polled data)
      const isNewMessage = !previousMessageIds.has(message.id);
      if (isNewMessage) {
        group.isRecent = true;
        console.log(`🆕 New message detected in subnet ${subnetIndex}:`, {
          messageId: message.id,
          content: message.content?.slice(0, 50),
          timestamp: message.timestamp
        });
      }

      // Check if this is a feedback message
      if (message.sourceId?.includes("feedback")) {
        // Extract feedback index from sourceId
        // Format: subnet_${index}_feedback_response_${feedbackIndex} or subnet_${index}_feedback_question_${feedbackIndex} or subnet_${index}_feedback_answer_${feedbackIndex}
        const feedbackMatch = message.sourceId.match(/feedback_(response|question|answer)_(\d+)/);
        let feedbackIndex = 0;
        if (feedbackMatch) {
          feedbackIndex = parseInt(feedbackMatch[2]);
        }
        
        console.log(`🔍 Processing feedback message:`, {
          sourceId: message.sourceId,
          feedbackIndex,
          messageType: message.type,
          content: message.content?.slice(0, 50),
          subnetIndex: message.subnetIndex
        });

        // Create a unique key for this feedback thread using subnet + feedback index
        const threadKey = `${message.subnetIndex}_${feedbackIndex}`;
        
        // Find or create feedback thread
        let thread = group.feedbackThreads.find(
          (t) => t.threadKey === threadKey
        );

        if (!thread) {
          thread = {
            feedbackIndex,
            threadKey, // Add unique key for identification
            question: null,
            answer: null,
            response: null,
            timestamp: message.timestamp,
            isRecent: false,
          };
          group.feedbackThreads.push(thread);
        }

        // Mark thread as recent if it contains new messages
        if (isNewMessage) {
          thread.isRecent = true;
        }

        // Assign message to appropriate slot in thread based on sourceId
        if (message.sourceId.includes("question")) {
          thread.question = message;
        } else if (message.sourceId.includes("answer")) {
          thread.answer = message;
        } else if (message.sourceId.includes("response")) {
          thread.response = message;
        }

        // Update thread timestamp to latest message
        if (message.timestamp > thread.timestamp) {
          thread.timestamp = message.timestamp;
        }
      } else {
        // Main subnet message (non-feedback)
        group.mainMessages.push(message);
      }

      // Update group timestamp to latest message
      if (message.timestamp > group.timestamp) {
        group.timestamp = message.timestamp;
      }
    });

    // Sort feedback threads by timestamp within each subnet
    subnetGroups.forEach((group) => {
      group.feedbackThreads.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Debug logging for feedback threads
      if (group.feedbackThreads.length > 0) {
        console.log(`🔍 Subnet ${group.subnetIndex} (${group.toolName}) has ${group.feedbackThreads.length} feedback threads:`, 
          group.feedbackThreads.map(t => ({
            index: t.feedbackIndex,
            hasQuestion: !!t.question,
            hasAnswer: !!t.answer,
            hasResponse: !!t.response,
            questionText: t.question?.content?.slice(0, 30),
            isRecent: t.isRecent
          }))
        );
      }
    });

    return {
      systemMessages,
      subnetGroups: Array.from(subnetGroups.values()).sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    };
  };

  const getFeedbackThreadTitle = (thread: FeedbackThread): string => {
    if (thread.question) {
      const questionText = thread.question.content;
      const truncatedText = questionText.length > 60 
        ? `${questionText.slice(0, 60)}...` 
        : questionText;
 
      return `${truncatedText}`;
    }
    return `Feedback ${thread.feedbackIndex + 1}`;
  };

  const getSubnetTitle = (group: SubnetGroup): string => {
    // Only show the agent name, nothing else
    return group.toolName || `Subnet ${group.subnetIndex}`;
  };

  const getSubnetStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return "done";
      case "failed":
        return "failed";
      case "in_progress":
        return "processing";
      case "awaiting_response":
        return "waiting";
      case "pending":
        return "pending";
      default:
        return "unknown";
    }
  };

  return {
    groupMessagesBySubnet,
    getFeedbackThreadTitle,
    getSubnetTitle,
    getSubnetStatusIcon,
  };
};
