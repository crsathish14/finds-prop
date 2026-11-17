import { PlaceLookupError, type PlaceProvider } from "./types";

/**
 * How a lookup that reached the provider is counted (ADR-134), for callers that are not the autocomplete route
 * (the AI chat's place search, ADR-142). The outcome is one of the five the usage table accepts and nothing else:
 * no text, no place name. A lookup that sent nothing (`off`: the kill switch or no key) is not a call and is not
 * counted, and neither is an unexpected error of ours.
 */
export type CountedOutcome = "ok" | "empty" | "timeout" | "quota" | "error";

/**
 * The same provider, telling `count` once for every lookup that reached the provider. `count` must only schedule
 * the write and return; if it throws the lookup's answer is unchanged.
 */
export function createCountedPlaceProvider(
  provider: PlaceProvider,
  count: (outcome: CountedOutcome) => void,
): PlaceProvider {
  const tell = (outcome: CountedOutcome) => {
    try {
      count(outcome);
    } catch {
      // Counting is a side effect and never changes what the caller gets.
    }
  };
  return {
    async autocomplete(text) {
      try {
        const suggestions = await provider.autocomplete(text);
        tell(suggestions.length > 0 ? "ok" : "empty");
        return suggestions;
      } catch (failure) {
        if (failure instanceof PlaceLookupError && failure.failure !== "off") {
          tell(failure.failure);
        }
        throw failure;
      }
    },
  };
}
