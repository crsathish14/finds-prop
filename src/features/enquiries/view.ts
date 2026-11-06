import { formatListedAgo, type Translate } from "@/lib/format";

/** The status as the database keeps it (`enquiries.status`). */
export type EnquiryStatus = "new" | "contacted" | "closed";

/** The status as the sender's list shows it: an enquiry nobody has moved yet is "waiting for the owner". */
export type SentStatus = "waitingForOwner" | "contacted" | "closed";

export function sentStatusOf(status: EnquiryStatus): SentStatus {
  return status === "new" ? "waitingForOwner" : status;
}

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/**
 * How long ago an enquiry was sent, as the list says it: "just now", "5 minutes ago", "2 hours ago",
 * then days, months and years as the cards do. A time that is not a date, or is a little in the
 * future (a clock slightly ahead), is "just now" or empty, never a negative number.
 */
export function formatSentAgo(translate: Translate, sentAt: string, now: number): string {
  const then = Date.parse(sentAt);
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor(Math.max(0, now - then) / MS_PER_MINUTE);
  if (minutes < 1) return translate("enquiries.list.justNow");
  if (minutes < MINUTES_PER_HOUR) return translate("enquiries.list.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return translate("enquiries.list.hoursAgo", { count: hours });
  return formatListedAgo(translate, Math.floor(hours / HOURS_PER_DAY));
}

/** One enquiry in the sender's list, ready to draw. `home` is null when the home is no longer listed. */
export type SentEnquiry = {
  id: string;
  sentAt: string;
  status: EnquiryStatus;
  message: string | null;
  home: { href: string; title: string } | null;
};
