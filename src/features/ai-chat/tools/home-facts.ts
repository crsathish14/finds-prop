/**
 * The facts of a home that two tools write the same way (`search_properties` and `get_property`), so a home
 * reads the same in a list and on its own. Money is only ever turned into text by `src/lib/format.ts`
 * (ADR-128 section 4.1, principle 2): the model repeats that text and never formats a price itself.
 */
import { PROPERTY_TYPES, type PropertyType } from "@/config/search-options";
import { formatListedAgo, formatPrice, formatRent } from "@/lib/format";
import type { ToolContext } from "./types";

/** For sale or to rent, as the database names them. */
export const LISTING_TYPES = ["sale", "rent"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

/** The labels a home can carry (BR-92). */
export const HOME_LABELS = ["featured", "prime", "budget"] as const;

/** The price as the pages write it: "₹1.25 Cr" for a sale, "₹25,000/mo" for a rent. */
export function homePriceText(
  listingType: ListingType,
  rupees: number,
  context: ToolContext,
): string {
  return listingType === "rent"
    ? formatRent(context.translate, context.locale, rupees)
    : formatPrice(context.translate, context.locale, rupees);
}

/** "3 days ago", as the cards say it; null when the age is not known. */
export function listedAgoText(ageDays: number | null, context: ToolContext): string | null {
  return ageDays === null ? null : formatListedAgo(context.translate, ageDays);
}

/** The kind of property when this site knows it; a kind it does not know is no kind, as on the cards. */
export function knownPropertyType(value: string): PropertyType | null {
  return PROPERTY_TYPES.find((known) => known === value) ?? null;
}

/** Bedrooms when there are some to count: a plot, a commercial property and "0" have none, as on the page. */
export function countedBedrooms(bedrooms: number | null): number | null {
  return bedrooms !== null && bedrooms > 0 ? bedrooms : null;
}
