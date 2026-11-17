import {
  PLACE_TEXT_MAX_CHARACTERS,
  PLACE_TEXT_MIN_CHARACTERS,
  PlaceLookupError,
  type PlaceFailure,
  type PlaceProvider,
  type PlaceSuggestion,
} from "./types";

/**
 * Turning what a visitor typed (or what the AI assistant wrote as a place) into one position, or a short list to
 * choose from, or an honest "nothing" (ADR-131; plan section 4.2). Pure orchestration: the provider and the
 * list of places we already know are handed in, so a test needs no network and this file imports no feature.
 *
 *  1. Our own places first (no cost): the caller's fuzzy match over the localities that have listings.
 *  2. The provider, with a small cleanup first: dots dropped and spaced initials joined ("K K Nagar" and
 *     "K.K. Nagar" become "KK Nagar"), the one spelling mistake real searches showed the provider cannot repair.
 *  3. One more try with `alternativeText` (the assistant's own corrected spelling) when the first finds nothing.
 *  At most two provider calls for one phrase. A position is never guessed.
 */

/** A place we already know, with its position when we have one (the curated localities have one). */
export interface KnownPlace {
  label: string;
  lat: number | null;
  lng: number | null;
}

export interface ResolveDependencies {
  provider: PlaceProvider;
  /** The best match first; empty when nothing is close. Leave it out to skip step 1. */
  knownPlaces?: (text: string) => readonly KnownPlace[];
  /** Another spelling to try once if the first finds nothing. */
  alternativeText?: string | undefined;
}

export interface ResolvedPlace {
  label: string;
  lat: number;
  lng: number;
  /** `known` is one of our own places, `provider` a suggestion from the map provider. */
  source: "known" | "provider";
}

export type PlaceResolution =
  | { status: "found"; place: ResolvedPlace }
  /** More than one place could be meant: the caller shows the list, or the assistant asks one question. */
  | { status: "choose"; suggestions: PlaceSuggestion[] }
  | { status: "none" }
  /** The provider could not answer (or is switched off); `failure` says why, for the usage count. */
  | { status: "unavailable"; failure: PlaceFailure };

const SINGLE_LETTER = /^[A-Za-z]$/;

/**
 * The typed text, cleaned: one script form, dots read as spaces, runs of single letters joined ("K K Nagar" is
 * "KK Nagar", "T. Nagar" stays "T Nagar"), spaces collapsed.
 */
export function normalisePlaceText(text: string): string {
  const tokens = text.normalize("NFKC").replace(/\./g, " ").replace(/\s+/g, " ").trim().split(" ");
  const joined: string[] = [];
  let run = "";
  for (const token of tokens) {
    if (SINGLE_LETTER.test(token)) {
      run += token;
      continue;
    }
    if (run !== "") joined.push(run);
    run = "";
    joined.push(token);
  }
  if (run !== "") joined.push(run);
  return joined.join(" ").trim();
}

/** Letters and digits only, lower case: the form two spellings of one name share. */
function plain(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function usable(text: string): boolean {
  const length = Array.from(text).length;
  return length >= PLACE_TEXT_MIN_CHARACTERS && length <= PLACE_TEXT_MAX_CHARACTERS;
}

function found(suggestion: PlaceSuggestion): PlaceResolution {
  return {
    status: "found",
    place: {
      label: suggestion.label,
      lat: suggestion.lat,
      lng: suggestion.lng,
      source: "provider",
    },
  };
}

/**
 * What the suggestions mean for the text typed. One area is the answer; several areas are the answer only when
 * one of them is exactly what was typed. With no area, the first street or venue that holds every typed word
 * stands for the place (a railway station sits inside its area, so it is a fair centre for a radius search).
 * Anything else is a choice.
 */
function pick(typed: string, suggestions: PlaceSuggestion[]): PlaceResolution {
  const areas = suggestions.filter((suggestion) => suggestion.kind === "area");
  if (areas.length === 1 && areas[0]) return found(areas[0]);
  if (areas.length > 1) {
    const exact = areas.find((area) => plain(area.label) === plain(typed));
    return exact ? found(exact) : { status: "choose", suggestions };
  }
  const words = typed.toLowerCase().split(" ").filter(Boolean);
  const holding = suggestions.find((suggestion) =>
    words.every((word) => suggestion.label.toLowerCase().includes(word)),
  );
  return holding ? found(holding) : { status: "choose", suggestions };
}

export async function resolvePlace(
  text: string,
  dependencies: ResolveDependencies,
): Promise<PlaceResolution> {
  const typed = normalisePlaceText(text);
  if (!usable(typed)) return { status: "none" };

  const known = dependencies.knownPlaces?.(typed) ?? [];
  const best = known[0];
  if (best && best.lat !== null && best.lng !== null) {
    return {
      status: "found",
      place: { label: best.label, lat: best.lat, lng: best.lng, source: "known" },
    };
  }

  const first = best ? best.label : typed;
  const alternative =
    dependencies.alternativeText === undefined
      ? null
      : normalisePlaceText(dependencies.alternativeText);
  const attempts = [first];
  if (alternative !== null && usable(alternative) && plain(alternative) !== plain(first)) {
    attempts.push(alternative);
  }

  try {
    for (const attempt of attempts) {
      const suggestions = await dependencies.provider.autocomplete(attempt);
      if (suggestions.length > 0) return pick(attempt, suggestions);
    }
  } catch (failure) {
    if (failure instanceof PlaceLookupError) {
      return { status: "unavailable", failure: failure.failure };
    }
    throw failure;
  }
  return { status: "none" };
}
