import { createBrowserSupabase } from "@/server/supabase/browser";
import { MEDIA_BUCKET } from "./form";

/**
 * What the form needs from the media bucket (S7-T02, part C): send one file, and take files away. It is a small
 * interface so the tests can give the form their own, and so the form never holds the Supabase client itself.
 */
export interface MediaStorage {
  /** Sends a file to `<project id>/<name>`; true when the bucket kept it. */
  upload(path: string, file: File): Promise<boolean>;
  /** Takes files away. A file that cannot be removed is left; nothing is thrown (it is not referenced any more). */
  remove(paths: readonly string[]): Promise<void>;
}

/**
 * The real one: the signed-in user's own session and the publishable key (never the service role). The bucket's
 * policies allow only the project's own builder or the admin to write under the project's folder, and its limits
 * allow JPG, PNG, WEBP and PDF up to 10 MB; the form checks the same things first so the person is told at once.
 */
export function createMediaStorage(): MediaStorage {
  const bucket = () => createBrowserSupabase().storage.from(MEDIA_BUCKET);
  return {
    async upload(path, file) {
      try {
        const { error } = await bucket().upload(path, file, {
          contentType: file.type,
          // A stored name is unique and never rewritten, so it may be kept for a year.
          cacheControl: "31536000",
          upsert: false,
        });
        return error === null;
      } catch {
        return false;
      }
    },
    async remove(paths) {
      if (paths.length === 0) return;
      try {
        await bucket().remove([...paths]);
      } catch {
        // Left in the bucket; nothing points to it.
      }
    },
  };
}
