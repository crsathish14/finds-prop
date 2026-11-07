import {
  createDraftSchema,
  deleteDraftSchema,
  saveDraftSchema,
  submitListingSchema,
  type CreateDraftInput,
  type SubmitListingInput,
} from "./schemas";

/**
 * How the wizard's actions run, kept apart from the "use server" file so a test can build them (S6-T02).
 * All four need a signed-in account with a verified phone, the same rule as the insert policy on
 * `properties`. Starting a draft is limited to 10 per user per day (`listing_create`, plan 07 section 11) and
 * carries a one-time key so a double click starts one draft; the database trigger adds the limit of five
 * open listings (DEC-26). Saving and deleting a draft touch only the caller's own draft and are bounded by
 * that limit of five. Submitting carries a key too; the move to Pending is a database function that
 * checks the owner, the fields, the photo and the limit. A pending listing is not public, so nothing is
 * refreshed on the site, and the change is recorded in the audit log by the database.
 */
export const createDraftConfig = {
  name: "createListingDraft",
  input: createDraftSchema,
  auth: "verified-phone" as const,
  rateLimit: { scope: "listing_create" as const },
  idempotencyKey: (input: CreateDraftInput) => input.idempotencyKey,
};

export const saveDraftConfig = {
  name: "saveListingDraft",
  input: saveDraftSchema,
  auth: "verified-phone" as const,
};

export const deleteDraftConfig = {
  name: "deleteListingDraft",
  input: deleteDraftSchema,
  auth: "verified-phone" as const,
};

export const submitListingConfig = {
  name: "submitListing",
  input: submitListingSchema,
  auth: "verified-phone" as const,
  idempotencyKey: (input: SubmitListingInput) => input.idempotencyKey,
};
