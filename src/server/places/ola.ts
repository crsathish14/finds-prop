import { randomUUID } from "node:crypto";
import {
  PLACES_TIMEOUT_MS,
  PlaceLookupError,
  type PlaceBounds,
  type PlaceKind,
  type PlaceProvider,
  type PlaceSuggestion,
} from "./types";

/**
 * Ola Maps Places Autocomplete (ADR-131). One call: `GET /places/v1/autocomplete?input=…&api_key=…`, with a
 * bias towards Chennai. What the real service answers was checked on 17 Nov 2026 with 168 calls: every
 * suggestion carries `geometry.location.{lat,lng}`, so no second call is needed for a position; `layer[0]` says
 * `borough`, `locality`, `street` or `venue`; the bias only ranks results (a search for Adyar listed Adyar in
 * Karnataka first, and "Bandra Mumbai" still found Mumbai), so the region is enforced here, on the answer.
 *
 * The key travels in the request address, so that address is never logged, never put in an error message and
 * never returned. Nothing thrown here holds the typed text or a place name (R-BE-10).
 */
const ENDPOINT = "https://api.olamaps.io/places/v1/autocomplete";

/** The centre of Chennai and the radius the bias covers (metres). */
const DEFAULT_BIAS = { lat: 13.0827, lng: 80.2707, radiusMeters: 50_000 } as const;

/** The most suggestions kept from one answer (Ola sends five). */
const MAX_SUGGESTIONS = 8;

/** A suggestion is kept only when its text names Tamil Nadu (or Puducherry, which lies inside the region). */
const REGION_NAMES = /tamil\s?nadu|puducherry|pondicherry/i;

/** The `layer` values that mean "an area" (a neighbourhood, a locality, a town or a district). */
const AREA_LAYERS = new Set(["borough", "locality", "neighbourhood", "localadmin", "county"]);
/** The `layer` values that mean something far bigger than a place to search around; such a suggestion is dropped. */
const TOO_BROAD_LAYERS = new Set([
  "macrocounty",
  "region",
  "macroregion",
  "country",
  "dependency",
  "empire",
  "continent",
  "ocean",
  "marinearea",
]);

const KIND_ORDER: Record<PlaceKind, number> = { area: 0, street: 1, venue: 2 };

export interface OlaPlaceOptions {
  apiKey: string;
  /** The region: a suggestion whose point lies outside it is dropped. */
  bounds: PlaceBounds;
  bias?: { lat: number; lng: number; radiusMeters: number };
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function numberOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function insideBounds(lat: number, lng: number, bounds: PlaceBounds): boolean {
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

/** What one suggestion means: its kind, or null for one that is too broad. */
function kindOf(layer: unknown): PlaceKind | null {
  const first = Array.isArray(layer) ? textOf(layer[0]) : null;
  if (first === null) return "venue";
  if (TOO_BROAD_LAYERS.has(first)) return null;
  if (AREA_LAYERS.has(first)) return "area";
  return first === "street" ? "street" : "venue";
}

/** The name and the rest of the address of one suggestion, from the structured text or else the description. */
function labelsOf(item: JsonObject, description: string): { label: string; detail: string } {
  const structured = isObject(item["structured_formatting"]) ? item["structured_formatting"] : {};
  const main = textOf(structured["main_text"]);
  if (main !== null) return { label: main, detail: textOf(structured["secondary_text"]) ?? "" };
  const split = description.indexOf(",");
  return split === -1
    ? { label: description, detail: "" }
    : { label: description.slice(0, split).trim(), detail: description.slice(split + 1).trim() };
}

/** One suggestion from the answer, or null when it is unusable, too broad, or outside the region. */
function toSuggestion(item: unknown, bounds: PlaceBounds): PlaceSuggestion | null {
  if (!isObject(item)) return null;
  const description = textOf(item["description"]);
  const geometry = isObject(item["geometry"]) ? item["geometry"] : null;
  const point = geometry !== null && isObject(geometry["location"]) ? geometry["location"] : null;
  const lat = point === null ? null : numberOf(point["lat"]);
  const lng = point === null ? null : numberOf(point["lng"]);
  const kind = kindOf(item["layer"]);
  if (description === null || lat === null || lng === null || kind === null) return null;
  if (!insideBounds(lat, lng, bounds)) return null;
  const { label, detail } = labelsOf(item, description);
  if (!REGION_NAMES.test(`${description} ${detail}`)) return null;
  return {
    id: textOf(item["place_id"]) ?? textOf(item["reference"]) ?? description,
    label,
    detail,
    kind,
    lat,
    lng,
  };
}

/** Areas first, then streets, then venues; inside a group the provider's own order is kept. */
function inContractOrder(suggestions: PlaceSuggestion[]): PlaceSuggestion[] {
  return suggestions
    .map((suggestion, order) => ({ suggestion, order }))
    .sort(
      (first, second) =>
        KIND_ORDER[first.suggestion.kind] - KIND_ORDER[second.suggestion.kind] ||
        first.order - second.order,
    )
    .map((entry) => entry.suggestion);
}

export function createOlaPlaceProvider(options: OlaPlaceOptions): PlaceProvider {
  const send = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? PLACES_TIMEOUT_MS;
  const bias = options.bias ?? DEFAULT_BIAS;
  return {
    async autocomplete(text) {
      const address = new URL(ENDPOINT);
      address.searchParams.set("input", text);
      address.searchParams.set("location", `${bias.lat},${bias.lng}`);
      address.searchParams.set("radius", String(bias.radiusMeters));
      address.searchParams.set("api_key", options.apiKey);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await send(address, {
          headers: { Accept: "application/json", "X-Request-Id": randomUUID() },
          signal: controller.signal,
        });
      } catch (failure) {
        const timedOut = failure instanceof Error && failure.name === "AbortError";
        throw new PlaceLookupError(
          timedOut ? "timeout" : "error",
          timedOut
            ? "The place provider did not answer in time"
            : "The place provider could not be reached",
        );
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 429) {
        throw new PlaceLookupError(
          "quota",
          "The place provider refused: limit or balance (HTTP 429)",
        );
      }
      if (!response.ok) {
        throw new PlaceLookupError("error", `The place provider answered HTTP ${response.status}`);
      }
      const answer = (await response.json().catch(() => null)) as unknown;
      const predictions = isObject(answer) ? answer["predictions"] : undefined;
      if (!Array.isArray(predictions)) {
        throw new PlaceLookupError("error", "The place provider sent an answer we cannot read");
      }
      const kept = predictions
        .map((item) => toSuggestion(item, options.bounds))
        .filter((suggestion): suggestion is PlaceSuggestion => suggestion !== null);
      return inContractOrder(kept).slice(0, MAX_SUGGESTIONS);
    },
  };
}
