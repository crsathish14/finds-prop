"use server";

import { defineAction } from "@/server/actions/define-action";
import { submitProjectLeadConfig, trackProjectEventConfig } from "./action-config";
import { recordProjectEvent, submitLead } from "./lead-service";
import { createProjectWriteStore, currentVisitor, verifiedPhoneDigits } from "./service";

/**
 * Sends a lead for a project: an enquiry or a request for a site visit. The caller is a signed-in
 * visitor with a verified phone; the number stored is the account's own, and nothing in the form says
 * who the visitor is (R-BE-03). It answers only that the request was received.
 */
export const submitProjectLead = defineAction({
  ...submitProjectLeadConfig,
  handler: async ({ input, requestId, log }) => {
    const { leadId } = await submitLead(createProjectWriteStore(requestId), {
      input,
      phone: await verifiedPhoneDigits(),
      visitor: await currentVisitor(),
    });
    log.info("project lead stored", { leadId });
    return { received: true as const };
  },
});

/** Records that a project page was opened. Repeats within the hour and projects nobody can see record nothing. */
export const trackProjectEvent = defineAction({
  ...trackProjectEventConfig,
  handler: async ({ input, requestId }) =>
    recordProjectEvent(createProjectWriteStore(requestId), {
      slug: input.slug,
      event: input.event,
      visitor: await currentVisitor(),
    }),
});
