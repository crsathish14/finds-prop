/**
 * ChatStatusLine: the status line shown while the assistant looks things up ("Searching our homes…").
 * Purpose: say what the assistant is doing, so the visitor knows an answer is coming. Owner: design system.
 *   The words are the server's (ADR-217: the step the assistant has reached, owner-approved, English only); with
 *   none given, the plain "Searching…" (ADR-128 section 5).
 * Props: text (the line to show; leave out for "Searching…"), className.
 * Responsive: one line; the spinner is 20 px.
 * Accessibility: role="status", so each new line is announced politely once and not repeated. The spinner is
 *   decoration. The turn stops under prefers-reduced-motion (globals.css), leaving a static ring.
 * States: default ("Searching…"), a step (the line the server sent). The line is replaced in place, never stacked.
 * Dependencies: Spinner, next-intl, cn.
 * Tests: chat-parts.test.tsx; Design Lab "AI chat messages".
 * UX reference: ai-chat (addendum batch 4, StatusLine; addendum3.css .chat-status, state "searching").
 */
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

function ChatStatusLine({ text, className }: { text?: string; className?: string }) {
  const translate = useTranslations("ai");
  return (
    <div
      data-slot="chat-status-line"
      role="status"
      className={cn(
        "inline-flex items-center gap-3 text-small font-semibold text-muted",
        className,
      )}
    >
      <Spinner className="text-primary" />
      <span>{text ?? translate("searching")}</span>
    </div>
  );
}

export { ChatStatusLine };
