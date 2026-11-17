import { createFakePlaceProvider, createOffPlaceProvider } from "./fake";
import { createOlaPlaceProvider } from "./ola";
import type { PlaceBounds, PlaceProvider } from "./types";

export { createFakePlaceProvider, FAKE_PLACES, type FakePlaceProvider } from "./fake";
export {
  normalisePlaceText,
  resolvePlace,
  type KnownPlace,
  type PlaceResolution,
  type ResolvedPlace,
  type ResolveDependencies,
} from "./resolve";
export {
  PLACE_TEXT_MAX_CHARACTERS,
  PLACE_TEXT_MIN_CHARACTERS,
  PLACES_TIMEOUT_MS,
  PlaceLookupError,
  type PlaceBounds,
  type PlaceFailure,
  type PlaceKind,
  type PlaceProvider,
  type PlaceSuggestion,
} from "./types";

export interface PlacesConfig {
  APP_ENV: "local" | "dev" | "staging" | "production";
  OLA_MAPS_API_KEY?: string | undefined;
  /** The manual kill switch (PLACES_DISABLED=1): every lookup says "off" without calling anything. */
  PLACES_DISABLED: boolean;
}

/**
 * The provider for this environment. Switched off by the owner: nothing is called. With a key: Ola Maps. Without a
 * key, local and dev use the fake list (so a developer sees suggestions with no account), while staging and
 * production answer "off": unlike the SMS sender this never refuses to start, because a place search that cannot
 * answer degrades to typed text and the page still works (FR-GEO-01, criterion 3). `bounds` is the region from the
 * site settings, which the caller reads; the server layer never imports a feature.
 */
export function choosePlaceProvider(
  config: PlacesConfig,
  bounds: PlaceBounds,
  fetchImpl?: typeof fetch,
): PlaceProvider {
  if (config.PLACES_DISABLED) return createOffPlaceProvider("Place search is switched off");
  if (config.OLA_MAPS_API_KEY) {
    return createOlaPlaceProvider({
      apiKey: config.OLA_MAPS_API_KEY,
      bounds,
      ...(fetchImpl ? { fetchImpl } : {}),
    });
  }
  if (config.APP_ENV === "local" || config.APP_ENV === "dev") return createFakePlaceProvider();
  return createOffPlaceProvider(
    "Place search is not configured here (OLA_MAPS_API_KEY is not set)",
  );
}
