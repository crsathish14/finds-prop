"use server";

import { defineAction } from "@/server/actions/define-action";
import { trackSponsorEventConfig } from "./action-config";
import { recordSponsorEvent } from "./event-service";
import { createSponsorEventStore, currentVisitor, readLiveSponsors } from "./service";

/** Counts that a paid placement was seen or clicked. A sponsor that is not live, or a repeat that day, counts nothing. */
export const trackSponsorEvent = defineAction({
  ...trackSponsorEventConfig,
  handler: async ({ input, requestId }) =>
    recordSponsorEvent(createSponsorEventStore(requestId), await readLiveSponsors(), {
      slot: input.slot,
      key: input.key,
      kind: input.kind,
      visitor: await currentVisitor(),
    }),
});
