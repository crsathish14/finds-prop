/**
 * ChatDraftQuote: a dashed box that quotes the message the visitor typed and has not sent yet.
 * Purpose: shows the kept message in the sign-in gate and on a confirm card that needs signing in
 *   again, so the visitor sees it will not be lost. Owner: design system.
 * Props: label (already-translated small heading, such as "Your next message, not sent yet"),
 *   children (the kept text, plain), className.
 * Responsive: full width of its box; long words break instead of widening the page.
 * Accessibility: plain text, read before the button that follows it. Never HTML.
 * States: default.
 * Dependencies: cn.
 * Tests: chat-parts.test.tsx; Design Lab "AI chat gates".
 * UX reference: ai-chat-limits, ai-chat-confirm (addendum batch 4, DraftQuote; addendum3.css .draft-quote).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ChatDraftQuoteProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

function ChatDraftQuote({ label, children, className }: ChatDraftQuoteProps) {
  return (
    <div
      data-slot="chat-draft-quote"
      className={cn(
        "grid gap-1 rounded-md border-[length:var(--bw-field)] border-dashed border-line-strong bg-canvas px-4 py-3",
        className,
      )}
    >
      <p className="text-overline text-muted">{label}</p>
      <p className="text-body font-medium text-ink [overflow-wrap:anywhere]">{children}</p>
    </div>
  );
}

export { ChatDraftQuote };
export type { ChatDraftQuoteProps };
