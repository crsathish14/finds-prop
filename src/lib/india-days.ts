/**
 * Whole days in India time, as `YYYY-MM-DD` text (S7-T03 step E, S7-T06): the same days the database counts
 * (ADR-097, ADR-121). Pure functions, shared by the builder's Insights pages and the admin's Overview page, so the
 * two never disagree about what "today" is. The caller passes the moment it was read.
 */

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The longest range the database answers, in days between the first day and the last. */
export const MAX_RANGE_DAYS = 365;

/** Today's date in India, as `YYYY-MM-DD`. */
export function indiaToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The day as a number of days since 1970, or null when it is not a real calendar day. */
export function dayNumber(day: string | undefined): number | null {
  if (day === undefined || !ISO_DAY.test(day)) return null;
  const time = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  // `Date.parse` rolls 31 Feb over to March; a real day reads back the same.
  return new Date(time).toISOString().slice(0, 10) === day ? time / DAY_MS : null;
}

/** The day, as text, for a number of days since 1970. */
export function dayOf(number: number): string {
  return new Date(number * DAY_MS).toISOString().slice(0, 10);
}

/** The day `count` days after (or, if negative, before) the given day. */
export function addDays(day: string, count: number): string {
  const found = dayNumber(day);
  if (found === null) throw new Error(`not a day: ${day}`);
  return dayOf(found + count);
}
