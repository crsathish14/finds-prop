import { z } from "zod";
import type {
  PlaceAutocompleteFailure,
  PlaceAutocompleteResult,
  PlaceAutocompleteSuggestion,
} from "@/types/places";
import type {
  PlacesUsageCaller,
  PlacesUsageOutcome,
  PlacesUsageRecord,
} from "../audit/places-usage";
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
 *   1 parse `q` and `source` (400)   2 rate limit (429)   3 provider and region   4 look up   5 answer   6 count
 *
 * Every answer is JSON in the `ActionResult` envelope with `Cache-Control: no-store` (what a visitor typed must never
 * be cached by a browser, a proxy or the CDN). A call that reached the provider is counted once, after the answer is
 * built and never before it (`recordUsage`; ADR-133 update, ADR-134). The typed text, the place names and the
 * provider's request address (it holds the key) are never logged or put in an error (R-BE-10): a line says only that
 * a lookup failed and how.
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

/** Where the call came from, as a label for the usage count only. `ai_chat` is not reachable from this route. */
const PLACE_SOURCES = [
  "search_box",
  "listing_form",
  "admin_picker",
] as const satisfies readonly PlacesUsageCaller[];
const DEFAULT_SOURCE = "search_box" satisfies PlacesUsageCaller;

/** `source` may be left out (the search box) or given exactly once, from the list. Nothing else is accepted. */
const autocompleteSource = z.enum(PLACE_SOURCES).default(DEFAULT_SOURCE);

export interface PlaceAutocompleteDeps {
  requestId: string;
  /** Counts this call against the `places` limits. Throws `RateLimitedError` when one is used up (fail closed). */
  enforceLimits(): Promise<void>;
  /** The provider for this environment, with the region from the site settings (`choosePlaceProvider`). */
  getProvider(): Promise<PlaceProvider> | PlaceProvider;
  log: Logger;
  /** Sends an unexpected error to the error tracker (ADR-130). Optional: tests have none. */
  reportError?(error: unknown, context: ErrorContext): Promise<void>;
  /**
   * Counts one call that reached the provider. It must only schedule the write (the route hands it to `after()`) and
   * return at once; the handler has already built the answer. It never changes the answer: if it throws, the handler
   * logs one line and carries on. Optional: tests that do not look at the count have none.
   */
  recordUsage?(record: PlacesUsageRecord): void;
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

  const parameters = new URL(request.url).searchParams;
  const queries = parameters.getAll("q");
  const parsed = autocompleteQuery.safeParse(queries.length === 1 ? queries[0] : undefined);
  const sources = parameters.getAll("source");
  const parsedSource = autocompleteSource.safeParse(sources.length <= 1 ? sources[0] : null);
  if (!parsed.success || !parsedSource.success)
    return failure(400, requestId, { code: "VALIDATION" });
  const caller = parsedSource.data;

  /** Called only once the answer is complete. Schedules the count and waits for nothing; it cannot fail the call. */
  const count = (outcome: PlacesUsageOutcome) => {
    try {
      deps.recordUsage?.({ api: "autocomplete", caller, outcome });
    } catch {
      log.warn("place usage could not be scheduled");
    }
  };

  try {
    await deps.enforceLimits();
    const provider = await deps.getProvider();
    const suggestions = await provider.autocomplete(parsed.data);
    const response = json({ ok: true, data: suggestions.map(toSuggestion) }, 200, requestId);
    count(suggestions.length > 0 ? "ok" : "empty");
    return response;
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
      const response = providerFailure(error, requestId);
      // `off` (the kill switch or no key) sent nothing to the provider, so it is not a call to count.
      if (error.failure !== "off") count(error.failure);
      return response;
    }
    // Anything else is ours (the counter, the settings read, a bug). The box degrades like for a provider failure.
    log.error("place search failed unexpectedly", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    await deps.reportError?.(error, { ...ERROR_CONTEXT, requestId });
    return failure(500, requestId, { code: "INTERNAL", reason: "unavailable" });
  }
}
