/**
 * The city named by the rest of a map suggestion's address ("Adyar, Chennai, Tamil Nadu 600020, India"), or null
 * when it names none. In an Indian address the city comes just before the state, so that is the part taken; when
 * the address has no state, the first part that is not the country or a number. The state and the country are
 * never a city. Pure text work: no network, so the same words give the same city everywhere.
 */
export function cityFromPlaceDetail(detail: string, stateName = "Tamil Nadu"): string | null {
  const state = stateName.toLowerCase();
  const parts = detail
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "" && part.toLowerCase() !== "india" && !/^[0-9 ]+$/.test(part));
  const stateAt = parts.findIndex((part) => part.toLowerCase().startsWith(state));
  if (stateAt > 0) return parts[stateAt - 1] ?? null;
  return parts.find((part) => !part.toLowerCase().startsWith(state)) ?? null;
}
