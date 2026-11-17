import { ActionError } from "../actions/normalise-error";

/**
 * Looking up a place goes through one interface (R-BE-09, ADR-013, ADR-131). Features and route handlers never
 * call the map provider directly; a fake exists for tests and for local work. Nothing here knows which
 * provider is behind it.
 */

/** How long a provider may take before it gives up, in milliseconds (the same budget as the SMS adapter). */
export const PLACES_TIMEOUT_MS = 3000;

/** Text shorter than this is never sent to the provider (a quota guard; FR-GEO-01 says three characters). */
export const PLACE_TEXT_MIN_CHARACTERS = 3;
/** Text longer than this is refused (the same 80 characters the search address accepts for a place). */
export const PLACE_TEXT_MAX_CHARACTERS = 80;

/**
 * What a suggestion is. `area` is a neighbourhood, a locality or a town ("KK Nagar"), `street` a road, and
 * `venue` a shop, a station, a hospital or any other named thing that sits inside an area.
 */
export type PlaceKind = "area" | "street" | "venue";

export interface PlaceSuggestion {
  /** The provider's own reference. Only a list key: it is never stored and never sent to a model (ADR-131). */
  id: string;
  /** The short name to show ("KK Nagar"). */
  label: string;
  /** The rest of the address to show under the name ("Chennai, Tamil Nadu, India"); can be empty. */
  detail: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
}

/** A box on the map; the region's bounds in the site settings have the same four sides. */
export interface PlaceBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface PlaceProvider {
  /**
   * The suggestions for what a visitor typed, already limited to the region and ordered areas first, then
   * streets, then venues (each group in the provider's own order). An empty list means nothing matched.
   * Throws `PlaceLookupError` when the provider cannot answer; an implementation gives up after
   * `PLACES_TIMEOUT_MS`.
   */
  autocomplete(text: string): Promise<PlaceSuggestion[]>;
}

/**
 * Why a lookup failed, in the words the usage count will use (ADR-131): `timeout` (no answer in time),
 * `quota` (the provider refused for a limit or a missing balance), `error` (anything else), and `off` (switched
 * off on purpose, or not configured here: nothing was sent).
 */
export type PlaceFailure = "timeout" | "quota" | "error" | "off";

/**
 * Thrown by a provider that cannot answer. It is an `UPSTREAM_FAILED` `ActionError` (so the shared mapping
 * applies) that also says why. The message never holds the typed text, a place name or the key (R-BE-10).
 */
export class PlaceLookupError extends ActionError {
  readonly failure: PlaceFailure;

  constructor(failure: PlaceFailure, message: string) {
    super("UPSTREAM_FAILED", message);
    this.name = "PlaceLookupError";
    this.failure = failure;
  }
}
