/**
 * The reasons a search result gives the model for each home or project (ADR-205): short facts made by code from the
 * ranking, never by the model, so a reason is always true of the record. They are plain English data for the model to
 * put in the customer's language. None names a promotion: the chat never says a result is sponsored, featured or
 * promoted (owner, 26 Nov 2026), and the promotion tier never appears in a tool result.
 *
 * The words inside a reason come from the customer's own request (the preferred locality, the amenity), never from a
 * listing's text, so a reason carries nothing a stranger typed.
 */
import type { PreferenceOutcome, RankedEntry } from "./rank";

/** At most this many reasons, and this many missed preferences, per record: enough to explain, small for the model. */
export const MAX_REASONS = 5;

function metText(outcome: PreferenceOutcome): string {
  if (outcome.kind === "locality") return `in a preferred area (${outcome.value})`;
  if (outcome.kind === "amenity") return `has ${outcome.value}`;
  return "furnishing as wanted";
}

function missedText(outcome: PreferenceOutcome): string {
  if (outcome.kind === "locality") return `not in a preferred area (${outcome.value})`;
  if (outcome.kind === "amenity") return `${outcome.value} not listed`;
  return "other furnishing";
}

/** The reasons for one ranked record. `withinBudget` is true when the customer gave a maximum and the price is under it. */
export function reasonsFor(
  entry: Pick<RankedEntry<unknown>, "met" | "missed">,
  facts: { readonly withinBudget: boolean; readonly listedDaysAgo: number | null },
): { matchReasons: string[]; missedPreferences: string[] } {
  const matchReasons = entry.met.map(metText);
  if (facts.withinBudget) matchReasons.push("within the budget");
  if (facts.listedDaysAgo !== null && facts.listedDaysAgo <= 7) {
    matchReasons.push("listed in the last week");
  }
  return {
    matchReasons: matchReasons.slice(0, MAX_REASONS),
    missedPreferences: entry.missed.map(missedText).slice(0, MAX_REASONS),
  };
}
