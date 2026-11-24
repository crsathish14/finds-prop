/**
 * The builders and agents the super admin picks for the two sponsored slots that draw from their own uploads (sponsor
 * ads plan, ADR-191): the Featured project card in the results (C) and the Developer Spotlight on the home page (D).
 * The admin only picks; everything shown comes from what the builder or agent uploaded. With several picked, each
 * visit shows a different one; with one, that one.
 */

/** The most builders or agents each slot may hold. */
export const SPONSORED_BUILDERS_MAX = 10;

/** The two slots. */
export const SPONSORED_SLOTS = ["featured", "spotlight"] as const;
export type SponsoredSlot = (typeof SPONSORED_SLOTS)[number];
