/**
 * The only place prices, areas and dates are formatted (R-FE-23, ADR-035). Numbers and dates
 * follow the language through Intl; the words around them (₹, L, Cr, /mo, sq.ft) come from
 * en.json through the translator, so another language can reorder or replace them.
 * Money is stored as integer rupees.
 */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Language to Intl locale. English uses Indian digit grouping (1,25,00,000). */
const INTL_LOCALES: Record<string, string> = { en: "en-IN" };
const TIME_ZONE = "Asia/Kolkata";

const LAKH = 100_000;
const CRORE = 10_000_000;

function intlLocale(locale: string): string {
  return INTL_LOCALES[locale] ?? "en-IN";
}

function number(locale: string, value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits }).format(value);
}

/** 78 L, 1.5 Cr, 1.25 Cr (at most two decimals, trailing zeros dropped), or plain rupees below 1 L. */
export function formatPrice(translate: Translate, locale: string, rupees: number): string {
  if (rupees >= CRORE) {
    return translate("format.crore", { value: number(locale, rupees / CRORE, 2) });
  }
  if (rupees >= LAKH) {
    const lakh = Math.round((rupees / LAKH) * 100) / 100;
    // 99,99,999 rounds to 100 L, which reads as 1 Cr.
    if (lakh >= 100) return translate("format.crore", { value: number(locale, rupees / CRORE, 2) });
    return translate("format.lakh", { value: number(locale, lakh, 2) });
  }
  return translate("format.rupees", { value: number(locale, rupees) });
}

export function formatRent(translate: Translate, locale: string, rupees: number): string {
  return translate("format.rentShort", { price: formatPrice(translate, locale, rupees) });
}

/** Price per square foot, shown for sale listings only. */
export function formatPerSqft(translate: Translate, locale: string, rupees: number): string {
  return translate("format.perSqft", {
    price: translate("format.rupees", { value: number(locale, rupees) }),
  });
}

export function formatArea(translate: Translate, locale: string, sqft: number): string {
  return translate("format.area", { value: number(locale, sqft) });
}

/** The calendar year in India right now, for a copyright line. */
export function calendarYear(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en", { year: "numeric", timeZone: TIME_ZONE }).format(date),
  );
}

/** Dates are stored in UTC and shown in India time. */
export function formatDate(
  locale: string,
  date: Date | string,
  dateStyle: "short" | "medium" | "long" = "medium",
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle, timeZone: TIME_ZONE }).format(
    typeof date === "string" ? new Date(date) : date,
  );
}

const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

/**
 * How long ago a listing went live, as the cards say it: "Today", "3 days ago" up to 29 days, then
 * months and years. The age is whole days; a date in the future (a clock a little ahead) is
 * "Today".
 */
export function formatListedAgo(translate: Translate, ageDays: number): string {
  const days = Math.floor(ageDays);
  if (days < 1) return translate("format.today");
  if (days < DAYS_PER_MONTH) return translate("format.daysAgo", { count: days });
  if (days < DAYS_PER_YEAR) {
    return translate("format.monthsAgo", { count: Math.floor(days / DAYS_PER_MONTH) });
  }
  return translate("format.yearsAgo", { count: Math.floor(days / DAYS_PER_YEAR) });
}
