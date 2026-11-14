/**
 * Number grounding, one rule of the output check (ADR-128 section 6.4.2): a rupee amount, an area or a bedroom
 * count the assistant states about a home must be one this turn's tool results hold, or one the customer wrote
 * themselves. Rupee amounts are normalised to whole rupees (lakh and crore forms), so "₹1.25 Cr" and "1.25 crore"
 * and 12500000 are the same figure.
 *
 * The rule runs in shadow mode first: the output check counts the figures that are not grounded and logs the count,
 * and changes nothing, until the offline evals show a false-positive rate that is acceptable (then it is enforced).
 * Dates are not checked yet. Pure functions; the figures themselves are never returned beyond the set the caller
 * built from its own evidence, and never logged.
 */

const TAMIL_DIGIT_ZERO = 0x0be6;

/** Tamil digits written as 0 to 9, so a figure in Tamil digits is read like any other. */
export function withAsciiDigits(text: string): string {
  return text.replace(/[௦-௯]/g, (digit) =>
    String((digit.codePointAt(0) ?? TAMIL_DIGIT_ZERO) - TAMIL_DIGIT_ZERO),
  );
}

/** A number as written, with Indian or western grouping ("48,50,000", "1,250") and an optional decimal part. */
const NUMBER = String.raw`(\d+(?:,\d{2,3})*(?:\.\d+)?)`;

const LATIN_UNIT = String.raw`(crores?|cr|lakhs?|lacs?)(?![a-z])`;
const TAMIL_UNIT = String.raw`(லட்சம்|லட்சத்து|லட்ச|கோடி)`;
const ANY_UNIT = `(?:${LATIN_UNIT}|${TAMIL_UNIT})`;

/** ₹ 85 L, rs. 1.25 cr, ₹25,000: a symbol, a number and maybe a unit. Lower case text only. */
const AMOUNT_WITH_SYMBOL = new RegExp(
  String.raw`(?:₹|(?<![\p{L}])(?:rs\.?|inr))\s*${NUMBER}(?:\s*(?:${LATIN_UNIT}|${TAMIL_UNIT}|(l|k)(?![a-z])|(thousand)(?![a-z])))?`,
  "gu",
);

/** 80 lakh, 1.2 crore: a number and a unit, no symbol. */
const AMOUNT_WITH_UNIT = new RegExp(String.raw`(?<![\p{L}\p{N}.,])${NUMBER}\s*${ANY_UNIT}`, "gu");

const AREA = new RegExp(
  String.raw`(?<![\p{L}\p{N}.,])${NUMBER}\s*(?:sq\.?\s?ft|sqft|sq\.?\s?feet|square\s+(?:feet|foot|ft)|sq\.?\s?m|sqm|square\s+met(?:er|re)s?|cents?|acres?)(?![a-z])`,
  "gu",
);

const BEDROOMS = /(?<![\p{L}\p{N}.,])(\d)\s*-?\s*bhk(?![a-z])/gu;

const PLAIN_NUMBER = new RegExp(String.raw`(?<![\p{L}\p{N}])${NUMBER}`, "gu");

const CRORE = 10_000_000;
const LAKH = 100_000;
const THOUSAND = 1000;

/** What each written unit is worth in rupees. */
const MULTIPLIERS = new Map<string, number>([
  ["crore", CRORE],
  ["crores", CRORE],
  ["cr", CRORE],
  ["கோடி", CRORE],
  ["lakh", LAKH],
  ["lakhs", LAKH],
  ["lac", LAKH],
  ["lacs", LAKH],
  ["l", LAKH],
  ["லட்சம்", LAKH],
  ["லட்சத்து", LAKH],
  ["லட்ச", LAKH],
  ["thousand", THOUSAND],
  ["k", THOUSAND],
]);

function parseNumber(written: string): number {
  return Number.parseFloat(written.replace(/,/g, ""));
}

/** The key a figure is compared by: two decimals at most, so 12.5 and 12.50 are the same. */
function figureKey(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

function rupeesOf(written: string, unit: string | undefined): number {
  const multiplier = unit === undefined ? 1 : (MULTIPLIERS.get(unit) ?? 1);
  return Math.round(parseNumber(written) * multiplier);
}

/** The rupee amounts in a text, as whole rupees. The text must be lower case with digits written 0 to 9. */
function rupeeAmounts(text: string): number[] {
  const amounts: number[] = [];
  for (const match of text.matchAll(AMOUNT_WITH_SYMBOL)) {
    const unit = match.slice(2).find((group) => group !== undefined);
    amounts.push(rupeesOf(match[1] ?? "0", unit));
  }
  for (const match of text.matchAll(AMOUNT_WITH_UNIT)) {
    const unit = match.slice(2).find((group) => group !== undefined);
    amounts.push(rupeesOf(match[1] ?? "0", unit));
  }
  return amounts;
}

function areas(text: string): number[] {
  return [...text.matchAll(AREA)].map((match) => parseNumber(match[1] ?? "0"));
}

function bedroomCounts(text: string): number[] {
  return [...text.matchAll(BEDROOMS)].map((match) => parseNumber(match[1] ?? "0"));
}

/** Every number a text holds, plain ones and rupee amounts, as comparison keys. */
export function groundingFigures(text: string): Set<string> {
  const prepared = withAsciiDigits(text.normalize("NFKC")).toLowerCase();
  const figures = new Set<string>();
  for (const match of prepared.matchAll(PLAIN_NUMBER)) {
    figures.add(figureKey(parseNumber(match[1] ?? "0")));
  }
  for (const amount of rupeeAmounts(prepared)) figures.add(figureKey(amount));
  return figures;
}

/**
 * How many figures in the segment (rupee amounts, areas, bedroom counts) are in none of the grounded sets. The
 * segment must already be lower case with digits written 0 to 9.
 */
export function countUngroundedFigures(segment: string, grounded: ReadonlySet<string>): number {
  const claims = [...rupeeAmounts(segment), ...areas(segment), ...bedroomCounts(segment)];
  return claims.filter((claim) => !grounded.has(figureKey(claim))).length;
}
