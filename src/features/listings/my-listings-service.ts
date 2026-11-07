import { ActionError } from "@/server/actions/normalise-error";
import type { CloseListingInput } from "./schemas";

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
