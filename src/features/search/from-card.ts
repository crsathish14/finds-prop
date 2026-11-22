import { RADIUS_MAX_KM, RADIUS_MIN_KM, type SearchParams } from "./schemas";

/** A place the site's content team curated (the homepage localities in the site settings, DEC-13). */
export type CuratedLocality = { label: string; lat: number; lng: number; radiusKm: number };

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
