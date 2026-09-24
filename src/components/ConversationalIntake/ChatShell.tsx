/**
 * Outer shell for the conversational intake UI.
 * Renders the message thread and the current structured input control.
 * When isComplete, calls onComplete with the finished ConversationState.
 */

import { useEffect, useRef } from "react";
import { useConversation } from "./useConversation";
import { ChatMessage } from "./ChatMessage";
import { StructuredInput } from "./StructuredInput";
import type { ConversationState } from "./intakeToPayload";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface ChatShellProps {
  onComplete: (state: ConversationState) => void;
}

export function ChatShell({ onComplete }: ChatShellProps) {
  const lang = useLang();
  const { messages, state, currentStep, isComplete, answer, skip, reset } =
    useConversation();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Signal completion once all steps are done
  useEffect(() => {
    if (isComplete && state.email && state.productName) {
      onComplete(state);
    }
  }, [isComplete, state, onComplete]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            {lang === "zh" ? "进口合规检查" : "Import Compliance Check"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {lang === "zh"
              ? "我会问您几个问题，然后生成完整的进口分析报告。"
              : "I'll ask a few questions, then generate your full import analysis."}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={reset}
          title={lang === "zh" ? "重新开始" : "Start over"}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} text={msg.text} />
        ))}
        {isComplete && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-muted-foreground animate-pulse">
              {lang === "zh" ? "正在分析……" : "Analyzing…"}
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Current input */}
      {!isComplete && currentStep && (
        <div className="border-t px-4 py-3">
          <StructuredInput
            step={currentStep}
            onSubmit={answer}
            onSkip={currentStep.optional ? skip : undefined}
          />
        </div>
      )}
    </div>
  );
}
