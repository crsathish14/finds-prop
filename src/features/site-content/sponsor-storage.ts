import { createBrowserSupabase } from "@/server/supabase/browser";
import { SPONSOR_IMAGE_BUCKET } from "./constants";

/**
 * What the sponsor manager needs from the public bucket (S7-T11, FR-ADM-11): send one picture, and take pictures away
 * again when the save that would have used them fails. A small interface so the tests can give the page their own,
 * and so the page never holds the Supabase client itself.
 */
export interface SponsorStorage {
  /** Sends a file to `path` (under `sponsors/<id>/`); true when the bucket kept it. */
  upload(path: string, file: File): Promise<boolean>;
  /** Takes files away. A file that cannot be removed is left; nothing is thrown (nothing points to it). */
  remove(paths: readonly string[]): Promise<void>;
}

/**
 * The real one: the signed-in admin's own session and the publishable key (never the service role). The bucket's
 * policies let only the super admin write, and its own limits refuse anything but JPG, PNG and WEBP up to 500 KB; the
 * page checks the tighter screen rules first (150 KB, twice the slot, the shape), and the save action reads every new
 * file back and checks it again.
 */
export function createSponsorStorage(): SponsorStorage {
  const bucket = () => createBrowserSupabase().storage.from(SPONSOR_IMAGE_BUCKET);
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
