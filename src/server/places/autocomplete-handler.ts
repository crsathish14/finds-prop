import { z } from "zod";
import type {
  PlaceAutocompleteFailure,
  PlaceAutocompleteResult,
  PlaceAutocompleteSuggestion,
} from "@/types/places";
import { RateLimitedError } from "../rate-limit/enforce";
import type { Logger } from "../logger";
import type { ErrorContext } from "../observability";
import {
  PLACE_TEXT_MAX_CHARACTERS,
  PLACE_TEXT_MIN_CHARACTERS,
  PlaceLookupError,
  type PlaceProvider,
  type PlaceSuggestion,
} from "./types";

/**
 * `GET /api/places/autocomplete?q=` (ADR-133, FR-GEO-01). The browser's only way to ask for place suggestions: it never
 * sees the key and never calls the provider. The steps run in a fixed order, the same as `defineAction` where they apply:
 *
 *   1 parse `q` (400)   2 rate limit (429)   3 provider and region   4 look up   5 answer
 *
 * Every answer is JSON in the `ActionResult` envelope with `Cache-Control: no-store` (what a visitor typed must never
 * be cached by a browser, a proxy or the CDN). The typed text, the place names and the provider's request address (it
 * holds the key) are never logged or put in an error (R-BE-10): a line says only that a lookup failed and how.
 */

const ROUTE = "places-autocomplete";

/** What the error tracker is told about this handler (ADR-130). */
const ERROR_CONTEXT = { source: "handler", route: ROUTE } as const;

const CONTROL_CHARACTER = /[\p{Cc}\p{Zl}\p{Zp}]/u;

/**
 * The typed text: no control character (a line break, a tab, a null byte), then trimmed, then three to 80 characters
 * counted as a person counts them (not as UTF-16 units). The same bounds the adapter and `resolvePlace` keep.
 */
const autocompleteQuery = z
  .string()
  .refine((text) => !CONTROL_CHARACTER.test(text))
  .transform((text) => text.trim())
  .refine((text) => {
    const length = Array.from(text).length;
    return length >= PLACE_TEXT_MIN_CHARACTERS && length <= PLACE_TEXT_MAX_CHARACTERS;
  });

export interface PlaceAutocompleteDeps {
  requestId: string;
  /** Counts this call against the `places` limits. Throws `RateLimitedError` when one is used up (fail closed). */
  enforceLimits(): Promise<void>;
  /** The provider for this environment, with the region from the site settings (`choosePlaceProvider`). */
  getProvider(): Promise<PlaceProvider> | PlaceProvider;
  log: Logger;
  /** Sends an unexpected error to the error tracker (ADR-130). Optional: tests have none. */
  reportError?(error: unknown, context: ErrorContext): Promise<void>;
}

const NO_STORE = "no-store";

function json(
  body: PlaceAutocompleteResult,
  status: number,
  requestId: string,
  retryAfter?: number,
) {
  const headers: Record<string, string> = { "Cache-Control": NO_STORE, "x-request-id": requestId };
  if (retryAfter !== undefined) headers["Retry-After"] = String(retryAfter);
  return Response.json(body, { status, headers });
}

function failure(
  status: number,
  requestId: string,
  fields: Omit<PlaceAutocompleteFailure, "ok" | "requestId">,
): Response {
  return json({ ok: false, requestId, ...fields }, status, requestId, fields.retryAfter);
}

/** Only the six fields the box needs: nothing else the provider sent can reach the browser. */
function toSuggestion(suggestion: PlaceSuggestion): PlaceAutocompleteSuggestion {
  return {
    id: suggestion.id,
    label: suggestion.label,
    detail: suggestion.detail,
    kind: suggestion.kind,
    lat: suggestion.lat,
    lng: suggestion.lng,
  };
}

/**
 * How a provider that could not answer is told to the browser. The status says who failed (502: the provider did not
 * answer well; 503: place search is not being served), the `reason` is what the box reads. A provider quota is
 * `limited` like our own limit, so the box says "try again in a moment" and not "broken".
 */
function providerFailure(error: PlaceLookupError, requestId: string): Response {
  switch (error.failure) {
    case "quota":
      return failure(503, requestId, { code: "UPSTREAM_FAILED", reason: "limited" });
    case "off":
      return failure(503, requestId, { code: "UPSTREAM_FAILED", reason: "unavailable" });
    case "timeout":
    case "error":
      return failure(502, requestId, { code: "UPSTREAM_FAILED", reason: "unavailable" });
  }
}

export async function handlePlaceAutocomplete(
  request: Request,
  deps: PlaceAutocompleteDeps,
): Promise<Response> {
  const { requestId, log } = deps;

  const queries = new URL(request.url).searchParams.getAll("q");
  const parsed = autocompleteQuery.safeParse(queries.length === 1 ? queries[0] : undefined);
  if (!parsed.success) return failure(400, requestId, { code: "VALIDATION" });

  try {
    await deps.enforceLimits();
    const provider = await deps.getProvider();
    const suggestions = await provider.autocomplete(parsed.data);
    return json({ ok: true, data: suggestions.map(toSuggestion) }, 200, requestId);
  } catch (error) {
    if (error instanceof RateLimitedError) {
      log.info("place search rate limited", { scope: error.scope });
      return failure(429, requestId, {
        code: "RATE_LIMITED",
        reason: "limited",
        ...(error.retryAfter !== undefined ? { retryAfter: Math.ceil(error.retryAfter) } : {}),
      });
    }
    if (error instanceof PlaceLookupError) {
      // `off` is the owner's switch or a missing key, not a fault: one quiet line is enough.
      if (error.failure === "off") log.debug("place search is off");
      else log.warn("place lookup failed", { failure: error.failure });
      return providerFailure(error, requestId);
    }
    // Anything else is ours (the counter, the settings read, a bug). The box degrades like for a provider failure.
    log.error("place search failed unexpectedly", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    await deps.reportError?.(error, { ...ERROR_CONTEXT, requestId });
    return failure(500, requestId, { code: "INTERNAL", reason: "unavailable" });
  }
}
