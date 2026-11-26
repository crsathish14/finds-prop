/**
 * The city the assistant's searches filter by (ADR-204). The model gives the city as the customer wrote it; the
 * search functions (`search_properties(p_city)`, `live_project_list(p_city)`) compare cities by `city_key()`: lower
 * case, letters and digits only. This turns the typed name into that key here, so a name with nothing usable in it
 * is never sent (the home search refuses one with `search.invalid_city`).
 */

/** The longest city name a search accepts, as `search_properties()` checks. */
export const CITY_MAX_CHARACTERS = 80;

/**
 * The city key for a typed city name, or null when none was given or nothing usable is in it. Only Latin letters and
 * digits are kept, as the cities are listed in English: a name in Tamil script gives null, and the search runs
 * without a city filter rather than finding nothing.
 */
export function cityFilterOf(typed: string | null): string | null {
  if (typed === null) return null;
  const trimmed = typed.trim();
  if (trimmed === "" || trimmed.length > CITY_MAX_CHARACTERS) return null;
  const key = trimmed.toLowerCase().replace(/[^a-z0-9]/gu, "");
  return key === "" ? null : key;
}
