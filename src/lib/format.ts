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
export function formatPrice(t: Translate, locale: string, rupees: number): string {
  if (rupees >= CRORE) {
    return t("format.crore", { value: number(locale, rupees / CRORE, 2) });
  }
  if (rupees >= LAKH) {
    const lakh = Math.round((rupees / LAKH) * 100) / 100;
    // 99,99,999 rounds to 100 L, which reads as 1 Cr.
    if (lakh >= 100) return t("format.crore", { value: number(locale, rupees / CRORE, 2) });
    return t("format.lakh", { value: number(locale, lakh, 2) });
  }
  return t("format.rupees", { value: number(locale, rupees) });
}

export function formatRent(t: Translate, locale: string, rupees: number): string {
  return t("format.rentShort", { price: formatPrice(t, locale, rupees) });
}

/** Price per square foot, shown for sale listings only. */
export function formatPerSqft(t: Translate, locale: string, rupees: number): string {
  return t("format.perSqft", { price: t("format.rupees", { value: number(locale, rupees) }) });
}

export function formatArea(t: Translate, locale: string, sqft: number): string {
  return t("format.area", { value: number(locale, sqft) });
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
