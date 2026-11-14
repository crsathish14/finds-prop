/**
 * ChatStatusLine: the fixed "Searching…" line shown while the assistant looks things up.
 * Purpose: one status for every tool the assistant uses, so the visitor knows an answer is coming.
 *   Owner: design system. The word is the same for every tool (ADR-128 section 5).
 * Props: className.
 * Responsive: one line; the spinner is 20 px.
 * Accessibility: role="status", so it is announced politely once and not repeated. The spinner is
 *   decoration. The turn stops under prefers-reduced-motion (globals.css), leaving a static ring.
 * States: default (the only state).
 * Dependencies: Spinner, next-intl, cn.
 * Tests: chat-parts.test.tsx; Design Lab "AI chat messages".
 * UX reference: ai-chat (addendum batch 4, StatusLine; addendum3.css .chat-status, state "searching").
 */
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

function ChatStatusLine({ className }: { className?: string }) {
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
      <span>{translate("searching")}</span>
    </div>
  );
}

export { ChatStatusLine };
