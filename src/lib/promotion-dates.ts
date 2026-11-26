/**
 * Promotion start and end dates (ADR-210, owner decision 26 Nov 2026): every promotion the super admin sets (a hero
 * sponsor ad, a Sponsored builder, a Spotlight builder, a Top developer, and the Featured switch of a home or a project)
 * may carry an optional first and last day. Days are India dates as `YYYY-MM-DD`: a promotion starts at the beginning of
 * its start date and ends at the end of its end date. No start date means it runs from now; no end date means it runs
 * until the admin removes it.
 *
 * Pure: the caller passes today's India date (`indiaToday` in `india-days.ts`), so the site, the AI and the admin pages
 * apply one rule.
 */

export interface PromotionDates {
  /** The first day it runs, `YYYY-MM-DD`; none means it runs from now. */
  readonly startsOn?: string | undefined;
  /** The last day it runs, `YYYY-MM-DD`; none means it runs until it is removed. */
  readonly endsOn?: string | undefined;
}

/** Scheduled: its start date is still ahead. Running: it shows today. Ended: its end date has passed. */
export type PromotionStatus = "scheduled" | "running" | "ended";

/** What a stored or typed day looks like. Whether it is a real calendar day is checked by the save. */
export const PROMOTION_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Where a promotion stands today. `YYYY-MM-DD` text sorts in date order, so the days compare as text. */
export function promotionStatus(dates: PromotionDates | undefined, today: string): PromotionStatus {
  if (dates?.startsOn !== undefined && today < dates.startsOn) return "scheduled";
  if (dates?.endsOn !== undefined && today > dates.endsOn) return "ended";
  return "running";
}

/** True when the promotion shows today. */
export function isRunning(dates: PromotionDates | undefined, today: string): boolean {
  return promotionStatus(dates, today) === "running";
}

/** True when both days are given and the last comes before the first. */
export function endsBeforeStart(dates: PromotionDates): boolean {
  return (
    dates.startsOn !== undefined && dates.endsOn !== undefined && dates.endsOn < dates.startsOn
  );
}

/** Only the days that are given, so a stored value never holds an empty one. */
export function compactDates(dates: PromotionDates): PromotionDates {
  return {
    ...(dates.startsOn === undefined ? {} : { startsOn: dates.startsOn }),
    ...(dates.endsOn === undefined ? {} : { endsOn: dates.endsOn }),
  };
}
