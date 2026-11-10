import type { CSSProperties } from "react";

/**
 * The small numbers behind the charts (S7-T06): which tick marks a scale gets, which x labels are shown, the colour of
 * a series and how a count is written. Pure, so each is tested without a screen.
 */

/** The four series colours, in the fixed order of the design system (`--c-series-1` to `-4`). */
export type SeriesSlot = 1 | 2 | 3 | 4;

/** The colour of a series. It follows the entity, never its rank: a chart that loses a series does not repaint the rest. */
export const seriesColor = (slot: SeriesSlot | "other"): string => `var(--c-series-${slot})`;

/**
 * The colour of a mark as a style: the colour is set as a custom property and the mark's class reads it
 * (`bg-(--series)`), so the colour stays a token (`var(--c-series-n)`) and not a value written into the style.
 */
export const seriesStyle = (slot: SeriesSlot | "other"): CSSProperties =>
  ({ "--series": seriesColor(slot) }) as CSSProperties;

/**
 * Tick marks for a count scale that starts at 0: about four steps, each a round number, the last at or above `max`
 * (87 gives 0, 25, 50, 75, 100). A count scale never has a fraction, so a step below 1 does not happen; a chart with
 * no numbers above 0 still gets 0 and 1.
 */
export function niceTicks(max: number): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const choices = [1, 2, 2.5, 5, 10];
  let step = Math.max(1, magnitude * 10);
  for (const choice of choices) {
    const candidate = choice * magnitude;
    if (candidate >= rough && Number.isInteger(candidate) && candidate >= 1) {
      step = candidate;
      break;
    }
  }
  const ticks: number[] = [];
  for (let value = 0; ; value += step) {
    ticks.push(value);
    if (value >= max) break;
  }
  return ticks;
}

/** Every how-manyth label to show so that about `fit` labels are drawn along an axis of `count` points. */
export function labelEvery(count: number, fit: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, fit)));
}

/** The locale numbers are written in: English is written the Indian way (1,28,400), as the rest of the admin is. */
export const chartLocale = (locale: string): string => (locale === "en" ? "en-IN" : locale);

export function formatCount(locale: string, value: number): string {
  return new Intl.NumberFormat(chartLocale(locale)).format(value);
}

export function formatPercent(locale: string, share: number): string {
  return new Intl.NumberFormat(chartLocale(locale), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(share);
}

/**
 * Moves end labels apart so that two series that finish at nearly the same height do not print over each other. The
 * labels keep their order from top to bottom; each is at least `gap` below the one above it.
 */
export function spreadLabels(positions: readonly number[], gap: number): number[] {
  const order = positions
    .map((place, index) => ({ place, index }))
    .sort((first, second) => first.place - second.place);
  const result = [...positions];
  let last = Number.NEGATIVE_INFINITY;
  for (const { place, index } of order) {
    const placed = Math.max(place, last + gap);
    result[index] = placed;
    last = placed;
  }
  return result;
}
