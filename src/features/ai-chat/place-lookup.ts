import { logger } from "@/server/logger";
import {
  resolvePlace,
  type KnownPlace,
  type PlaceProvider,
  type PlaceResolution,
} from "@/server/places";
import { closeLocalityMatch } from "./localities";
import type { PlaceLookup, PlaceLookupResult } from "./tools/place-lookup";

/**
 * The place lookup of the AI chat (ADR-142, `OLA_MAPS_PLAN.md` 4.4): it turns the words the model passed on into
 * a position, on our server, with `resolvePlace` (ADR-131). What comes back is only the position or the reason
 * there is none; the label, the place id and everything else the provider sent stay in this function, so the tool
 * can never hand them to the model. Nothing the provider answered is stored or cached; the only memory is the one customer
 * message's own, so the same words asked twice in a message cost one lookup.
 */

/** What the lookup needs from outside, so a test can give it a fixed list and no network. */
export interface PlaceLookupDeps {
  readonly provider: () => Promise<PlaceProvider>;
  /** The localities that have listings, for the spelling help (our own data, no cost). */
  readonly localities: () => Promise<readonly { name: string }[]>;
}

/** What `resolvePlace` came to, as the tool is told it: no name, no id, no provider text. */
export function toLookupResult(resolution: PlaceResolution): PlaceLookupResult {
  switch (resolution.status) {
    case "found":
      return { status: "found", lat: resolution.place.lat, lng: resolution.place.lng };
    case "choose":
      return { status: "ambiguous" };
    case "none":
      return { status: "not_found" };
    case "unavailable":
      return { status: "unavailable" };
  }
}

/**
 * The lookup over these dependencies. A failure of any kind is `unavailable`, never a thrown error and never a message:
 * the assistant is told it cannot look the place up, nothing more. The answer for a given text is kept for the life of
 * this lookup only (one customer message), so a model that asks for the same place twice does not pay twice.
 */
export function createPlaceLookup(deps: PlaceLookupDeps): PlaceLookup {
  const answers = new Map<string, Promise<PlaceLookupResult>>();

  const lookUp = async (text: string): Promise<PlaceLookupResult> => {
    try {
      const provider = await deps.provider();
      const localities = await deps.localities().catch(() => []);
      const knownPlaces = (typed: string): readonly KnownPlace[] => {
        const close = closeLocalityMatch(localities, typed);
        // Our own spelling of the place, with no position: the provider is asked for that spelling, and the
        // position always comes from it (the locality list holds no coordinates).
        return close === null ? [] : [{ label: close.name, lat: null, lng: null }];
      };
      return toLookupResult(await resolvePlace(text, { provider, knownPlaces }));
    } catch (failure) {
      logger.warn("ai place lookup failed", {
        route: "ai-chat",
        errorName: failure instanceof Error ? failure.name : typeof failure,
      });
      return { status: "unavailable" };
    }
  };

  return (text) => {
    const key = text.trim().toLowerCase();
    const known = answers.get(key);
    if (known !== undefined) return known;
    const answer = lookUp(text);
    answers.set(key, answer);
    return answer;
  };
}
