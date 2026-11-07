"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { finalizePhotoConfig, removePhotoConfig, requestPhotoUploadConfig } from "./action-config";
import { PHOTO_BUCKET } from "./constants";
import { acceptPhoto, dropPhoto, issuePhotoUpload } from "./media-service";
import { createPhotoCallerStore, createPhotoServerStore } from "./service";

/**
 * Step 1 of adding a photo: asks for a one-time address to upload one file to. The owner is the signed-in
 * account (nothing in the request says who), the listing must be theirs and still open, and the count must
 * have room. The browser resizes and strips the photo, then uploads it to the address.
 */
export const requestPhotoUpload = defineAction({
  ...requestPhotoUploadConfig,
  handler: async ({ input, session }) => {
    // defineAction has already refused a visitor with no verified phone; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const { path, token } = await issuePhotoUpload(await createPhotoCallerStore(), {
      input,
      userId: session.userId,
      newId: () => crypto.randomUUID(),
    });
    return { bucket: PHOTO_BUCKET, path, token };
  },
});

/**
 * Step 2: the upload is done. The server reads the stored file, checks it itself and records the photo,
 * or deletes the file and says why.
 */
export const finalizePhoto = defineAction({
  ...finalizePhotoConfig,
  handler: async ({ input, session, requestId, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await acceptPhoto(
      await createPhotoCallerStore(),
      createPhotoServerStore(requestId),
      {
        input,
        userId: session.userId,
      },
    );
    log.info("photo recorded", { photoId: done.photoId });
    return done;
  },
});

/** Takes one photo off the caller's listing. */
export const removePhoto = defineAction({
  ...removePhotoConfig,
  handler: async ({ input, session, requestId, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    return dropPhoto(await createPhotoCallerStore(), createPhotoServerStore(requestId), {
      input,
      onFileLeft: () => log.warn("photo file left for the sweeper"),
    });
  },
});
