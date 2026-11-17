import "server-only";
import { after } from "next/server";
import { getSiteSettings } from "@/features/site";
import { writePlacesUsage } from "@/server/audit/places-usage";
import { env } from "@/server/env";
import { choosePlaceProvider, createCountedPlaceProvider, type PlaceBounds } from "@/server/places";
import { createPlaceLookup } from "./place-lookup";
import { getLocalityCounts } from "./queries";
import type { PlaceLookup } from "./tools/place-lookup";

/**
 * The real place lookup of the AI chat (ADR-142): `createPlaceLookup` over the provider of this environment (Ola Maps with
 * a key, the fixed list on local and dev without one, "off" otherwise), the region from the site settings and the
 * localities that have listings. Each call that reaches the real provider is counted for the admin dashboard under
 * the caller `ai_chat` (ADR-134), after the answer, and never changes it.
 */

/** The usage write of one lookup, after the answer; outside a request `after` throws and the write runs unwatched. */
function scheduleCount(outcome: Parameters<typeof writePlacesUsage>[0]["outcome"]): void {
  const record = { api: "autocomplete", caller: "ai_chat", outcome } as const;
  try {
    after(() => writePlacesUsage(record));
  } catch {
    void writePlacesUsage(record);
  }
}

/** The lookup for this environment: the real provider with the region from the site settings, counted. */
export function createRealPlaceLookup(): PlaceLookup {
  // Only the real provider is counted: the fixed local list and the "off" provider never reach Ola Maps.
  const reachesOla = Boolean(env.OLA_MAPS_API_KEY) && !env.PLACES_DISABLED;
  return createPlaceLookup({
    provider: async () => {
      const settings = await getSiteSettings();
      const bounds: PlaceBounds = settings.region.bounds;
      const provider = choosePlaceProvider(env, bounds);
      return reachesOla ? createCountedPlaceProvider(provider, scheduleCount) : provider;
    },
    localities: async () => (await getLocalityCounts()).localities,
  });
}
