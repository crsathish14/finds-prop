import { indiaToday } from "@/features/projects";

/**
 * The days the assistant may prepare a site visit for (ADR-176): from today to one month ahead, India time. It is
 * stricter than the project page's own form and the database (today to a year ahead, `visitDateProblem`), on purpose
 * and for the assistant only: a customer who wants a later day uses the project page.
 */
export const AI_VISIT_MONTHS_AHEAD = 1;

/** A `YYYY-MM-DD` day moved by whole months; a day that does not exist in the later month gives that month's last day. */
export function addMonths(day: string, months: number): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date, lastDay));
  return target.toISOString().slice(0, 10);
}

/** The first and last day the assistant may prepare a visit for, as `YYYY-MM-DD`. */
export function aiVisitWindow(now: Date): { min: string; max: string } {
  const today = indiaToday(now);
  return { min: today, max: addMonths(today, AI_VISIT_MONTHS_AHEAD) };
}

/** True when the day (already known to be a real day inside the shared rule) is also inside the assistant's month. */
export function withinAiVisitWindow(day: string, now: Date): boolean {
  const { min, max } = aiVisitWindow(now);
  return day >= min && day <= max;
}
