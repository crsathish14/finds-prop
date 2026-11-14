/**
 * ChatThread: the list that holds the conversation, one item per message.
 * Purpose: the labelled reading column the chat messages sit in, 24 px apart, so every message is
 *   spaced the same and a screen reader can find the conversation. Owner: design system. It holds no
 *   state: the chat island passes ChatUserBubble and ChatAssistantMessage items.
 * Props: children (ChatUserBubble and ChatAssistantMessage items), className.
 * Responsive: full width of the reading column, which the page limits to 51 rem (820 px).
 * Accessibility: an ordered list with the label "Conversation with findsprop's AI assistant"; each
 *   message is a list item that says who spoke.
 * States: default.
 * Dependencies: next-intl, cn.
 * Tests: chat-parts.test.tsx; Design Lab "AI chat messages".
 * UX reference: ai-chat (addendum batch 4, ChatColumn; addendum3.css .thread).
 */
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

function ChatThread({ children, className }: { children: ReactNode; className?: string }) {
  const translate = useTranslations("ai.thread");
  return (
    <ol
      data-slot="chat-thread"
      aria-label={translate("label")}
      className={cn("flex flex-col gap-6", className)}
    >
      {children}
    </ol>
  );
}

export { ChatThread };
