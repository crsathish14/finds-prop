"use server";

import { defineAction } from "@/server/actions/define-action";
import { submitFormConfig } from "./action-config";
import { submitFormValues } from "./form-service";
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
