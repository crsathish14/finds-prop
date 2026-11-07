"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  closeListingConfig,
  createDraftConfig,
  deleteDraftConfig,
  deleteListingConfig,
  saveDraftConfig,
  submitListingConfig,
} from "./action-config";
import { discardDraft, keepDraft, sendForReview, startDraft } from "./listing-service";
import { closeOwnListing, deleteOwnListing } from "./my-listings-service";
import { createMyListingsStore } from "./my-listings-store";
import { createListingCallerStore } from "./service";

/**
 * The first Continue of the wizard: starts a draft owned by the signed-in account with what step 1
 * gave. The owner is the session (nothing in the request says who), and the database refuses a sixth open
 * listing. Answers the new draft's id and public short id.
 */
export const createListingDraft = defineAction({
  ...createDraftConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused a visitor with no verified phone; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await startDraft(await createListingCallerStore(), { fields: input.fields });
    log.info("listing draft started", { listingId: done.listingId });
    return done;
  },
});

/** A later Continue, or "Save draft": changes what the caller's own draft holds. */
export const saveListingDraft = defineAction({
  ...saveDraftConfig,
  handler: async ({ input, session }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    return keepDraft(await createListingCallerStore(), input);
  },
});

/** Deletes one of the caller's drafts. */
export const deleteListingDraft = defineAction({
  ...deleteDraftConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await discardDraft(await createListingCallerStore(), input);
    log.info("listing draft deleted", { listingId: done.listingId });
    return done;
  },
});

/** Sends the caller's draft for review: it becomes Pending and stays hidden until an admin approves it. */
export const submitListing = defineAction({
  ...submitListingConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await sendForReview(await createListingCallerStore(), input);
    log.info("listing submitted", { listingId: done.listingId });
    return done;
  },
});

/** Marks one of the caller's Live listings as sold or rented. It leaves search and its page at once. */
export const closeListing = defineAction({
  ...closeListingConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await closeOwnListing(await createMyListingsStore(), input);
    log.info("listing closed", { listingId: done.listingId, status: done.status });
    return done;
  },
});

/** Deletes one of the caller's listings in any state, with its enquiries; its photo files go to the sweeper. */
export const deleteListing = defineAction({
  ...deleteListingConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await deleteOwnListing(await createMyListingsStore(), input);
    log.info("listing deleted", { listingId: done.listingId });
    return done;
  },
});
