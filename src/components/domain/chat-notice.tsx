/**
 * ChatNotice: the alert the chat shows when it cannot answer: an error, too many messages, the daily
 * limit, or the assistant being unavailable.
 * Purpose: one place for the four fixed notices above the composer, so each says what happened, what
 *   is kept and what to do next. Owner: design system. It is built from Alert; the words are in
 *   en.json under `ai`. The page decides which one to show and how long the wait is.
 * Props: kind ("error" | "too_many_messages" | "daily_limit" | "unavailable"), seconds (the wait,
 *   for "too_many_messages"), onRetry (for "error": sends the same message again), filtersHref
 *   (where "Use filters" and "Search with filters" lead; the search page), className.
 * Responsive: full width of the column; the action wraps under the text on a narrow screen.
 * Accessibility: the error and the two message limits are role="alert" (read at once); "unavailable"
 *   is role="status". Each has a title in words and its own icon, so colour is not the only signal.
 *   Try again is a real button.
 * States: error (danger, with Try again), too many messages (warning), daily limit (warning),
 *   unavailable (info, with the filters link).
 * Dependencies: Alert, Button, Link, next-intl.
 * Tests: chat-parts.test.tsx; Design Lab "AI chat notices".
 * UX reference: ai-chat (error), ai-chat-limits (ratelimit, ratelimit-day, unavailable) (addendum batch 4).
 */
import { useTranslations } from "next-intl";
import { Alert } from "@/components/patterns/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

type ChatNoticeProps = {
  kind: "error" | "too_many_messages" | "daily_limit" | "unavailable";
  seconds?: number;
  onRetry?: () => void;
  filtersHref?: string;
  className?: string;
};

function ChatNotice({ kind, seconds = 45, onRetry, filtersHref, className }: ChatNoticeProps) {
  const translate = useTranslations("ai");
  const classes = className ? { className } : {};

  const filtersAction = (label: string) =>
    filtersHref ? (
      <Button asChild variant="secondary" size="sm">
        <Link href={filtersHref} className="text-primary no-underline hover:text-primary">
          {label}
        </Link>
      </Button>
    ) : undefined;

  if (kind === "error") {
    return (
      <Alert
        tone="danger"
        title={translate("errorTitle")}
        {...classes}
        action={
          onRetry ? (
            <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
              {translate("notice.retry")}
            </Button>
          ) : undefined
        }
      >
        {translate("errorBody")}
      </Alert>
    );
  }

  if (kind === "too_many_messages") {
    return (
      <Alert
        tone="warning"
        urgent
        title={translate("tooManyMessagesTitle")}
        {...classes}
        action={filtersAction(translate("notice.useFilters"))}
      >
        {translate("tooManyMessagesBody", { seconds })}
      </Alert>
    );
  }

  if (kind === "daily_limit") {
    return (
      <Alert tone="warning" urgent title={translate("dailyLimitTitle")} {...classes}>
        {translate("dailyLimitBody")}
      </Alert>
    );
  }

  return (
    <Alert
      tone="info"
      title={translate("unavailableTitle")}
      {...classes}
      action={filtersAction(translate("notice.searchWithFilters"))}
    >
      {translate("unavailableBody")}
    </Alert>
  );
}

export { ChatNotice };
export type { ChatNoticeProps };
