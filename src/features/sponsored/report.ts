import type { SponsorEventSlot } from "@/lib/sponsor-events";

/**
 * The sponsor report's rules (ADR-194), apart from the reads so they can be tested alone: the periods the admin can
 * pick, the days a period covers (India time, as the counts are kept), and the rows of each placement, named.
 */

/** The periods the admin can pick, in days, and the one shown first. */
export const REPORT_PERIODS = [7, 30, 90] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];
export const DEFAULT_REPORT_PERIOD: ReportPeriod = 30;

/** The period in the address (`?days=30`), or the default for anything else. */
export function reportPeriodOf(value: string | string[] | undefined): ReportPeriod {
  const days = Number(Array.isArray(value) ? value[0] : value);
  return (REPORT_PERIODS as readonly number[]).includes(days)
    ? (days as ReportPeriod)
    : DEFAULT_REPORT_PERIOD;
}

const DAY_MS = 86_400_000;
const INDIA_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/** The first and last day of the period that ends today in India, both included, as `YYYY-MM-DD`. */
export function reportRange(days: number, now: Date): { from: string; to: string } {
  const to = INDIA_DATE.format(now);
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

/** One placement's totals for the period, as the database gives them. */
export type ReportCount = { slot: SponsorEventSlot; key: string; views: number; clicks: number };

/** One row of the report: who it is, whether it is shown now, and its totals. */
export type ReportRow = {
  key: string;
  /** The ad's brand or description, or the builder's name; null for a sponsor that is gone. */
  name: string | null;
  live: boolean;
  views: number;
  clicks: number;
};

/** Who each placement holds now, with their names: the hero ads and the picked builders, in the admin's order. */
export type ReportSponsors = Record<SponsorEventSlot, readonly { key: string; name: string }[]>;

/** The names of every sponsor still known (switched-off ads, builders no longer picked), by key. */
export type ReportNames = ReadonlyMap<string, string>;

/**
 * The rows of each placement: every sponsor held now (with nothing counted, a row of zeros), then any other that was
 * counted in the period (no longer shown), most viewed first. A switched-off ad or a builder no longer picked keeps
 * their name; an ad that was deleted has none.
 */
export function reportRows(
  counts: readonly ReportCount[],
  sponsors: ReportSponsors,
  names: ReportNames,
): Record<SponsorEventSlot, ReportRow[]> {
  const rowsOf = (slot: SponsorEventSlot): ReportRow[] => {
    const counted = new Map(
      counts.filter((count) => count.slot === slot).map((count) => [count.key, count]),
    );
    const held = sponsors[slot].map((sponsor) => ({
      key: sponsor.key,
      name: sponsor.name,
      live: true,
      views: counted.get(sponsor.key)?.views ?? 0,
      clicks: counted.get(sponsor.key)?.clicks ?? 0,
    }));
    const heldKeys = new Set(held.map((row) => row.key));
    const gone = [...counted.values()]
      .filter((count) => !heldKeys.has(count.key))
      .sort((first, second) => second.views - first.views || first.key.localeCompare(second.key))
      .map((count) => ({
        key: count.key,
        name: names.get(count.key) ?? null,
        live: false,
        views: count.views,
        clicks: count.clicks,
      }));
    return [...held, ...gone];
  };
  return { hero: rowsOf("hero"), results: rowsOf("results"), spotlight: rowsOf("spotlight") };
}

/** Clicks for every hundred views, to one decimal place; null with no views. */
export function clickRate(views: number, clicks: number): number | null {
  if (views <= 0) return null;
  return Math.round((clicks / views) * 1000) / 10;
}
