import type { MessageRole } from "./useConversation";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: MessageRole;
  text: string;
}

export function ChatMessage({ role, text }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex w-full",
        role === "user" ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          role === "user"
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        {text}
      </div>
    </div>
  );
}
