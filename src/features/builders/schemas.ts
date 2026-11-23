import { z } from "zod";
import {
  BUILDER_CONTACT_MAX,
  BUILDER_DELIVERED_MAX,
  BUILDER_DESCRIPTION_MAX,
  BUILDER_EMAIL_MAX,
  BUILDER_KINDS,
  BUILDER_LOGO_MAX,
  BUILDER_NAME_MAX,
  BUILDER_NAME_MIN,
  BUILDER_TAGLINE_MAX,
  BUILDER_WEBSITE_MAX,
  BUILDER_YEAR_MIN,
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

/** The spotlight's short line (ADR-179): one line, spaces tidied. */
const tagline = clearable(
  z.preprocess(
    tidy,
    z
      .string({ error: "validation.invalid" })
      .max(BUILDER_TAGLINE_MAX, { error: "validation.invalid" })
      .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
  ),
);

/** A whole number typed in a box ("2001", " 42 "); anything else is left for the rule to refuse. */
const typedNumber = (typed: unknown): unknown => {
  if (typeof typed !== "string") return typed;
  const trimmed = typed.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
};

/** The year the company started: from 1900 to this year (ADR-179). */
const establishedYear = clearable(
  z.preprocess(
    typedNumber,
    z
      .number({ error: "validation.invalid" })
      .int({ error: "validation.invalid" })
      .min(BUILDER_YEAR_MIN, { error: "validation.invalid" })
      .refine((year) => year <= new Date().getFullYear(), { error: "validation.invalid" }),
  ),
);

/** How many projects they have delivered (ADR-179). */
const projectsDelivered = clearable(
  z.preprocess(
    typedNumber,
    z
      .number({ error: "validation.invalid" })
      .int({ error: "validation.invalid" })
      .min(0, { error: "validation.invalid" })
      .max(BUILDER_DELIVERED_MAX, { error: "validation.invalid" }),
  ),
);

/** An uploaded logo: `<builder id>/<file>` in the logo bucket. Whose folder it must be is checked by the save. */
const logoPath = clearable(
  z
    .string({ error: "validation.invalid" })
    .max(200, { error: "validation.invalid" })
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|jpe?g|png)$/,
      {
        error: "validation.invalid",
      },
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
  tagline,
  establishedYear,
  projectsDelivered,
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
export const updateMyProfileSchema = z.object({ ...profile, logoPath });
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
