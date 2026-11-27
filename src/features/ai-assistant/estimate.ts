import { AI_PRICES } from "@/config/web-search";

/**
 * The estimated spend of the assistant from our own records (ADR-218, piece 7): never a bill. OpenAI counts cached
 * input inside the input tokens, so the cached part is priced at its own rate and the rest at the input rate. Web
 * searches are priced per call. No OpenAI admin key is needed.
 */

export interface MonthUse {
  readonly messages: number;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly webSearches: number;
}

export type Prices = Omit<typeof AI_PRICES, "checkedOn" | "model">;

const MILLION = 1_000_000;

/** This month's estimated spend in US dollars, rounded to the cent. */
export function estimateSpendUsd(use: MonthUse, prices: Prices = AI_PRICES): number {
  const cached = Math.min(Math.max(use.cachedInputTokens, 0), Math.max(use.inputTokens, 0));
  const uncached = Math.max(use.inputTokens, 0) - cached;
  const dollars =
    (uncached * prices.inputUsdPerMillionTokens) / MILLION +
    (cached * prices.cachedInputUsdPerMillionTokens) / MILLION +
    (Math.max(use.outputTokens, 0) * prices.outputUsdPerMillionTokens) / MILLION +
    Math.max(use.webSearches, 0) * prices.webSearchUsdPerCall;
  return Math.round(dollars * 100) / 100;
}

/** The estimated credit left: what was bought less this month's spend, never below zero; null when none was typed. */
export function estimateCreditLeftUsd(creditBought: number | null, spend: number): number | null {
  if (creditBought === null) return null;
  return Math.max(0, Math.round((creditBought - spend) * 100) / 100);
}
