import { tagsAfterListingChange } from "@/lib/cache-tags";
import { finalizePhotoSchema, removePhotoSchema, requestPhotoUploadSchema } from "./schemas";

/**
 * How the photo actions run, kept apart from the "use server" file so a test can build them (S6-T01).
 * All three need a signed-in account with a verified phone, the same rule as posting a listing. Asking
 * for an upload address is limited to 30 per user per hour (plan 07 section 11, `upload_url`); finishing
 * and removing a photo are bounded by that, because each finish follows an address that was issued.
 * Adding or removing a photo on an approved listing sends it back to review (policy C), so the public
 * pages of that home are refreshed.
 */
export const requestPhotoUploadConfig = {
  name: "requestPhotoUpload",
  input: requestPhotoUploadSchema,
  auth: "verified-phone" as const,
  rateLimit: { scope: "upload_url" as const },
};

export const finalizePhotoConfig = {
  name: "finalizePhoto",
  input: finalizePhotoSchema,
  auth: "verified-phone" as const,
  invalidate: (result: { shortId: string }) => tagsAfterListingChange(result.shortId),
};

export const removePhotoConfig = {
  name: "removePhoto",
  input: removePhotoSchema,
  auth: "verified-phone" as const,
  invalidate: (result: { shortId: string }) => tagsAfterListingChange(result.shortId),
};
