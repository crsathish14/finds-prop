import type { Database } from "@/types/database.types";
import { DEFAULT_RADIUS_KM, type SearchParams } from "./schemas";

export type SearchRpcArgs = Database["public"]["Functions"]["search_properties"]["Args"];

/**
 * The arguments `search_properties()` takes for a parsed search (ADR-012, ADR-042). Only what the
 * visitor chose is sent: the function has its own defaults, and it checks every range itself, so a
 * value that got past the address rules is checked twice. The radius travels only with a place
 * (a radius alone means nothing), and `show` is the number of homes wanted (`p_limit`), because
 * "Show more" asks again for a longer list. The place's label is for display and is never sent.
 */
export function toSearchRpcArgs(params: SearchParams): SearchRpcArgs {
  const hasPlace = params.lat !== undefined && params.lng !== undefined;
  return {
    ...(params.listingType === undefined ? {} : { p_listing_type: params.listingType }),
    ...(params.propertyType === undefined ? {} : { p_property_type: params.propertyType }),
    ...(params.bhk === undefined ? {} : { p_bhk: params.bhk }),
    ...(params.minPrice === undefined ? {} : { p_min_price: params.minPrice }),
    ...(params.maxPrice === undefined ? {} : { p_max_price: params.maxPrice }),
    ...(params.locality === undefined ? {} : { p_locality: params.locality }),
    ...(hasPlace
      ? {
          p_lat: params.lat,
          p_lng: params.lng,
          p_radius_km: params.radiusKm ?? DEFAULT_RADIUS_KM,
        }
      : {}),
    ...(params.keyword === undefined ? {} : { p_q: params.keyword }),
    ...(params.label === undefined ? {} : { p_label: params.label }),
    p_sort: params.sort,
    p_limit: params.show,
  };
}
