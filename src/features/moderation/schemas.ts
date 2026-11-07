import { z } from "zod";
import {
  DEFAULT_TAB,
  LOCALITY_FILTER_MAX,
  QUEUE_KINDS,
  QUEUE_TABS,
  REASON_MAX,
  type QueueKind,
  type QueueTab,
} from "./constants";

/**
 * What the admin's queue sends and reads (S6-T04, FR-ADM-02). Nothing here says who is deciding: the admin
 * is the signed-in session (R-BE-03). A schema message is a key under `validation.*`; the screen looks the
 * words up (ADR-035).
 */

const listingId = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

/** A reason as typed: the ends are trimmed, then it must be 1 to 500 characters (the database holds the same rule). */
const reason = z.preprocess(
  (typed) => (typeof typed === "string" ? typed.trim() : typed),
  z
    .string({ error: "validation.required" })
    .min(1, { error: "validation.required" })
    .max(REASON_MAX),
);

/**
 * One decision on one listing. Approve, feature and remove from featured need only the listing; a rejection
 * also needs its reason, which the owner will read. The decision picks the rule, so a reason sent with an
 * approval is not part of the input at all (it is dropped, never stored).
 */
export const moderateListingSchema = z.discriminatedUnion(
  "decision",
  [
    z.object({ decision: z.literal("approve"), listingId }),
    z.object({ decision: z.literal("reject"), listingId, reason }),
    z.object({ decision: z.literal("feature"), listingId }),
    z.object({ decision: z.literal("unfeature"), listingId }),
  ],
  { error: "validation.invalid" },
);
export type ModerateListingInput = z.infer<typeof moderateListingSchema>;

/**
 * The queue's address bar: tab, locality, kind and the page cursor (R-FE-11). A value that is not valid is
 * dropped, so a mistyped address shows the default queue instead of an error; the default tab is left out of
 * the address by whoever builds it.
 */
const clean = (typed: unknown): unknown => {
  const first = Array.isArray(typed) ? typed[0] : typed;
  return typeof first === "string" ? first.trim() : undefined;
};

export const queueFilterSchema = z.object({
  tab: z.preprocess(clean, z.enum(QUEUE_TABS)).catch(DEFAULT_TAB),
  locality: z
    .preprocess(clean, z.string().min(1).max(LOCALITY_FILTER_MAX))
    .optional()
    .catch(undefined),
  kind: z.preprocess(clean, z.enum(QUEUE_KINDS)).optional().catch(undefined),
  /** Where the next page starts: the opaque cursor a previous page gave. */
  after: z.preprocess(clean, z.string().min(1).max(200)).optional().catch(undefined),
});
export type QueueFilters = {
  tab: QueueTab;
  locality?: string | undefined;
  kind?: QueueKind | undefined;
  after?: string | undefined;
};
