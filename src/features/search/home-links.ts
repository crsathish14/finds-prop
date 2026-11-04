import { buildSearchHref } from "./params";
import { placeParams, type CuratedLocality } from "./from-card";

/** How many curated localities become Popular chips (the first four, ADD-11). */
export const POPULAR_COUNT = 4;

export type SearchLink = { label: string; href: string };

/**
 * The Popular chips of the search card: the first localities of the curated list, each a link to the
 * homes around that place. They carry no Buy or Rent, since a chip is not part of the card's choice.
 */
export function popularLinks(
  curated: readonly CuratedLocality[],
  count: number = POPULAR_COUNT,
): SearchLink[] {
  return curated.slice(0, count).map((place) => ({
    label: place.label,
    href: buildSearchHref(placeParams(place)),
  }));
}

/** The two Quick picks of the search card: three-bedroom homes, and homes labelled Budget. */
export function quickPickLinks(): { bedrooms: string; budget: string } {
  return {
    bedrooms: buildSearchHref({ bhk: 3 }),
    budget: buildSearchHref({ label: "budget" }),
  };
}

/** The curated localities that match what a visitor has typed so far, in the list's order. */
export function matchLocalities(
  curated: readonly CuratedLocality[],
  query: string,
): CuratedLocality[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...curated];
  return curated.filter((place) => place.label.toLowerCase().includes(needle));
}
