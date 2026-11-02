import "server-only";
import { env } from "@/server/env";

/** The feature flags (R-FE-17). All are off unless the environment turns them on. */
export interface FeatureFlags {
  aiSearch: boolean;
  mapView: boolean;
  pgListings: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    aiSearch: env.FLAG_AI_SEARCH,
    mapView: env.FLAG_MAP_VIEW,
    pgListings: env.FLAG_PG_LISTINGS,
  };
}
