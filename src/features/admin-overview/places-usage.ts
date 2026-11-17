import type { PlacesUsage } from "@/components/domain/places-usage-card";
import { dayLabel } from "./day-label";
import type { PlacesCaller, PlacesUsageNumbers } from "./view";

/**
 * The place search card's numbers (PR 6b of the Ola Maps plan, ADR-134), as the card draws them: the database's days
 * get their labels ("1 Oct" and "1 Oct 2026", the way the Overview's own chart names its days) and each caller its
 * name. Pure: the island passes the language and the names, so nothing here reads a clock or a message file.
 */

/** The four parts of the site that call Ola Maps, in the order the card lists them. */
export const PLACES_CALLERS: readonly PlacesCaller[] = [
  "search_box",
  "listing_form",
  "admin_picker",
  "ai_chat",
];

export function toCardUsage(
  numbers: PlacesUsageNumbers,
  locale: string,
  callerLabel: (caller: PlacesCaller) => string,
): PlacesUsage {
  return {
    days: numbers.days.map((entry) => ({
      label: dayLabel(entry.day, locale, false),
      detailLabel: dayLabel(entry.day, locale, true),
      calls: entry.calls,
    })),
    today: numbers.today,
    month: numbers.month,
    callers: PLACES_CALLERS.map((caller) => ({
      id: caller,
      label: callerLabel(caller),
      calls: numbers.callers[caller],
    })),
    outcomes: numbers.outcomes,
  };
}
