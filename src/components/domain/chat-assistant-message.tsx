/**
 * ChatAssistantMessage: one answer from findsprop's AI assistant, in the chat thread.
 * Purpose: the name label, then the answer text, then the cards and notes that belong to it, so every
 *   answer looks the same whether it is streaming, finished or a fixed reply. Owner: design system.
 *   It is the screen only: the text is plain (the model never writes links or HTML, R-FE-14), and
 *   the cards are the approved property and project cards passed in as children of `cards`.
 * Props: children (the answer text as paragraphs), streaming (the answer is still being written: the text is
 *   marked busy; put a ChatStreamCaret at the end of the last paragraph), status (a ChatStatusLine while the
 *   assistant searches, shown instead of text), cards (up to three PropertyCard or ProjectCard, one
 *   per row on a phone and two per row when the column is 36 rem wide), notes (ChatNoteLine items under the answer),
 *   className.
 * Responsive: the text is at most 68 characters wide; the card grid is one column, then two columns
 *   when the column is 36 rem wide (a container query; the UX drew it at 640 px).
 * Accessibility: a list item with a text label (sparkle disc plus the assistant's name; the icon is
 *   decoration). While streaming the text node is aria-busy and not announced sentence by sentence;
 *   when it ends it is read once. The cards keep their own focus order, after the text.
 * States: searching (status), streaming (caret), answer, answer with cards, answer with notes.
 * Dependencies: Icon, VisuallyHidden, next-intl, cn.
 * Tests: chat-parts.test.tsx; Design Lab "AI chat messages".
 * UX reference: ai-chat (addendum batch 4, AssistantMessage, StreamCaret; addendum3.css .msg-ai, .ai-text).
 */
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type ChatAssistantMessageProps = {
  children?: ReactNode;
  streaming?: boolean;
  status?: ReactNode;
  cards?: ReactNode;
  notes?: ReactNode;
  className?: string;
};

/** The thin bar after the last streamed character. Put it at the end of the last paragraph while the answer is being written. */
function ChatStreamCaret() {
  return (
    <span
      aria-hidden="true"
      className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle"
    />
  );
}

function ChatAssistantMessage({
  children,
  streaming = false,
  status,
  cards,
  notes,
  className,
}: ChatAssistantMessageProps) {
  const translate = useTranslations("ai");
  return (
    <li data-slot="chat-assistant-message" className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2 text-caption font-bold text-muted">
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-pill bg-cta-tint text-cta-text"
        >
          <Icon icon={Sparkles} size="sm" />
        </span>
        <span aria-hidden="true">{translate("assistantName")}</span>
        <VisuallyHidden>{translate("thread.assistantSaid")}</VisuallyHidden>
      </div>
      {status}
      {children ? (
        <div
          aria-busy={streaming}
          className={cn(
            "max-w-[68ch] text-body leading-relaxed text-ink [overflow-wrap:anywhere]",
            "[&_p+p]:mt-3",
          )}
        >
          {children}
        </div>
      ) : null}
      {cards ? (
        <div className="@container mt-1">
          <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">{cards}</div>
        </div>
      ) : null}
      {notes ? <div className="flex flex-col gap-2">{notes}</div> : null}
    </li>
  );
}

export { ChatAssistantMessage, ChatStreamCaret };
export type { ChatAssistantMessageProps };
