"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { saveLegalConfig } from "./action-config";
import { saveLegalContent } from "./save-service";
import { createLegalStore } from "./store";

/** Saves a legal page: as a working copy, or published now with a new "Last updated" day and version. */
export const saveLegal = defineAction({
  ...saveLegalConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveLegalContent(await createLegalStore(), input);
    log.info("legal page saved", { page: done.kind, published: done.published });
    return done;
  },
});
