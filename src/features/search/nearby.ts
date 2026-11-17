import { DISTANCE_SORT } from "@/config/search-options";
import type { ListingRow } from "./listing-row";
import { hasSearchPlace } from "./params";
import { DEFAULT_SHOW, SHOW_STEP, type SearchParams } from "./schemas";

/**
 * "Also near": the homes a little further out, shown under a place search that found only a few homes
 * (ADR-137, OLA_MAPS_PLAN.md D5). Pure rules, so they are tested without a page.
 */

/** A place search that finds fewer homes than this in its circle also looks further out. */
export const NEARBY_THRESHOLD = 6;

/** How far out the extra homes are looked for, in kilometres. */
export const NEARBY_RADIUS_KM = 15;

/** The most homes the extra section holds. */
export const NEARBY_LIMIT = 12;

/**
 * How many homes the wider read asks for: the section's limit plus the homes already in the main list
 * (fewer than the threshold), so removing those still leaves a full section. A multiple of the step the
 * address uses, which the function accepts.
 */
export const NEARBY_READ_SHOW =
  Math.ceil((NEARBY_LIMIT + NEARBY_THRESHOLD) / SHOW_STEP) * SHOW_STEP;

/**
 * True when the page should look further out: a place was searched, the chosen circle is smaller than
 * the wide one, and the circle holds fewer than the threshold of homes (`total` is the function's own
 * count, the same number the headline shows).
 */
export function wantsNearby(
  params: SearchParams,
  total: number,
  threshold: number = NEARBY_THRESHOLD,
): boolean {
  if (!hasSearchPlace(params)) return false;
  if ((params.radiusKm ?? 0) >= NEARBY_RADIUS_KM) return false;
  return total < threshold;
}

/**
 * The same filters in the wide circle, nearest first, as one page long enough for the section. The
 * keyword, the kind, the price and the rest are kept; the label of the place and the radius are not
 * the visitor's choice here, so the wide circle replaces the radius.
 */
export function nearbySearchParams(params: SearchParams): SearchParams {
  return {
    ...params,
    radiusKm: NEARBY_RADIUS_KM,
    sort: DISTANCE_SORT,
    show: Math.max(DEFAULT_SHOW, NEARBY_READ_SHOW),
  };
}

/**
 * The homes the section shows: the wide circle's homes without those already in the main list, in the
 * order they came (nearest first), at most `limit`. Nothing when the main list already has enough
 * homes or when the chosen circle already is the wide one.
 */
export function nearbyHomesToShow(input: {
  main: readonly ListingRow[];
  wide: readonly ListingRow[];
  radiusKm: number;
  threshold?: number;
  limit?: number;
}): ListingRow[] {
  const { main, wide, radiusKm, threshold = NEARBY_THRESHOLD, limit = NEARBY_LIMIT } = input;
  if (radiusKm >= NEARBY_RADIUS_KM || main.length >= threshold) return [];
  const known = new Set(main.map((home) => home.short_id));
  const extra: ListingRow[] = [];
  for (const home of wide) {
    if (known.has(home.short_id)) continue;
    known.add(home.short_id);
    extra.push(home);
    if (extra.length === limit) break;
  }
  return extra;
}
