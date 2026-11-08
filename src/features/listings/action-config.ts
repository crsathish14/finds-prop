import { tagsAfterListingChange } from "@/lib/cache-tags";
import {
  closeListingSchema,
  createDraftSchema,
  deleteDraftSchema,
  deleteListingSchema,
  saveDraftSchema,
  saveListingChangesSchema,
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

/**
 * Marking a Live listing as sold or rented, and deleting a listing, from the dashboard (S6-T03, FR-ACC-10 and
 * FR-ACC-11). Both need a signed-in account with a verified phone, the same rule as posting. Neither has a rate
 * limit or a key: each works on one listing the caller owns, closing is terminal (a repeated call finds the
 * listing closed and is refused), and a delete of a deleted listing finds nothing. Both change what the public
 * site shows (a closed or deleted home leaves search and its page at once), so the tags of the lists and of that
 * home's page are refreshed, taken from the database's answer. The change is recorded in the audit log by the
 * database triggers, with the owner as the actor.
 */
export const closeListingConfig = {
  name: "closeListing",
  input: closeListingSchema,
  auth: "verified-phone" as const,
  invalidate: (result: { shortId: string }) => tagsAfterListingChange(result.shortId),
};

export const deleteListingConfig = {
  name: "deleteListing",
  input: deleteListingSchema,
  auth: "verified-phone" as const,
  invalidate: (result: { shortId: string }) => tagsAfterListingChange(result.shortId),
};

/**
 * Saving changes to a listing that is in review, Live or not approved (S6-T05, FR-ACC-09). It needs a signed-in
 * account with a verified phone, like the rest. It has no rate limit or key: it changes one listing the caller
 * owns, and the same save twice leaves the same listing. Whatever it changes may be public (a Live listing's
 * price shows on the site at once, and a Live listing whose title, description, kind, type or address changed
 * goes back to review and leaves the site), so the tags of the lists and of that home's page are refreshed, taken
 * from the answer. The change is recorded in the audit log by the database triggers, with the owner as the actor.
 */
export const saveListingChangesConfig = {
  name: "saveListingChanges",
  input: saveListingChangesSchema,
  auth: "verified-phone" as const,
  invalidate: (result: { shortId: string }) => tagsAfterListingChange(result.shortId),
};
