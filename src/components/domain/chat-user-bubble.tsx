/**
 * ChatUserBubble: one message the visitor sent to findsprop's AI assistant, in the chat thread.
 * Purpose: shows what the visitor wrote, right-aligned on the forest tint, with an optional note
 *   under it (the "I removed personal details" notice). Owner: design system. It is the screen
 *   only: the chat island decides what is in the thread. Plain text only (R-SEC-10).
 * Props: children (the message as plain text, with ChatRemovedToken where personal details were
 *   taken out), time (when it was sent, already written for reading, with its machine date; shown small
 *   under the bubble, optional), notice (a ChatNoteLine to show under the bubble, optional), className.
 * Responsive: the bubble is at most 88% of the column (and 40 rem) wide; long words and numbers
 *   break instead of widening the page.
 * Accessibility: a list item whose first words, hidden from sight, are "You said:", so a screen
 *   reader says who spoke. The text is never HTML.
 * States: default; with the removed-details token; with a time under it; with a notice under it.
 * Dependencies: VisuallyHidden, next-intl, cn.
 * Tests: chat-parts.test.tsx; Design Lab "AI chat messages".
 * UX reference: ai-chat (addendum batch 4, UserBubble, ph-token; addendum3.css .bubble).
 */
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type ChatUserBubbleProps = {
  children: ReactNode;
  /** When the message was sent: the words to show and the machine-readable date for the `time` element. */
  time?: { label: string; dateTime: string };
  notice?: ReactNode;
  className?: string;
};

function ChatUserBubble({ children, time, notice, className }: ChatUserBubbleProps) {
  const translate = useTranslations("ai.thread");
  return (
    <li data-slot="chat-user-message" className={cn("flex flex-col items-end gap-2", className)}>
      <div className="max-w-[88%] rounded-lg rounded-br-xs border border-primary-tint-2 bg-primary-tint px-4 py-3 text-body font-medium text-ink md:max-w-160 [overflow-wrap:anywhere]">
        <VisuallyHidden>{translate("youSaid")} </VisuallyHidden>
        {children}
      </div>
      {time ? (
        <time
          dateTime={time.dateTime}
          data-slot="chat-user-time"
          className="-mt-1 text-small font-medium tabular-nums text-muted"
        >
          {time.label}
        </time>
      ) : null}
      {notice}
    </li>
  );
}

/** The grey token that stands where personal details were removed, for example "phone number removed". */
function ChatRemovedToken({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-xs border border-dashed border-line-input bg-surface px-2 text-small font-semibold text-muted">
      {children}
    </span>
  );
}

export { ChatUserBubble, ChatRemovedToken };
export type { ChatUserBubbleProps };
