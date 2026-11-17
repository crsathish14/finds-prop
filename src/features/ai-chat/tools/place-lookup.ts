/**
 * What the place-aware `search_properties` needs from the outside (ADR-142): one function that turns the words a customer
 * typed into a position, or says why it could not. The tool never knows who answers (our own localities, the map
 * provider, a test stand-in) and the answer carries no name, label, place id or provider text, only the position the
 * server then searches around. The model is never given the position either: the tool result says only "found" or
 * why not (ADR-131, ADR-142).
 */

/** What a lookup came to. */
export type PlaceLookupResult =
  | { status: "found"; lat: number; lng: number }
  /** More than one place could be meant and none is exactly what was typed. */
  | { status: "ambiguous" }
  /** Nothing in Tamil Nadu answers the words (a place elsewhere, a misspelling too far off, an unknown name). */
  | { status: "not_found" }
  /** The lookup could not answer: switched off, not configured, out of quota, timed out, or failed. */
  | { status: "unavailable" };

/** Looks a typed place up on the server. It never throws: a failure is `unavailable`. */
export type PlaceLookup = (text: string) => Promise<PlaceLookupResult>;
