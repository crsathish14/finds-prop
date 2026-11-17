import { PlaceLookupError, type PlaceProvider, type PlaceSuggestion } from "./types";

/**
 * Fixed Chennai places for tests, CI and local work (no network). The ids are made up and say so. The order
 * follows the provider's contract: areas first, then streets, then venues.
 */
export const FAKE_PLACES: readonly PlaceSuggestion[] = [
  {
    id: "fake-kk-nagar",
    label: "KK Nagar",
    detail: "Chennai, Tamil Nadu, India",
    kind: "area",
    lat: 13.0415,
    lng: 80.1996,
  },
  {
    id: "fake-kk-nagar-west",
    label: "KK Nagar West",
    detail: "Chennai, Tamil Nadu, India",
    kind: "area",
    lat: 13.0432,
    lng: 80.1962,
  },
  {
    id: "fake-velachery",
    label: "Velachery",
    detail: "Chennai, Tamil Nadu, India",
    kind: "area",
    lat: 12.9791,
    lng: 80.2212,
  },
  {
    id: "fake-vyasarpadi",
    label: "Vyasarpadi",
    detail: "Chennai, Tamil Nadu, India",
    kind: "area",
    lat: 13.1167,
    lng: 80.2564,
  },
  {
    id: "fake-t-nagar",
    label: "T Nagar",
    detail: "Chennai, Tamil Nadu, India",
    kind: "area",
    lat: 13.0418,
    lng: 80.2341,
  },
  {
    id: "fake-velachery-station",
    label: "Velachery Railway Station",
    detail: "Velachery, Chennai, Tamil Nadu, India",
    kind: "venue",
    lat: 12.9807,
    lng: 80.2186,
  },
];

export interface FakePlaceProvider extends PlaceProvider {
  /** The text of each lookup made, for tests. */
  readonly asked: readonly string[];
}

/** Lowercase letters and digits only, so "T. Nagar", "t nagar" and "TNagar" are one spelling. */
function plain(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * A provider that answers from a fixed list: a place matches when its name (letters and digits only) starts
 * with, or holds, what was typed. It never calls anything. With `failWith` every lookup fails.
 */
export function createFakePlaceProvider(
  options: { places?: readonly PlaceSuggestion[]; failWith?: PlaceLookupError } = {},
): FakePlaceProvider {
  const places = options.places ?? FAKE_PLACES;
  const asked: string[] = [];
  return {
    asked,
    autocomplete(text) {
      asked.push(text);
      if (options.failWith) return Promise.reject(options.failWith);
      const wanted = plain(text);
      const found = places.filter((place) => plain(place.label).includes(wanted));
      return Promise.resolve(found.map((place) => ({ ...place })));
    },
  };
}

/**
 * The provider for an environment where place search is switched off, or has no key: every lookup says so at
 * once, with nothing sent anywhere, so the screen shows its fallback (FR-GEO-01, criterion 3).
 */
export function createOffPlaceProvider(reason: string): PlaceProvider {
  return {
    autocomplete() {
      return Promise.reject(new PlaceLookupError("off", reason));
    },
  };
}
