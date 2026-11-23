import { z } from "zod";
import {
  MAIL_BODY_MAX,
  MAIL_SUBJECT_MAX,
  MAIL_TEMPLATE_KINDS,
  mailTemplateProblems,
  type MailTemplate,
  type MailTemplateKind,
  type MailTemplateProblem,
  type MailTemplateProblemReason,
} from "@/lib/mail-template";

/**
 * What the mail editor sends and what a mail's row in `site_settings` holds (ADR-183). A schema message is a key under
 * `validation.*`; the screen looks the words up (ADR-035). The rules themselves are `mailTemplateProblems` in
 * `src/lib/mail-template.ts`, the same ones the mail code applies before it trusts a saved template, so the editor
 * can never save wording the mail would refuse to use.
 */
const MESSAGES: Record<MailTemplateProblemReason, string> = {
  empty: "validation.required",
  tooLong: "validation.tooLong",
  badCharacters: "validation.invalid",
  unknownPlaceholder: "validation.mailPlaceholderUnknown",
  missingPlaceholder: "validation.mailPlaceholderMissing",
};

function addProblems(problems: MailTemplateProblem[], context: z.RefinementCtx) {
  for (const problem of problems) {
    // A box that is too long is reported by the `max` of its own field, which says the limit in its message.
    if (problem.reason === "tooLong") continue;
    context.addIssue({ code: "custom", message: MESSAGES[problem.reason], path: [problem.field] });
  }
}

/** Windows line endings made plain line feeds, and the ends trimmed, as the stored text always has them. */
const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.replace(/\r\n?/g, "\n").trim());

/** One save from the editor: the wording, and whether it goes live now (`publish`) or is kept as a working copy. */
export const mailTemplateInputSchema = z
  .object({
    kind: z.enum(MAIL_TEMPLATE_KINDS, { error: "validation.invalid" }),
    subject: text(MAIL_SUBJECT_MAX),
    body: text(MAIL_BODY_MAX),
    publish: z.boolean({ error: "validation.invalid" }),
  })
  .superRefine((input, context) => {
    addProblems(mailTemplateProblems(input.kind, input), context);
  });
export type MailTemplateInput = z.infer<typeof mailTemplateInputSchema>;

/** One stored version of a mail. `updated` is the day it was published in India; a working copy has none. */
export function storedTemplateSchema(kind: MailTemplateKind) {
  return z
    .object({
      subject: z.string().max(MAIL_SUBJECT_MAX),
      body: z.string().max(MAIL_BODY_MAX),
      updated: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    })
    .superRefine((stored, context) => {
      addProblems(mailTemplateProblems(kind, stored satisfies MailTemplate), context);
    });
}
export type StoredTemplate = z.infer<ReturnType<typeof storedTemplateSchema>>;

/** A mail's row: the wording used when sending, and the working copy the admin is still editing. Either may be absent. */
export function mailRowSchema(kind: MailTemplateKind) {
  return z.object({
    published: storedTemplateSchema(kind).optional(),
    working: storedTemplateSchema(kind).optional(),
  });
}
export type MailRow = z.infer<ReturnType<typeof mailRowSchema>>;
