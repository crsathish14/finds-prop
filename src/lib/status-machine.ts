/**
 * The status machines of listings and enquiries (UT-status, S6-T05). The database holds the real rules in its
 * guard triggers (`guard_properties`, `guard_enquiries`); this table says the same thing in code so the screens
 * can ask what is allowed, and `IT-status-parity` replays every pair against the database in CI so the two can
 * never drift apart: a pair is allowed here if and only if the trigger allows it.
 */

/** The states of a listing, as `properties.status` holds them. */
export const LISTING_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "sold",
  "rented",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** The states of an enquiry, as `enquiries.status` holds them. */
export const ENQUIRY_STATUSES = ["new", "contacted", "closed"] as const;
export type EnquiryState = (typeof ENQUIRY_STATUSES)[number];

/** Where a listing may go from each state. Sold and rented are terminal; a rejected listing may be resubmitted. */
export const LISTING_MOVES: Readonly<Record<ListingStatus, readonly ListingStatus[]>> = {
  draft: ["pending"],
  pending: ["approved", "rejected"],
  approved: ["pending", "sold", "rented"],
  rejected: ["pending"],
  sold: [],
  rented: [],
};

/** Where an enquiry may go from each state: forward only. */
export const ENQUIRY_MOVES: Readonly<Record<EnquiryState, readonly EnquiryState[]>> = {
  new: ["contacted", "closed"],
  contacted: ["closed"],
  closed: [],
};

type Machines = {
  listing: { state: ListingStatus; moves: typeof LISTING_MOVES };
  enquiry: { state: EnquiryState; moves: typeof ENQUIRY_MOVES };
};

/** Whether a record of this kind may move from one state to another. Staying where it is is not a move. */
export function canTransition<Kind extends keyof Machines>(
  kind: Kind,
  from: Machines[Kind]["state"],
  to: Machines[Kind]["state"],
): boolean {
  const moves: Readonly<Record<string, readonly string[]>> =
    kind === "listing" ? LISTING_MOVES : ENQUIRY_MOVES;
  return moves[from]?.includes(to) ?? false;
}
