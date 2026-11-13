import { formatDate, formatTime } from "@/lib/format";
import type { ToolContext } from "./types";

/**
 * The "as of" time of a tool result (ADR-128 section 13): when the database was last read for it. The reads
 * are cached for minutes, so the answer can be a few minutes old; the assistant says so when availability
 * matters. Written as the pages write a date and a time, in India time, by `src/lib/format.ts`
 * ("13 Nov 2026, 3:42 pm"). The time comes from inside the cached read, so it is the time of the last
 * refill and not the time of the call.
 */
export function asOfText(readAt: string, context: ToolContext): string {
  return `${formatDate(context.locale, readAt, "medium")}, ${formatTime(context.locale, readAt)}`;
}
