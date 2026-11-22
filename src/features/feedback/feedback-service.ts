import { ActionError } from "@/server/actions/normalise-error";
import type { SendFeedbackInput, SetFeedbackReviewedInput } from "./schemas";

/**
 * The rules of sending and reviewing feedback, apart from the code that reaches the database so they can be tested
 * with a stand-in. The real store is in `service.ts`: it acts as the signed-in user, so the database decides who may
 * send (an active builder or agent) and who may mark (the super admin). The action has already checked the role and
 * counted the rate limit.
 */

export interface FeedbackStore {
  /** Saves a message from the signed-in builder; returns its id. */
  send(message: string): Promise<string>;
  /** Sets the review flag; false when there is no such message. */
  setReviewed(feedbackId: string, reviewed: boolean): Promise<boolean>;
}

export interface FeedbackFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/** Turns what the database raises into the closed set of action errors. */
export function mapFeedbackError(failure: FeedbackFailure): ActionError {
  const { code, message } = failure;
  if (code === "42501" || message === "feedback.not_allowed") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  if (code === "23514" || message === "feedback.invalid_message") {
    return new ActionError("VALIDATION", "That message is not valid", {
      fieldErrors: { message: [{ key: "validation.invalid" }] },
    });
  }
  return new ActionError("INTERNAL", "The feedback could not be saved");
}

export async function sendFeedback(
  store: FeedbackStore,
  input: SendFeedbackInput,
): Promise<{ feedbackId: string }> {
  return { feedbackId: await store.send(input.message) };
}

export async function markFeedbackReviewed(
  store: FeedbackStore,
  input: SetFeedbackReviewedInput,
): Promise<{ feedbackId: string; reviewed: boolean }> {
  const found = await store.setReviewed(input.feedbackId, input.reviewed);
  if (!found) throw new ActionError("NOT_FOUND", "That message was not found");
  return { feedbackId: input.feedbackId, reviewed: input.reviewed };
}
