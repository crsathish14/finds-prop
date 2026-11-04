import type { PropertyType } from "@/config/search-options";
import { buildSearchHref } from "./params";
import { RADIUS_MAX_KM, RADIUS_MIN_KM, type SearchParams } from "./schemas";

/** A place the site's content team curated (the homepage localities in the site settings, DEC-13). */
export type CuratedLocality = { label: string; lat: number; lng: number; radiusKm: number };

/** What the search card hands over when Search is pressed (the card knows nothing about addresses). */
export type CardSearch = {
  intent: "buy" | "rent";
  locality: string;
  propertyType: PropertyType | null;
  bedrooms: number | null;
  maxBudget: number | null;
};

/** Looking to: Buy is `sale`, Rent is `rent`, and All is no filter at all (both are searched). */
export function listingTypeFor(intent: "all" | "buy" | "rent"): "sale" | "rent" | undefined {
  if (intent === "buy") return "sale";
  if (intent === "rent") return "rent";
  return undefined;
}

/** A curated locality as a search: its place, its coordinates and its radius (kept within what a search accepts). */
export function placeParams(locality: CuratedLocality): Partial<SearchParams> {
  return {
    place: locality.label,
    lat: locality.lat,
    lng: locality.lng,
    radiusKm: Math.min(RADIUS_MAX_KM, Math.max(RADIUS_MIN_KM, locality.radiusKm)),
  };
}

/**
 * The search a card's values mean. Text that is one of the curated localities (however it is
 * written in capitals) is that place, searched by coordinates and radius; any other text is a
 * `locality` text match. Buy or Rent is always chosen on the card, so `listingType` is always set; the
 * other filters are written only when chosen, so a card with nothing else chosen searches all
 * homes to buy (or all to rent).
 */
export function searchParamsFromCard(
  values: CardSearch,
  curated: readonly CuratedLocality[] = [],
): Partial<SearchParams> {
  const text = values.locality.trim();
  const picked =
    text === ""
      ? undefined
      : curated.find((place) => place.label.toLowerCase() === text.toLowerCase());
  const params: Partial<SearchParams> = { listingType: values.intent === "rent" ? "rent" : "sale" };
  if (picked) Object.assign(params, placeParams(picked));
  else if (text !== "") params.locality = text;
  if (values.propertyType !== null) params.propertyType = values.propertyType;
  if (values.bedrooms !== null) params.bhk = values.bedrooms;
  if (values.maxBudget !== null) params.maxPrice = values.maxBudget;
  return params;
}

/** The address a card's Search goes to. */
export function searchHrefFromCard(
  values: CardSearch,
  curated: readonly CuratedLocality[] = [],
): string {
  return buildSearchHref(searchParamsFromCard(values, curated));
}
