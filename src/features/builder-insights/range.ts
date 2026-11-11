/**
 * The date choice of the builder's Dashboard and Insights pages (S7-T03 step E, FR-BLD-06): "7 days", "30 days",
 * "This month" and "Custom", worked out as whole days in India time (the same days the database counts, ADR-097).
 * Pure functions, so the pages and the tests share them; the page passes the moment it was read.
 */
import { addDays, dayNumber, dayOf, indiaToday, MAX_RANGE_DAYS } from "@/lib/india-days";

export const INSIGHTS_RANGES = ["7", "30", "month", "custom"] as const;
export type InsightsRange = (typeof INSIGHTS_RANGES)[number];

export const DEFAULT_INSIGHTS_RANGE: InsightsRange = "30";

/** What the address says, as strings and as typed (nothing checked yet). */
export type InsightsParams = {
  range?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

/** The choice after checking: always a range the database will answer, with the days spelled out. */
export type ResolvedRange = { range: InsightsRange; from: string; to: string };

const isRange = (value: string | undefined): value is InsightsRange =>
  (INSIGHTS_RANGES as readonly string[]).includes(value ?? "");

/**
 * The range the address asks for, as days. "7 days" and "30 days" end today and count today as one of them; "This
 * month" runs from the 1st to today; "Custom" needs two real days, the first not after the second, no more than a
 * year apart. Anything that is not understood is the default (30 days), so a mistyped address still shows the page.
 */
export function resolveInsightsRange(params: InsightsParams, now: Date): ResolvedRange {
  const today = indiaToday(now);
  const to = today;
  if (params.range === "7") return { range: "7", from: addDays(today, -6), to };
  if (params.range === "month") return { range: "month", from: `${today.slice(0, 8)}01`, to };
  if (params.range === "custom") {
    const first = dayNumber(params.from);
    const last = dayNumber(params.to);
    if (first !== null && last !== null && first <= last && last - first <= MAX_RANGE_DAYS) {
      return { range: "custom", from: dayOf(first), to: dayOf(last) };
    }
  }
  return { range: "30", from: addDays(today, -29), to };
}

export { addDays, indiaToday, MAX_RANGE_DAYS };
export { isRange as isInsightsRange };

/**
 * The address of a page for some choices. The default (30 days, all projects) is left out (R-FE-11); a custom range
 * names its two days; a project is named when one is chosen.
 */
export function insightsHref(
  path: string,
  choice: {
    range: InsightsRange;
    from?: string | undefined;
    to?: string | undefined;
    project?: string | undefined;
  },
): string {
  const query = new URLSearchParams();
  if (choice.range !== DEFAULT_INSIGHTS_RANGE) query.set("range", choice.range);
  if (choice.range === "custom" && choice.from && choice.to) {
    query.set("from", choice.from);
    query.set("to", choice.to);
  }
  if (choice.project) query.set("project", choice.project);
  const text = query.toString();
  return text === "" ? path : `${path}?${text}`;
}
