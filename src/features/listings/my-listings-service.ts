import { ActionError } from "@/server/actions/normalise-error";
import { toDraftRow, type DraftRow } from "./listing-service";
import type { CloseListingInput, SaveListingChangesInput } from "./schemas";

/**
 * What an owner does to a listing from the dashboard (S6-T03, FR-ACC-10 and FR-ACC-11), apart from the code
 * that reaches the database so the rules can be tested with a stand-in. The real store is in
 * `my-listings-store.ts` and acts as the signed-in owner, under Row Level Security: nothing here uses the
 * service role. The database holds the rules that must not be walked around (who owns the listing, that only a
 * Live one can be closed and with which outcome, ADR-067); this file turns what it answers into the closed
 * set of action errors, and hands back the short id the cache tags need.
 */

/** What the database answers after closing a listing. */
export interface ClosedListing {
  listingId: string;
  shortId: string;
  status: string;
}

/** Calls made as the signed-in owner. */
export interface MyListingsStore {
  /** Calls `close_listing`. Throws the database's failure through `mapListingError`. */
  close(listingId: string, outcome: CloseListingInput["outcome"]): Promise<ClosedListing>;
  /** Deletes one of the caller's own listings; the short id of what was deleted, or null when there was none. */
  remove(listingId: string): Promise<string | null>;
  /** The caller's own listing as it is now, or null when it is not theirs or does not exist. */
  current(listingId: string): Promise<{ shortId: string; status: string } | null>;
  /**
   * Changes the caller's listing if it is still in the state it was read in; the state after the change (the
   * database may have sent a Live listing back to review), or null when it was no longer in that state.
   */
  update(listingId: string, row: DraftRow, expectedStatus: string): Promise<string | null>;
}

/** The states a listing can be edited in: not a draft (the wizard saves those) and not sold or rented (final). */
const EDITABLE_STATES = ["pending", "approved", "rejected"];

/** What saving changes to a listing came to. */
export interface SavedChanges {
  listingId: string;
  shortId: string;
  /** The state after the save. */
  status: string;
  /** True when a Live listing was sent back to review by this save (DEC-09, policy C). */
  wentBackToReview: boolean;
}

/**
 * Saves changes to a listing that is in review, Live or not approved. Someone else's listing and one that does
 * not exist look the same. A draft is saved by the wizard's own action, and a sold or rented listing is final, so
 * both are a conflict. The database applies policy C: changing a moderated field of a Live listing sends it back
 * to review, and the answer says so, so the screen can tell the owner.
 */
export async function saveOwnChanges(
  store: MyListingsStore,
  input: SaveListingChangesInput,
): Promise<SavedChanges> {
  const found = await store.current(input.listingId);
  if (!found) throw new ActionError("NOT_FOUND", "The listing was not found");
  if (!EDITABLE_STATES.includes(found.status)) {
    throw new ActionError("CONFLICT", "The listing cannot be changed in its state");
  }
  const after = await store.update(input.listingId, toDraftRow(input.fields), found.status);
  if (after === null)
    throw new ActionError("CONFLICT", "The listing changed while it was being saved");
  return {
    listingId: input.listingId,
    shortId: found.shortId,
    status: after,
    wentBackToReview: found.status === "approved" && after === "pending",
  };
}

/** Marks a Live listing sold or rented. */
export async function closeOwnListing(
  store: MyListingsStore,
  input: CloseListingInput,
): Promise<ClosedListing> {
  return store.close(input.listingId, input.outcome);
}

/**
 * Deletes a listing in any state. Someone else's listing and one that does not exist look the same: the
 * caller cannot see it, so nothing is deleted and nothing is found. Its photo files are left to the media
 * sweeper (ADR-058) and its enquiries go with it.
 */
export async function deleteOwnListing(
  store: MyListingsStore,
  parameters: { listingId: string },
): Promise<{ listingId: string; shortId: string }> {
  const shortId = await store.remove(parameters.listingId);
  if (shortId === null) throw new ActionError("NOT_FOUND", "The listing was not found");
  return { listingId: parameters.listingId, shortId };
}
