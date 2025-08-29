"use client";

import React, { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FileText, HelpCircle, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Demo data structure to show how feedback history works
const demoFeedbackHistory = [
  {
    id: 1,
    prompt: "Analyze the following data and provide insights",
    data: "Sample data analysis results showing trends and patterns...",
    question: "Do you want to proceed with this analysis?",
    answer: "Yes, proceed with the analysis",
    status: "completed"
  },
  {
    id: 2,
    prompt: "Generate a report based on user feedback",
    data: "User feedback data collected from surveys...",
    question: "What type of report format would you prefer?",
    answer: null,
    status: "awaiting_response"
  }
];

export function FeedbackDemo() {
  const [isOpen, setIsOpen] = useState(false);

  const [feedbackText, setFeedbackText] = useState("");
  const [showNewData, setShowNewData] = useState(false);

  // Simulate new data arrival after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowNewData(true);
      // Removed auto-open behavior - collapsible stays closed until manually clicked

    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Feedback History Integration Demo
        </h1>
        <p className="text-muted-foreground">
          This demonstrates how feedback history is prioritized over subnet data and displayed in collapsible format
        </p>
        <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
          💡 Watch this collapsible auto-open after 3 seconds when "new data" arrives!
        </p>
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className={`border rounded-lg transition-all duration-300 ${
          showNewData 
            ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm' 
            : 'border-border bg-card'
        }`}>
          <CollapsibleTrigger className="w-full p-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span className="font-medium">Openai</span>
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className="p-4 border-t border-border">
            <div className="space-y-4">
              <div className="border border-border rounded-lg bg-muted/20">
                <div className="p-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span>Response & Data</span>
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-sm text-foreground">
                    {showNewData 
                      ? "🆕 New polled data has arrived! This collapsible automatically opened to show the new content."
                      : "Initial response data will be shown here..."
                    }
                  </div>
                </div>
              </div>

              {showNewData && (
                <div className="border border-green-300 rounded-lg bg-green-50/50 dark:bg-green-950/20">
                  <div className="p-3 border-b border-green-300 bg-green-100/30 dark:bg-green-900/30">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-200">
                      <HelpCircle className="w-4 h-4" />
                      <span>New Question (Auto-opened)</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-sm text-foreground mb-3">
                      This question appeared due to new polled data and automatically opened the collapsible!
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-500 hover:text-green-400 bg-green-950/60 hover:bg-green-950/70 border border-green-800/50 hover:border-green-800/70"
                      >
                        Yes, proceed
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-500 hover:text-blue-400 bg-blue-950/60 hover:bg-blue-950/70 border border-blue-800/50 hover:border-blue-800/70"
                      >
                        Provide feedback
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <div className="text-center text-sm text-muted-foreground">
        <p>This demo shows how the auto-open functionality works:</p>
        <ul className="mt-2 space-y-1">
          <li>• Collapsible starts closed</li>
          <li>• After 3 seconds, "new data" arrives</li>
          <li>• Collapsible automatically opens</li>
          <li>• Visual indicators show new content</li>
        </ul>
      </div>
    </div>
  );
}
