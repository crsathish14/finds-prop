"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { sendEnquiryConfig } from "./action-config";
import { submitEnquiry } from "./enquiry-service";
import { createEnquiryWriteStore } from "./service";

/**
 * Sends an enquiry about a home to its owner. The caller is a signed-in visitor with a verified phone;
 * the sender is that account, and nothing in the form says who is sending (BR-50, R-BE-03). It answers
 * only that the enquiry was received.
 */
export const sendEnquiry = defineAction({
  ...sendEnquiryConfig,
  handler: async ({ input, session, requestId, log }) => {
    // defineAction has already refused a visitor with no verified phone; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const { enquiryId } = await submitEnquiry(createEnquiryWriteStore(requestId), {
      input,
      userId: session.userId,
    });
    log.info("enquiry stored", { enquiryId });
    return { received: true as const };
  },
});
