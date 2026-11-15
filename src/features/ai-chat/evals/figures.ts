/**
 * An independent reading of the figures in an answer (AI-P8-T01, "match to tool output" and the number-grounding
 * false-positive rate). It does NOT use the output check's own code (`guards/number-grounding.ts`): it is a second,
 * simpler implementation, so that the eval can tell when the output check's shadow rule flagged an answer that was
 * in fact grounded (a false positive) or let an invented figure pass (a miss). Both read the same three kinds of
 * claim: rupee amounts, areas and bedroom counts.
 *
 * "Grounded" means: the figure appears in a tool result this turn (as a number, or in a text the tool wrote such as
 * "₹1.25 Cr", read as whole rupees), or in what the customer wrote. Nothing else counts, so a sum the model made up
 * by itself (an EMI worked out in its head) is not grounded, which is what the prompt asks for.
 */

const TAMIL_DIGIT_ZERO = 0x0be6;

function asciiDigits(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[௦-௯]/gu, (digit) =>
      String((digit.codePointAt(0) ?? TAMIL_DIGIT_ZERO) - TAMIL_DIGIT_ZERO),
    );
}

const CRORE = 10_000_000;
const LAKH = 100_000;
const THOUSAND = 1000;

function unitValue(unit: string | undefined): number {
  if (unit === undefined) return 1;
  const word = unit.toLowerCase();
  if (word.startsWith("cr") || word === "கோடி") return CRORE;
  if (word.startsWith("lakh") || word.startsWith("lac") || word === "l" || word.startsWith("லட்ச"))
    return LAKH;
  if (word === "k" || word.startsWith("thousand")) return THOUSAND;
  return 1;
}

function toNumber(text: string): number {
  return Number.parseFloat(text.replace(/,/gu, ""));
}

/** Two decimals at most, so 12.5 and 12.50 are one figure. */
function figureKey(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

const UNIT = String.raw`(crores?|cr|lakhs?|lacs?|லட்சம்|லட்ச|கோடி)`;
const SYMBOL_AMOUNT = new RegExp(
  String.raw`(?:₹|(?<![a-z])rs\.?|(?<![a-z])inr)\s*(\d[\d,]*(?:\.\d+)?)(?:\s*(crores?|cr|lakhs?|lacs?|லட்சம்|லட்ச|கோடி|l|k|thousand)(?![a-z]))?`,
  "giu",
);
const UNIT_AMOUNT = new RegExp(
  String.raw`(?<![\d.,])(\d[\d,]*(?:\.\d+)?)\s*${UNIT}(?![a-z])`,
  "giu",
);
const AREA =
  /(?<![\d.,])(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s?ft|sqft|sq\.?\s?feet|square\s+(?:feet|foot|ft)|sq\.?\s?m|sqm|cents?|acres?)(?![a-z])/giu;
const BEDROOMS = /(?<![\d.,])(\d)\s*-?\s*bhk(?![a-z])/giu;

function rupeeClaims(text: string): number[] {
  const amounts: number[] = [];
  for (const match of text.matchAll(SYMBOL_AMOUNT))
    amounts.push(Math.round(toNumber(match[1] ?? "0") * unitValue(match[2])));
  // An amount with a symbol is read once: the same text is not read again as "a number and a unit".
  for (const match of text.replace(SYMBOL_AMOUNT, " ").matchAll(UNIT_AMOUNT))
    amounts.push(Math.round(toNumber(match[1] ?? "0") * unitValue(match[2])));
  return amounts;
}

/** The figures an answer claims: rupee amounts, areas, bedroom counts, as comparison keys. */
export function claimedFigures(answer: string): string[] {
  const text = asciiDigits(answer);
  const claims: number[] = rupeeClaims(text);
  for (const match of text.matchAll(AREA)) claims.push(toNumber(match[1] ?? "0"));
  for (const match of text.matchAll(BEDROOMS)) claims.push(toNumber(match[1] ?? "0"));
  return claims.map(figureKey);
}

const ANY_NUMBER =
  /(?<![\d.,])(\d[\d,]*(?:\.\d+)?)(?:\s*(crores?|cr|lakhs?|lacs?|லட்சம்|லட்ச|கோடி)(?![a-z]))?/giu;

function addNumbersOfText(text: string, into: Set<string>): void {
  const plain = asciiDigits(text);
  for (const match of plain.matchAll(ANY_NUMBER)) {
    const value = toNumber(match[1] ?? "0");
    into.add(figureKey(value));
    if (match[2] !== undefined) into.add(figureKey(Math.round(value * unitValue(match[2]))));
  }
  // "₹56.94 L" in a text a tool wrote is 5,694,000 rupees, which the answer may state in any form.
  for (const amount of rupeeClaims(plain)) into.add(figureKey(amount));
}

function addNumbersOf(value: unknown, into: Set<string>): void {
  if (typeof value === "number") into.add(figureKey(value));
  else if (typeof value === "string") addNumbersOfText(value, into);
  else if (Array.isArray(value)) for (const item of value) addNumbersOf(item, into);
  else if (typeof value === "object" && value !== null)
    for (const item of Object.values(value)) addNumbersOf(item, into);
}

/** Every figure the turn holds: in the tool results, and in what the customer wrote. */
export function groundedFigures(
  toolOutputs: readonly unknown[],
  customerTexts: readonly string[],
): Set<string> {
  const known = new Set<string>();
  for (const output of toolOutputs) addNumbersOf(output, known);
  for (const text of customerTexts) addNumbersOfText(text, known);
  return known;
}

export interface FigureReading {
  /** How many figures the answer claims. */
  readonly claims: number;
  /** How many of them no tool result and no customer message holds. */
  readonly unsupported: number;
}

export function readFigures(
  answer: string,
  toolOutputs: readonly unknown[],
  customerTexts: readonly string[],
): FigureReading {
  const known = groundedFigures(toolOutputs, customerTexts);
  const claims = claimedFigures(answer);
  return { claims: claims.length, unsupported: claims.filter((claim) => !known.has(claim)).length };
}

/** The rupee amounts an answer states, as whole rupees: for checking that an expected price is there. */
export function rupeeAmountsIn(answer: string): number[] {
  const text = asciiDigits(answer);
  const amounts = rupeeClaims(text);
  // A whole price written out in digits ("12500000", "1,25,00,000") is the same amount.
  for (const match of text.matchAll(/(?<![\d.,])(\d[\d,]{3,})(?![\d,])/gu))
    amounts.push(toNumber(match[1] ?? "0"));
  return amounts;
}

/** Whether a plain number (an area, a count, an EMI figure) is written in the answer, with or without commas. */
export function hasNumber(answer: string, wanted: number): boolean {
  const text = asciiDigits(answer);
  for (const match of text.matchAll(/(?<![\d.,])(\d[\d,]*(?:\.\d+)?)/gu))
    if (figureKey(toNumber(match[1] ?? "0")) === figureKey(wanted)) return true;
  return false;
}
