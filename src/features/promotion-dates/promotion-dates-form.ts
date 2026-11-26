import { promotionStatus, type PromotionDates, type PromotionStatus } from "@/lib/promotion-dates";

/**
 * The promotion date boxes' values (ADR-210), kept apart from the screens so the server pages and the tests can use
 * them: what the boxes start from, what a save sends, and the tag a typed pair gives today. Pure.
 */

/** Two date boxes as typed: `YYYY-MM-DD`, or empty for no day. */
export type PromotionDatesValue = { startsOn: string; endsOn: string };

export const NO_DATES: PromotionDatesValue = { startsOn: "", endsOn: "" };

/** The boxes for stored dates, by id: an empty box where no day is stored. */
export function typedDatesOf(
  stored: Readonly<Record<string, PromotionDates>> | undefined,
): Record<string, PromotionDatesValue> {
  return Object.fromEntries(
    Object.entries(stored ?? {}).map(([id, dates]) => [
      id,
      { startsOn: dates.startsOn ?? "", endsOn: dates.endsOn ?? "" },
    ]),
  );
}

/** The typed dates of the ids still picked, as the save takes them. */
export function datesOf(
  ids: readonly string[],
  typed: Readonly<Record<string, PromotionDatesValue>>,
): Record<string, PromotionDatesValue> {
  return Object.fromEntries(ids.flatMap((id) => (typed[id] ? [[id, typed[id]]] : [])));
}

/** Where the typed days put a promotion today; a box that is not a whole day yet counts as empty. */
export function statusOfTyped(value: PromotionDatesValue, today: string): PromotionStatus {
  const day = (typed: string) => (/^\d{4}-\d{2}-\d{2}$/.test(typed) ? typed : undefined);
  const startsOn = day(value.startsOn);
  const endsOn = day(value.endsOn);
  return promotionStatus(
    {
      ...(startsOn === undefined ? {} : { startsOn }),
      ...(endsOn === undefined ? {} : { endsOn }),
    },
    today,
  );
}
