import { z } from "zod";
import {
  FAQ_ANSWER_MAX,
  FAQ_ANSWER_MIN,
  FAQ_QUESTION_MAX,
  FAQ_QUESTION_MIN,
  FAQ_REORDER_MAX,
  FAQ_SORT_MAX,
  FAQ_STATUSES,
} from "./constants";

/**
 * What the admin's FAQ screens send (ADR-143, FR-ADM-13 to FR-ADM-15). Nothing here says who is saving: the admin is
 * the signed-in session (R-BE-03). A schema message is a key under `validation.*`; where none is given, the failure
 * text is made from the limit (too short, too long) and the screen looks the words up (ADR-035). The limits match the
 * table's checks.
 */
const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

/** A question is one line: spaces are tidied. */
const oneLine = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/\s+/g, " ") : typed;

/**
 * An answer is plain text in paragraphs: line endings are made the same, spaces at the end of a line are dropped and
 * three or more line breaks become one blank line. Nothing is stripped otherwise: the page draws it as text, never as
 * HTML.
 */
const paragraphs = (typed: unknown): unknown =>
  typeof typed === "string"
    ? typed
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : typed;

const details = {
  categoryId: uuid,
  question: z.preprocess(oneLine, z.string().min(FAQ_QUESTION_MIN).max(FAQ_QUESTION_MAX)),
  answer: z.preprocess(paragraphs, z.string().min(FAQ_ANSWER_MIN).max(FAQ_ANSWER_MAX)),
  /** Left out, a new question goes last in its category and a saved one keeps its place. */
  sortOrder: z
    .number({ error: "validation.invalid" })
    .int({ error: "validation.invalid" })
    .min(0, { error: "validation.invalid" })
    .max(FAQ_SORT_MAX, { error: "validation.invalid" })
    .optional(),
  /** Left out, a new question is a draft and a saved one keeps its status. */
  status: z.enum(FAQ_STATUSES, { error: "validation.invalid" }).optional(),
};

/** A new question. */
export const createFaqSchema = z.object(details);
export type CreateFaqInput = z.infer<typeof createFaqSchema>;

/** Changes to a question that is not in the trash. It may move to another FAQ category. */
export const updateFaqSchema = z.object({ faqId: uuid, ...details });
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;

/** Publish, unpublish, trash and restore name the question and nothing else. */
export const faqIdSchema = z.object({ faqId: uuid });
export type FaqIdInput = z.infer<typeof faqIdSchema>;

/** The questions of one category, in the order the admin wants them: 1 to 200, none twice. */
export const reorderFaqsSchema = z.object({
  categoryId: uuid,
  faqIds: z
    .array(uuid, { error: "validation.invalid" })
    .min(1, { error: "validation.invalid" })
    .max(FAQ_REORDER_MAX, { error: "validation.invalid" })
    .refine((ids) => new Set(ids).size === ids.length, { error: "validation.invalid" }),
});
export type ReorderFaqsInput = z.infer<typeof reorderFaqsSchema>;
