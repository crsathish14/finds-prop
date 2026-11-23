"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { saveMailTemplateConfig } from "./action-config";
import { saveMailTemplate as saveMailTemplateContent } from "./save-service";
import { createMailTemplateStore } from "./store";

/** Saves the wording of one mail: as a working copy, or published now. */
export const saveMailTemplate = defineAction({
  ...saveMailTemplateConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveMailTemplateContent(await createMailTemplateStore(), input);
    log.info("mail wording saved", { mail: done.kind, published: done.published });
    return done;
  },
});
