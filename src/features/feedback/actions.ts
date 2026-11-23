"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { sendFeedbackConfig, setFeedbackReviewedConfig } from "./action-config";
import { markFeedbackReviewed, sendFeedback as saveFeedback } from "./feedback-service";
import { createFeedbackStore } from "./service";

/** Sends a feedback message to the super admin, as the signed-in builder or agent. */
export const sendFeedback = defineAction({
  ...sendFeedbackConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a builder; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveFeedback(await createFeedbackStore(), input);
    log.info("feedback sent", { feedbackId: done.feedbackId });
    return done;
  },
});

/** Marks one message reviewed or not reviewed, as the signed-in super admin. */
export const setFeedbackReviewed = defineAction({
  ...setFeedbackReviewedConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await markFeedbackReviewed(await createFeedbackStore(), input);
    log.info("feedback review flag changed", {
      feedbackId: done.feedbackId,
      reviewed: done.reviewed,
    });
    return done;
  },
});
