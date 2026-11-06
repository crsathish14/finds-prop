"use server";

import { defineAction } from "@/server/actions/define-action";
import { verifiedPhoneDigits } from "@/server/auth/verified-phone";
import { submitFormConfig, submitProjectFormConfig } from "./action-config";
import { submitFormValues, submitProjectFormValues } from "./form-service";
import { createFormWriteStore, currentVisitor } from "./service";

/**
 * Sends a form: the answers are checked on the server against the form's stored fields, then stored. It
 * answers only that the submission was received; the form's own success text is on the form.
 */
export const submitForm = defineAction({
  ...submitFormConfig,
  handler: async ({ input, requestId, log }) => {
    const { submissionId } = await submitFormValues(createFormWriteStore(requestId), {
      input,
      visitor: await currentVisitor(),
    });
    log.info("form submission stored", { submissionId });
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
    return { received: true as const };
  },
});
