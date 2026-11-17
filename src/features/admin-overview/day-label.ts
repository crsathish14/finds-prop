/**
 * How the admin's Overview page writes a day (S7-T06 part 3, and the place search card's days, PR 6b). Pure, so the
 * Overview island and the place search card's mapping say "1 Oct" and "1 Oct 2026" in exactly the same way.
 */

const INTL_LOCALES: Record<string, string> = { en: "en-IN" };

/** The browser's name for a language of the site (Indian English for now). */
export const intlLocale = (locale: string) => INTL_LOCALES[locale] ?? "en-IN";

/** A day (`YYYY-MM-DD`) as "1 Oct" (and "1 Oct 2026" with the year); the day is a calendar day, so no time zone moves it. */
export function dayLabel(day: string, locale: string, withYear: boolean): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(date);
}
