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

/**
 * An area the owner can choose when no suggestion fits the address (place search PR 7b, ADR-141): one of the
 * site's curated localities, or a suggestion of kind `area`. A listing placed by area is shown as approximate.
 */
export interface LocationArea {
  label: string;
  detail?: string | undefined;
  lat: number;
  lng: number;
}

/** A place that is already held for the listing, as the field shows it. It never carries the point itself. */
export interface ListingLocationHeld {
  label: string;
  detail?: string | undefined;
  approximate: boolean;
}

/**
 * What the post-property wizard hands to the connected location field (ADR-141, as ADR-140 does for the place
 * picker): the wizard holds the place; the field holds only what is being typed and which way (address or area)
 * the owner is choosing. A chosen suggestion goes up through `onPick` with its point; the wizard decides what
 * boxes it fills and what is kept.
 */
export interface ListingLocationFieldProps {
  /** A place is held: the field shows the "Location found" card with Change. */
  held: ListingLocationHeld | null;
  /** The curated localities, the way to choose an area when suggestions cannot be fetched. */
  areas: readonly LocationArea[];
  /** The text of the problem with the place, or null. Shown under the field as an alert. */
  errorText: string | null;
  disabled: boolean;
  onPick: (suggestion: PlaceAutocompleteSuggestion) => void;
  onPickArea: (area: LocationArea) => void;
  /** Change was pressed: the wizard lets go of the place and the field starts again. */
  onChange: () => void;
}
