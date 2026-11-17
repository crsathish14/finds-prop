import "server-only";
import { after } from "next/server";
import { getSiteSettings } from "@/features/site";
import { writePlacesUsage } from "@/server/audit/places-usage";
import { env } from "@/server/env";
import {
  choosePlaceProvider,
  createCountedPlaceProvider,
  PlaceLookupError,
  type PlaceBounds,
  type PlaceProvider,
} from "@/server/places";
import { RateLimitedError } from "@/server/rate-limit/enforce";
import { enforceActionRateLimit } from "@/server/rate-limit/rate-limit";
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

/**
 * The same provider behind the `places` limit of the search box's route (60 a minute per visitor and 30 in 10 seconds
 * per address, ADR-133), so the chat cannot spend more of the map quota than the box can. A lookup the limit refuses never
 * reaches the provider (it is not counted as a call) and, like a failure of the counter itself (fail closed), reaches the
 * assistant as "unavailable". `enforce` is the limit, handed in so a test needs no database.
 */
export function withPlacesLimit(
  provider: PlaceProvider,
  enforce: () => Promise<void>,
): PlaceProvider {
  return {
    async autocomplete(text) {
      try {
        await enforce();
      } catch (failure) {
        throw failure instanceof RateLimitedError
          ? new PlaceLookupError("quota", "The place search limit was reached")
          : new PlaceLookupError("error", "The place search limit could not be checked");
      }
      return provider.autocomplete(text);
    },
  };
}

/** The lookup for this environment: the real provider with the region from the site settings, limited like the search box, counted. */
export function createRealPlaceLookup(): PlaceLookup {
  // Only the real provider is counted: the fixed local list and the "off" provider never reach Ola Maps.
  const reachesOla = Boolean(env.OLA_MAPS_API_KEY) && !env.PLACES_DISABLED;
  return createPlaceLookup({
    provider: async () => {
      const settings = await getSiteSettings();
      const bounds: PlaceBounds = settings.region.bounds;
      const provider = choosePlaceProvider(env, bounds);
      const counted = reachesOla ? createCountedPlaceProvider(provider, scheduleCount) : provider;
      return withPlacesLimit(counted, () =>
        enforceActionRateLimit({ scope: "places", session: null, requestId: crypto.randomUUID() }),
      );
    },
    localities: async () => (await getLocalityCounts()).localities,
  });
}
