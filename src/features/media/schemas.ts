import { z } from "zod";
import { PHOTO_MIMES } from "./constants";

/**
 * What the photo actions take from the browser (S6-T01). Nothing here says who is uploading: the owner
 * is the signed-in account, read on the server (R-BE-03). A schema message is a key under
 * `validation.*`; the screen looks the words up (ADR-035). The size is checked in the rules, not
 * here, so the message can name the limit.
 */
/** Lower case, because the folder names the server issues (and the database compares) are lower case. */
const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

/** Asking for an address to upload one photo to. */
export const requestPhotoUploadSchema = z.object({
  listingId: uuid,
  mime: z.enum(PHOTO_MIMES, { error: "validation.photoType" }),
  bytes: z
    .number({ error: "validation.invalid" })
    .int({ error: "validation.invalid" })
    .positive({ error: "validation.invalid" }),
});
export type RequestPhotoUploadInput = z.infer<typeof requestPhotoUploadSchema>;

/**
 * Telling the server the upload is done. The path is the one the server issued; the server checks it
 * again against the account and the listing, so a path for someone else's folder is refused.
 */
export const finalizePhotoSchema = z.object({
  listingId: uuid,
  path: z
    .string({ error: "validation.invalid" })
    .min(1, { error: "validation.invalid" })
    .max(200, { error: "validation.invalid" }),
});
export type FinalizePhotoInput = z.infer<typeof finalizePhotoSchema>;

/** Taking one photo off a listing. */
export const removePhotoSchema = z.object({
  listingId: uuid,
  photoId: uuid,
});
export type RemovePhotoInput = z.infer<typeof removePhotoSchema>;
