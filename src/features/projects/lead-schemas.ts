import { z } from "zod";
import { isProjectSlug } from "./address";
import { visitDateProblem } from "./lead-view";

/**
 * What a project lead and a project event take from the browser (S4-T09 step D). Nothing here says
 * who is sending: the phone is the signed-in account's own, read on the server, and the visitor is a
 * hash made on the server (R-BE-03, BR-75). A schema message is a key under `validation.*`; the card
 * looks the words up (ADR-035).
 */

export const LEAD_KINDS = ["enquiry", "site_visit"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

/** The lengths the database holds (`project_leads`); the name's lower bound is the sign-in's. */
export const LEAD_NAME_MIN = 2;
export const LEAD_NAME_MAX = 80;
export const LEAD_EMAIL_MAX = 254;
export const LEAD_MESSAGE_MAX = 1000;

const slugField = z
  .string({ error: "validation.invalid" })
  .refine(isProjectSlug, { error: "validation.invalid" });

/** Text typed in a box: empty is the same as not given. */
const blankIsNothing = (typed: string | undefined): string | undefined =>
  typed === undefined || typed === "" ? undefined : typed;

export const submitProjectLeadSchema = z
  .object({
    slug: slugField,
    kind: z.enum(LEAD_KINDS, { error: "validation.invalid" }),
    name: z
      .string({ error: "validation.nameTooShort" })
      .transform((typed) => typed.trim().replace(/\s+/g, " "))
      .pipe(
        z
          .string()
          .min(LEAD_NAME_MIN, { error: "validation.nameTooShort" })
          .max(LEAD_NAME_MAX)
          .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
      ),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(LEAD_EMAIL_MAX, { error: "validation.emailInvalid" })
      .refine((typed) => typed === "" || z.email().safeParse(typed).success, {
        error: "validation.emailInvalid",
      })
      .optional()
      .transform(blankIsNothing),
    message: z.string().trim().max(LEAD_MESSAGE_MAX).optional().transform(blankIsNothing),
    visitDate: z.string().trim().optional().transform(blankIsNothing),
    /** One per form, made in the browser, so a double click or a retry stores one lead. */
    idempotencyKey: z.uuid({ error: "validation.invalid" }),
  })
  .superRefine((value, context) => {
    if (value.kind !== "site_visit") return;
    const problem = visitDateProblem(value.visitDate, new Date());
    if (problem === null) return;
    context.addIssue({
      code: "custom",
      path: ["visitDate"],
      message: problem === "missing" ? "validation.required" : "validation.visitDateRange",
    });
  });

export type SubmitProjectLeadInput = z.infer<typeof submitProjectLeadSchema>;

/** The kinds of event the page records today. The database knows more; each is added with its feature. */
export const TRACKED_EVENTS = ["view"] as const;

export const trackProjectEventSchema = z.object({
  slug: slugField,
  event: z.enum(TRACKED_EVENTS, { error: "validation.invalid" }),
});

export type TrackProjectEventInput = z.infer<typeof trackProjectEventSchema>;
