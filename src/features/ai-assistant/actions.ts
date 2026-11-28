"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { saveAiAssistantConfig } from "./action-config";
import { saveAiAssistantSettings } from "./service";

/** Saves the credit bought, as the signed-in super admin (ADR-218, piece 7). */
export const saveAiAssistant = defineAction({
  ...saveAiAssistantConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveAiAssistantSettings(input, session.userId);
    log.info("ai assistant settings saved", { creditSet: done.creditBoughtUsd !== null });
    return done;
  },
});
