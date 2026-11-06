import { z } from "zod";
import { isShortId } from "@/lib/short-id";

/**
 * What an enquiry takes from the browser (S5-T03). Nothing here says who is sending: the sender is the
 * signed-in account, read on the server (BR-50, R-BE-03). The lengths are the ones `enquiries` holds in
 * the database. A schema message is a key under `validation.*`; the card looks the words up (ADR-035).
 */
export const ENQUIRY_NAME_MIN = 2;
export const ENQUIRY_NAME_MAX = 80;
export const ENQUIRY_EMAIL_MAX = 254;
export const ENQUIRY_MESSAGE_MAX = 1000;
export const ENQUIRY_PHONE_PATTERN = /^[0-9]{6,15}$/;

/** Text typed in a box: empty is the same as not given. */
const blankIsNothing = (typed: string | undefined): string | undefined =>
  typed === undefined || typed === "" ? undefined : typed;

export const sendEnquirySchema = z.object({
  /** The home, by the public id in its address. */
  shortId: z.string({ error: "validation.invalid" }).refine(isShortId, {
    error: "validation.invalid",
  }),
  name: z
    .string({ error: "validation.nameTooShort" })
    .transform((typed) => typed.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(ENQUIRY_NAME_MIN, { error: "validation.nameTooShort" })
        .max(ENQUIRY_NAME_MAX)
        .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
    ),
  /** A plain number of 6 to 15 digits; spaces, dashes, brackets and a leading plus are dropped. */
  phone: z
    .string({ error: "validation.phoneInvalid" })
    .transform((typed) => typed.replace(/[\s\-()]/g, "").replace(/^\+/, ""))
    .pipe(z.string().regex(ENQUIRY_PHONE_PATTERN, { error: "validation.phoneInvalid" })),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(ENQUIRY_EMAIL_MAX, { error: "validation.emailInvalid" })
    .refine((typed) => typed === "" || z.email().safeParse(typed).success, {
      error: "validation.emailInvalid",
    })
    .optional()
    .transform(blankIsNothing),
  message: z.string().trim().max(ENQUIRY_MESSAGE_MAX).optional().transform(blankIsNothing),
  /** One per form, made in the browser, so a double click or a retry stores one enquiry. */
  idempotencyKey: z.uuid({ error: "validation.invalid" }),
});

export type SendEnquiryInput = z.infer<typeof sendEnquirySchema>;
