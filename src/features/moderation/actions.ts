"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { moderateListingConfig } from "./action-config";
import { decideListing } from "./moderation-service";
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
