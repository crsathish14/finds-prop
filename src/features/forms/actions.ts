"use server";

import { after } from "next/server";
import { deliverSubmissionNow } from "@/features/crm";
import { defineAction } from "@/server/actions/define-action";
import { verifiedPhoneDigits } from "@/server/auth/verified-phone";
import { submitFormConfig, submitProjectFormConfig } from "./action-config";
import { submitFormValues, submitProjectFormValues } from "./form-service";
import { createFormWriteStore, currentVisitor } from "./service";

/**
 * Sends a form: the answers are checked on the server against the form's stored fields, then stored. It
 * answers only that the submission was received; the form's own success text is on the form. A form with a CRM
 * connection is then sent to it after the answer, so the visitor never waits for the CRM (S7-T09).
 */
export const submitForm = defineAction({
  ...submitFormConfig,
  handler: async ({ input, requestId, log }) => {
    const { submissionId } = await submitFormValues(createFormWriteStore(requestId), {
      input,
      visitor: await currentVisitor(),
    });
    log.info("form submission stored", { submissionId });
    after(() => deliverSubmissionNow(submissionId, requestId));
    return { received: true as const };
  },
});

/**
 * Sends the form a project page shows. The caller is a signed-in visitor with a verified phone; the form
 * is found by the project, the answers are checked against it, and the phone stored is the account's own
 * (R-BE-03). It answers only that the submission was received.
 */
export const submitProjectForm = defineAction({
  ...submitProjectFormConfig,
  handler: async ({ input, requestId, log }) => {
    const { submissionId } = await submitProjectFormValues(createFormWriteStore(requestId), {
      input,
      phone: await verifiedPhoneDigits(),
      visitor: await currentVisitor(),
    });
    log.info("project form submission stored", { submissionId });
    after(() => deliverSubmissionNow(submissionId, requestId));
    return { received: true as const };
  },
});
