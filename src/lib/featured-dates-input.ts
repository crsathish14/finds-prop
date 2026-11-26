import { z } from "zod";
import { dayNumber } from "./india-days";
import { endsBeforeStart } from "./promotion-dates";

/**
 * The optional first and last day of a home's or a project's Featured (ADR-210), as the admin's Feature sends them
 * from the moderation screens. Shared by the two moderation schemas so both read the days by one rule: an empty or
 * missing day is no day, anything else must be a real `YYYY-MM-DD` calendar day, and the last day may not come before
 * the first (the error sits on the end date). The database holds the same order rule (`listing.bad_dates`,
 * `project.bad_dates`). A message is a key under `validation.*` (ADR-035).
 */

/** One day as sent: blank reads as none. */
export const featuredDay = z.preprocess(
  (typed) =>
    typed === null || (typeof typed === "string" && typed.trim() === "") ? undefined : typed,
  z
    .string({ error: "validation.invalid" })
    .refine((day) => dayNumber(day) !== null, { error: "validation.invalid" })
    .optional(),
);

/** The two days of a Feature, as the schemas take them. */
export interface FeaturedDaysInput {
  featuredFrom?: string | undefined;
  featuredUntil?: string | undefined;
}

/** Adds the order error to the end date when the last day comes before the first. For a schema's `superRefine`. */
export function checkFeaturedOrder(days: FeaturedDaysInput, context: z.RefinementCtx): void {
  if (endsBeforeStart({ startsOn: days.featuredFrom, endsOn: days.featuredUntil })) {
    context.addIssue({
      code: "custom",
      path: ["featuredUntil"],
      message: "validation.promotionDatesOrder",
    });
  }
}
