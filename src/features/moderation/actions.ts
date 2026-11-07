"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { loadMoreListingsConfig, moderateListingConfig } from "./action-config";
import { decodeCursor } from "./cursor";
import { decideListing } from "./moderation-service";
import { getQueuePage } from "./queries";
import { createModerationStore } from "./service";

/**
 * Approves, rejects, features or removes from featured one listing, as the signed-in super admin. Answers the
 * listing's id, short id, new status and featured flag, which is what the queue needs to update its row.
 */
export const moderateListing = defineAction({
  ...moderateListingConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await decideListing(await createModerationStore(), input);
    log.info("listing decided", {
      listingId: done.listingId,
      decision: input.decision,
      status: done.status,
    });
    return done;
  },
});

/** The next page of the queue after the cursor the last page gave, for "Show more". */
export const loadMoreListings = defineAction({
  ...loadMoreListingsConfig,
  handler: async ({ input, session }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    // A cursor this queue did not make would quietly give the first page again, so it is refused.
    if (decodeCursor(input.after) === null) {
      throw new ActionError("VALIDATION", "The page cursor is not valid", {
        fieldErrors: { after: [{ key: "validation.invalid" }] },
      });
    }
    return getQueuePage(input);
  },
});
