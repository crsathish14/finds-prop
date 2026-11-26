/**
 * The facts of a project that two tools write the same way (`search_projects` and `get_project`), so a project
 * reads the same in a list and on its own, as `home-facts.ts` does for a home. Money is only ever turned into
 * text by `src/lib/format.ts`: the model repeats that text and never formats a price itself.
 */
import { z } from "zod";
import { OFFER_TYPES, priceOf, PRICE_TYPES, type PriceType } from "@/features/projects";
import { formatMonth, formatPrice } from "@/lib/format";
import { isPrimeProject, type ProjectPrimeRules } from "@/lib/project-prime";
import type { ToolContext } from "./types";

/**
 * The one price of a project (ADR-148), as a number and as text, with what it means. Every field is null when the
 * developer gave no price. `priceType` says whether the price is a rate per sq ft, a basic price (without
 * registration, GST and other costs), an all inclusive price, or a rent; `offerType` says whether a commercial
 * project is for sale or for rent.
 */
export const projectPriceShape = {
  priceRupees: z.number().nonnegative().nullable(),
  priceText: z.string().min(1).nullable(),
  priceType: z.enum(PRICE_TYPES).nullable(),
  offerType: z.enum(OFFER_TYPES).nullable(),
  /** True when the price is at or above the Prime amount the admin set for its price type (ADR-208). */
  prime: z.boolean(),
};

export type ProjectPrices = {
  priceRupees: number | null;
  priceText: string | null;
  priceType: PriceType | null;
  offerType: "sale" | "rent" | null;
  prime: boolean;
};

const PRICE_TYPE_WORDS = {
  per_sqft: "domain.projectCard.priceType.perSqft",
  basic: "domain.projectCard.priceType.basic",
  all_inclusive: "domain.projectCard.priceType.allInclusive",
  rent_per_month: "domain.projectCard.priceType.rentPerMonth",
  rent_per_sqft_month: "domain.projectCard.priceType.rentPerSqftMonth",
} as const satisfies Record<PriceType, string>;

/**
 * The price as text the way the project page writes it ("₹8,500 per sq ft", "₹85 L basic price"): only this text is
 * quoted, so the model never formats money or words the meaning itself. `prime` comes from the admin's current Prime
 * amounts (ADR-208); it is a fact about the project, never a reason it ranks higher.
 */
export function projectPrices(
  project: {
    price: number | null;
    priceType: PriceType | null;
    offerType: "sale" | "rent" | null;
  },
  context: ToolContext,
  primeRules: ProjectPrimeRules,
): ProjectPrices {
  const price = priceOf(project);
  if (price === null) {
    return {
      priceRupees: null,
      priceText: null,
      priceType: null,
      offerType: project.offerType,
      prime: false,
    };
  }
  const amount = formatPrice(context.translate, context.locale, price.rupees);
  return {
    priceRupees: price.rupees,
    priceText:
      price.type === null
        ? amount
        : context.translate(PRICE_TYPE_WORDS[price.type], { price: amount }),
    priceType: price.type,
    offerType: project.offerType,
    prime: isPrimeProject(primeRules, { price: price.rupees, priceType: price.type }),
  };
}

/**
 * True when the price is a total that can be compared with what a customer will pay: a basic price or an all
 * inclusive one. A rate per sq ft and a rent are not totals, so a search by the most a customer will pay leaves them out.
 */
export function isTotalPrice(type: PriceType | null): boolean {
  return type === "basic" || type === "all_inclusive";
}

/** A stored day (`YYYY-MM-DD`) as "Dec 2028", the way the project page writes possession; null when it is not a day. */
export function monthText(day: string | null, context: ToolContext): string | null {
  if (day === null) return null;
  const text = formatMonth(context.locale, day);
  return text === "" ? null : text;
}
