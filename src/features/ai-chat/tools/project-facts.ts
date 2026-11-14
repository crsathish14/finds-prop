/**
 * The facts of a project that two tools write the same way (`search_projects` and `get_project`), so a project
 * reads the same in a list and on its own, as `home-facts.ts` does for a home. Money is only ever turned into
 * text by `src/lib/format.ts`: the model repeats that text and never formats a price itself.
 */
import { z } from "zod";
import { priceBounds } from "@/features/projects";
import { formatMonth, formatPrice } from "@/lib/format";
import type { ToolContext } from "./types";

/** The price range of a project, as numbers and as text; every field is null when the developer gave no price. */
export const projectPriceShape = {
  lowestPriceRupees: z.number().nonnegative().nullable(),
  lowestPriceText: z.string().min(1).nullable(),
  highestPriceRupees: z.number().nonnegative().nullable(),
  highestPriceText: z.string().min(1).nullable(),
};

export type ProjectPrices = {
  lowestPriceRupees: number | null;
  lowestPriceText: string | null;
  highestPriceRupees: number | null;
  highestPriceText: string | null;
};

/**
 * The prices on offer, lowest first. One price is a range whose two ends are the same. The words around the
 * numbers ("from", "to") are the model's: only the two amounts are written here, so the model composes a range
 * in the customer's own language.
 */
export function projectPrices(
  min: number | null,
  max: number | null,
  context: ToolContext,
): ProjectPrices {
  const bounds = priceBounds(min, max);
  if (bounds === null) {
    return {
      lowestPriceRupees: null,
      lowestPriceText: null,
      highestPriceRupees: null,
      highestPriceText: null,
    };
  }
  return {
    lowestPriceRupees: bounds.low,
    lowestPriceText: formatPrice(context.translate, context.locale, bounds.low),
    highestPriceRupees: bounds.high,
    highestPriceText: formatPrice(context.translate, context.locale, bounds.high),
  };
}

/** A stored day (`YYYY-MM-DD`) as "Dec 2028", the way the project page writes possession; null when it is not a day. */
export function monthText(day: string | null, context: ToolContext): string | null {
  if (day === null) return null;
  const text = formatMonth(context.locale, day);
  return text === "" ? null : text;
}
