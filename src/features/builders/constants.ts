/** The two kinds of staff account the admin invites: a builder or an agent (ADR-010). Both hold the builder role. */
export const BUILDER_KINDS = ["builder", "agent"] as const;
export type BuilderKind = (typeof BUILDER_KINDS)[number];

/** The lengths `builders` holds in the database. */
export const BUILDER_NAME_MIN = 2;
export const BUILDER_NAME_MAX = 120;
export const BUILDER_CONTACT_MAX = 120;
export const BUILDER_LOGO_MAX = 500;
export const BUILDER_WEBSITE_MAX = 300;
export const BUILDER_DESCRIPTION_MAX = 2000;
export const BUILDER_EMAIL_MAX = 254;

/** Where an invited builder signs in (Google only, ADR-010). */
export const BUILDER_SIGN_IN_PATH = "/builder/login";
