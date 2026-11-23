"use server";

import { after } from "next/server";
import { notifyEnquiryMail } from "@/features/enquiry-mail";
import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { sendEnquiryConfig, setEnquiryStatusConfig } from "./action-config";
import { submitEnquiry } from "./enquiry-service";
import { createEnquiryMailFinder, createEnquiryWriteStore } from "./service";
import { moveEnquiry } from "./status-service";
import { createEnquiryStatusStore } from "./status-store";

/**
 * Sends an enquiry about a home to its owner. The caller is a signed-in visitor with a verified phone;
 * the sender is that account, and nothing in the form says who is sending (BR-50, R-BE-03). It answers
 * only that the enquiry was received. Once it is stored, the mails about it (to the owner, and a confirmation to the
 * sender who typed an email) are handed over after the answer, by id only (ADR-188); a failure there is logged and
 * never changes the answer.
 */
export const sendEnquiry = defineAction({
  ...sendEnquiryConfig,
  handler: async ({ input, session, requestId, log }) => {
    // defineAction has already refused a visitor with no verified phone; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const { enquiryId } = await submitEnquiry(createEnquiryWriteStore(requestId), {
      input,
      userId: session.userId,
      onStored: (storedId) =>
        after(() =>
          notifyEnquiryMail(
            { kind: "enquiry.received", enquiryId: storedId },
            createEnquiryMailFinder(requestId),
            requestId,
          ),
        ),
    });
    log.info("enquiry stored", { enquiryId });
    return { received: true as const };
  },
});

/** The owner of a listing marks an enquiry on it as Contacted or Closed. */
export const setEnquiryStatus = defineAction({
  ...setEnquiryStatusConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await moveEnquiry(await createEnquiryStatusStore(), input);
    log.info("enquiry moved", { enquiryId: done.enquiryId, status: done.status });
    return done;
  },
});
