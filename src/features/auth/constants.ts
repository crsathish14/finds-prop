/** A new code may be requested this many seconds after the last one (FR-AUTH-01, ADD-02). */
export const RESEND_AFTER_SECONDS = 60;

/** A name is 2 to 80 characters (ADD-04). The database allows 1 to 120, so this is the stricter rule. */
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;

/** The code is six digits (ADD-02). */
export const CODE_LENGTH = 6;

/**
 * How long a code works, as the screen words it ("Codes work for 5 minutes"). The Supabase project's
 * code expiry must be set to the same value (300 seconds, owner setting). Supabase answers a wrong
 * code and an expired one with the same error, so the screen calls a refused code "expired" only
 * when this long has passed since it asked for one.
 */
export const CODE_LIFETIME_SECONDS = 300;
