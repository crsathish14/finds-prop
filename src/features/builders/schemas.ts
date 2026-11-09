import { z } from "zod";
import {
  BUILDER_CONTACT_MAX,
  BUILDER_DESCRIPTION_MAX,
  BUILDER_EMAIL_MAX,
  BUILDER_KINDS,
  BUILDER_LOGO_MAX,
  BUILDER_NAME_MAX,
  BUILDER_NAME_MIN,
  BUILDER_WEBSITE_MAX,
} from "./constants";

/**
 * What the admin's builder forms take from the browser (S7-T05, FR-ADM-04). A schema message is a key under
 * `validation.*`; the screen looks the words up (ADR-035). Nothing here says who is asking: the admin is the
 * session. Optional boxes left empty are the same as not given.
 */
const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

const tidy = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/[ \t]+/g, " ") : typed;

/** A blank box clears an optional field (null); a field not given is left as it is. */
const clearable = <T extends z.ZodType>(rule: T) =>
  z
    .preprocess(
      (typed) => (typeof typed === "string" && typed.trim() === "" ? null : typed),
      rule.nullable(),
    )
    .optional();

const name = z.preprocess(
  tidy,
  z
    .string({ error: "validation.nameTooShort" })
    .min(BUILDER_NAME_MIN, { error: "validation.nameTooShort" })
    .max(BUILDER_NAME_MAX, { error: "validation.invalid" })
    .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
);

/** The login email: trimmed, lower case, a real address. It is the Google address the builder will sign in with. */
const email = z.preprocess(
  (typed) => (typeof typed === "string" ? typed.trim().toLowerCase() : typed),
  z
    .string({ error: "validation.emailInvalid" })
    .max(BUILDER_EMAIL_MAX, { error: "validation.emailInvalid" })
    .pipe(z.email({ error: "validation.emailInvalid" })),
);

const kind = z.enum(BUILDER_KINDS, { error: "validation.invalid" });

const contactPerson = clearable(
  z.preprocess(tidy, z.string().max(BUILDER_CONTACT_MAX, { error: "validation.invalid" })),
);

/** Digits with an optional leading plus; spaces, dashes and brackets are dropped. */
const phone = clearable(
  z.preprocess(
    (typed) => (typeof typed === "string" ? typed.replace(/[\s\-()]/g, "") : typed),
    z.string().regex(/^\+?[0-9]{6,15}$/, { error: "validation.phoneInvalid" }),
  ),
);

/** Only https links, as the database's own check (`builders_logo_url_check`, `builders_website_check`). */
const link = (max: number) =>
  clearable(
    z
      .string({ error: "validation.invalid" })
      .trim()
      .max(max, { error: "validation.invalid" })
      .regex(/^https:\/\/[^\s]+$/, { error: "validation.invalid" }),
  );

const description = clearable(
  z.preprocess(
    (typed) => (typeof typed === "string" ? typed.trim() : typed),
    z.string().max(BUILDER_DESCRIPTION_MAX, { error: "validation.invalid" }),
  ),
);

/** What a builder may say about their own company (S7-T03): the same boxes, with no type and no email. */
const profile = {
  name,
  contactPerson,
  phone,
  logoUrl: link(BUILDER_LOGO_MAX),
  website: link(BUILDER_WEBSITE_MAX),
  description,
};

const details = { ...profile, kind };

/** The invitation: who they are and the email they will sign in with. */
export const inviteBuilderSchema = z.object({ ...details, email });
export type InviteBuilderInput = z.infer<typeof inviteBuilderSchema>;

/** Edit details. The email is not editable: it is the account's identity. */
export const updateBuilderSchema = z.object({ builderId: uuid, ...details });
export type UpdateBuilderInput = z.infer<typeof updateBuilderSchema>;

export const setBuilderActiveSchema = z.object({
  builderId: uuid,
  active: z.boolean({ error: "validation.invalid" }),
});
export type SetBuilderActiveInput = z.infer<typeof setBuilderActiveSchema>;

export const resendInvitationSchema = z.object({ builderId: uuid });
export type ResendInvitationInput = z.infer<typeof resendInvitationSchema>;

/** The builder's own company profile (S7-T03, FR-BLD-05). Whose profile is the session, never an input. */
export const updateMyProfileSchema = z.object(profile);
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
