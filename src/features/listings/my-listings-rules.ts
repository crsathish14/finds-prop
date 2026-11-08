import type { ListingType } from "./constants";
import type { MyListingStatus } from "./view";

/** What the owner can do to a listing from the dashboard. */
export type OwnerAction = "edit" | "close" | "delete";

/** How a listing can be closed: the outcome the database accepts for its kind (ADR-067). */
export type CloseOutcome = "sold" | "rented";

/**
 * The buttons a listing offers, by its state (S6-T03 and S6-T05, FR-ACC-09 to FR-ACC-12): a listing in review,
 * Live or not approved can be edited; only a Live listing can be marked sold or rented; a listing in any state
 * can be deleted. Sold and rented listings are final, so they only offer Delete.
 */
export function ownerActions(status: MyListingStatus): OwnerAction[] {
  if (status === "approved") return ["edit", "close", "delete"];
  if (status === "pending" || status === "rejected") return ["edit", "delete"];
  return ["delete"];
}

/** Where a listing is edited: the wizard, opened on that listing. */
export function editHref(listingId: string): string {
  return `/post-property/${listingId}`;
}

/** A sale is sold and a rental is rented. A listing with no kind cannot be closed. */
export function outcomeFor(listingType: ListingType | null): CloseOutcome | null {
  if (listingType === "sale") return "sold";
  if (listingType === "rent") return "rented";
  return null;
}

/** The state a listing is shown in once it has been closed, before the page is read again. */
export function statusAfterClose(outcome: CloseOutcome): MyListingStatus {
  return outcome;
}

/** Days between a listing's posting and now, never negative (a clock slightly ahead is "today"). */
export function ageInDays(createdAt: string, now: number): number {
  const then = Date.parse(createdAt);
  if (Number.isNaN(then)) return 0;
  return Math.floor(Math.max(0, now - then) / 86_400_000);
}
