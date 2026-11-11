/**
 * The date choice of the admin's Overview page (S7-T06 part 3, FR-ADM-01): "Today", "Yesterday", "7 days", "30 days",
 * "This month" and "Custom", worked out as whole days in India time (the same days the database counts, ADR-121).
 * Pure functions, so the page and the tests share them; the page passes the moment it was read.
 */
import { addDays, dayNumber, dayOf, indiaToday, MAX_RANGE_DAYS } from "@/lib/india-days";

export const OVERVIEW_RANGES = ["today", "yesterday", "7", "30", "month", "custom"] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];

export const DEFAULT_OVERVIEW_RANGE: OverviewRange = "30";

/** What the address says, as strings and as typed (nothing checked yet). */
export type OverviewParams = {
  range?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

/** The choice after checking: always a range the database will answer, with the days spelled out. */
export type ResolvedOverviewRange = { range: OverviewRange; from: string; to: string };

export const isOverviewRange = (value: string | undefined): value is OverviewRange =>
  (OVERVIEW_RANGES as readonly string[]).includes(value ?? "");

/**
 * The range the address asks for, as days. "Today" and "Yesterday" are one day each; "7 days" and "30 days" end today
 * and count today as one of them; "This month" runs from the 1st to today; "Custom" needs two real days, the first not
 * after the second, no more than a year apart. Anything that is not understood is the default (30 days), so a
 * mistyped address still shows the page.
 */
export function resolveOverviewRange(params: OverviewParams, now: Date): ResolvedOverviewRange {
  const today = indiaToday(now);
  if (params.range === "today") return { range: "today", from: today, to: today };
  if (params.range === "yesterday") {
    const yesterday = addDays(today, -1);
    return { range: "yesterday", from: yesterday, to: yesterday };
  }
  if (params.range === "7") return { range: "7", from: addDays(today, -6), to: today };
  if (params.range === "month") {
    return { range: "month", from: `${today.slice(0, 8)}01`, to: today };
  }
  if (params.range === "custom") {
    const first = dayNumber(params.from);
    const last = dayNumber(params.to);
    if (first !== null && last !== null && first <= last && last - first <= MAX_RANGE_DAYS) {
      return { range: "custom", from: dayOf(first), to: dayOf(last) };
    }
  }
  return { range: "30", from: addDays(today, -29), to: today };
}

/**
 * The address of the page for some choices. The default (30 days) is left out (R-FE-11); a custom range names its two
 * days.
 */
export function overviewHref(
  path: string,
  choice: { range: OverviewRange; from?: string | undefined; to?: string | undefined },
): string {
  const query = new URLSearchParams();
  if (choice.range !== DEFAULT_OVERVIEW_RANGE) query.set("range", choice.range);
  if (choice.range === "custom" && choice.from && choice.to) {
    query.set("from", choice.from);
    query.set("to", choice.to);
  }
  const text = query.toString();
  return text === "" ? path : `${path}?${text}`;
}
