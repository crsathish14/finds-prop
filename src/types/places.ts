import type { ErrorCode } from "./action";

/**
 * What `GET /api/places/autocomplete?q=` answers (ADR-133). The same envelope as every other handler
 * (`ActionResult`: `ok`, then `data` or a closed `code`), with one addition for the search box: a failure that is
 * not the visitor's mistake names `reason`, so the box can choose its state without reading a status code.
 *
 *   `unavailable`  place search cannot answer now (the provider is down, slow, switched off or not set up, or our
 *                  side failed): the box becomes a plain text field with a short message (FR-GEO-01, criterion 3).
 *   `limited`      too many lookups: ours (`RATE_LIMITED`, with `retryAfter` seconds) or the provider's own quota.
 *
 * Nothing here carries the provider's words, the typed text, the key or a database message.
 */
export type PlaceAutocompleteReason = "unavailable" | "limited";

export interface PlaceAutocompleteSuggestion {
  /** The provider's reference: a list key only, never stored. */
  id: string;
  /** The short name to show ("KK Nagar"). */
  label: string;
  /** The rest of the address ("Chennai, Tamil Nadu, India"); can be empty. */
  detail: string;
  kind: "area" | "street" | "venue";
  lat: number;
  lng: number;
}

export interface PlaceAutocompleteFailure {
  ok: false;
  code: ErrorCode;
  reason?: PlaceAutocompleteReason;
  /** Seconds until the caller may try again (our own limit). */
  retryAfter?: number;
  /** A support reference, on every failure (also sent as the `x-request-id` header). */
  requestId: string;
}

export type PlaceAutocompleteResult =
  { ok: true; data: PlaceAutocompleteSuggestion[] } | PlaceAutocompleteFailure;
