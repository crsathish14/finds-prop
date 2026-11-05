/**
 * Pure rules for a project lead (S4-T09 step D). No words, no database: the schema, the card and
 * the tests share them.
 */

/** A site visit can be asked for from today (India time) to this many days ahead. */
export const VISIT_DAYS_AHEAD = 365;

const INDIA_TIME_ZONE = "Asia/Kolkata";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in India as `YYYY-MM-DD`, the day the database also counts from. */
export function indiaToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** A `YYYY-MM-DD` date moved by a number of days. */
export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** The first and last day a visit can be asked for, as `YYYY-MM-DD` (the card's date field uses them too). */
export function visitDateWindow(now: Date): { min: string; max: string } {
  const today = indiaToday(now);
  return { min: today, max: addDays(today, VISIT_DAYS_AHEAD) };
}

/** True for a text that is a real calendar day written `YYYY-MM-DD` (not 2026-02-30). */
function isCalendarDay(text: string): boolean {
  if (!ISO_DATE.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

/**
 * What is wrong with the date of a site visit: nothing was given, or it is not a real day inside
 * the window. Null when it is fine.
 */
export function visitDateProblem(value: string | undefined, now: Date): "missing" | "range" | null {
  if (value === undefined || value === "") return "missing";
  if (!isCalendarDay(value)) return "range";
  const { min, max } = visitDateWindow(now);
  return value < min || value > max ? "range" : null;
}
