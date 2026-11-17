import { connection } from "next/server";
import { getSiteSettings } from "@/features/site";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { reportError } from "@/server/observability";
import { choosePlaceProvider, handlePlaceAutocomplete } from "@/server/places";
import { enforceActionRateLimit } from "@/server/rate-limit/rate-limit";
import { readRequestId } from "@/server/request-id";

/**
 * `GET /api/places/autocomplete?q=`: place suggestions for the search box (ADR-133, FR-GEO-01). Public and read-only,
 * so it needs no session and no signature; it is limited per visitor and per address instead. It composes only: the
 * steps and every rule are in `server/places/autocomplete-handler.ts`. The region comes from the site settings, read
 * here because the server layer never imports a feature. GET only (the framework answers 405 to any other method).
 */
export async function GET(request: Request) {
  await connection();
  const requestId = readRequestId(request.headers) ?? crypto.randomUUID();
  return handlePlaceAutocomplete(request, {
    requestId,
    enforceLimits: () => enforceActionRateLimit({ scope: "places", session: null, requestId }),
    getProvider: async () => {
      const settings = await getSiteSettings();
      return choosePlaceProvider(env, settings.region.bounds);
    },
    log: logger.child({ requestId, route: "places-autocomplete" }),
    reportError: (error, context) => reportError(error, { ...context, requestId }),
  });
}
