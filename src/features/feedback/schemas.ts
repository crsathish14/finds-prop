import { z } from "zod";
import { FEEDBACK_MESSAGE_MAX, FEEDBACK_STATES } from "./constants";

/**
 * What the feedback forms send. A schema message is a key under `validation.*`; the screen looks the words up
 * (ADR-035). Nothing here says who is asking: the sender is the session.
 */

/** True when the text holds a control character other than a tab or a new line. */
const hasControlCharacter = (text: string): boolean =>
  [...text].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
  });

/** A message: plain text, trimmed, 1 to 1000 characters, no control characters. */
export const sendFeedbackSchema = z.object({
  message: z
    .string({ error: "validation.required" })
    .transform((typed) => typed.trim())
    .pipe(
      z
        .string()
        .min(1, { error: "validation.required" })
        .max(FEEDBACK_MESSAGE_MAX, { error: "validation.invalid" })
        .refine((text) => !hasControlCharacter(text), { error: "validation.invalid" }),
    ),
});
export type SendFeedbackInput = z.infer<typeof sendFeedbackSchema>;

/** The super admin marks one message reviewed or not reviewed. */
export const setFeedbackReviewedSchema = z.object({
  feedbackId: z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase()),
  reviewed: z.boolean({ error: "validation.invalid" }),
});
export type SetFeedbackReviewedInput = z.infer<typeof setFeedbackReviewedSchema>;

const first = (typed: unknown): unknown => (Array.isArray(typed) ? typed[0] : typed);

/** The admin page's address bar (`?state=open&page=2`). A value that is not valid is dropped. */
export const feedbackFilterSchema = z.object({
  state: z.preprocess(first, z.enum(FEEDBACK_STATES)).catch("open"),
  page: z.preprocess((typed) => Number(first(typed)), z.number().int().min(1).max(10000)).catch(1),
});
export type FeedbackFilters = z.infer<typeof feedbackFilterSchema>;
