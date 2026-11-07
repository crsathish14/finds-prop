/**
 * The fixed lists and limits of the admin's listing queue (S6-T04, FR-ADM-02). The reason length is the one
 * `moderate_listing` holds in the database (ADR-064); the tabs are the ones `admin_listing_queue` knows.
 */

/** The decisions an admin can make on one listing; the database function takes them as its `p_action`. */
export const DECISIONS = ["approve", "reject", "feature", "unfeature"] as const;
export type Decision = (typeof DECISIONS)[number];

/** The queue's tabs: closed means sold or rented, all means every listing that is not a draft. */
export const QUEUE_TABS = ["pending", "approved", "rejected", "closed", "all"] as const;
export type QueueTab = (typeof QUEUE_TABS)[number];
export const DEFAULT_TAB: QueueTab = "pending";

export const QUEUE_KINDS = ["sale", "rent"] as const;
export type QueueKind = (typeof QUEUE_KINDS)[number];

/** The statuses a listing outside the drafts can have. */
export const LISTING_STATUSES = ["pending", "approved", "rejected", "sold", "rented"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** A rejection reason is 1 to 500 characters once trimmed (ADR-064). */
export const REASON_MAX = 500;

/** Rows on one page of the queue; "Show more" reads the next page (plan approved 7 Nov 2026). */
export const QUEUE_PAGE_SIZE = 25;

/** The longest locality the filter accepts, as the listing holds it. */
export const LOCALITY_FILTER_MAX = 80;
