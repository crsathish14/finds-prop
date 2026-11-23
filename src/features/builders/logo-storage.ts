import { createBrowserSupabase } from "@/server/supabase/browser";
import { BUILDER_LOGO_BUCKET } from "./constants";

/**
 * What the profile page needs from the logo bucket (ADR-179): send one file, and take files away. A small interface,
 * so the tests can give the page their own and the page never holds the Supabase client itself.
 */
export interface LogoStorage {
  /** Sends a file to `<builder id>/<name>`; true when the bucket kept it. */
  upload(path: string, file: File): Promise<boolean>;
  /** Takes files away. A file that cannot be removed is left; nothing is thrown (nothing points to it any more). */
  remove(paths: readonly string[]): Promise<void>;
}

/**
 * The real one: the signed-in builder's own session and the publishable key (never the service role). The bucket's
 * policies let only that builder or the admin write under the builder's folder, and its limits allow JPG, PNG and WEBP
 * up to 1 MB; the page checks the same first so the builder is told at once.
 */
export function createLogoStorage(): LogoStorage {
  const bucket = () => createBrowserSupabase().storage.from(BUILDER_LOGO_BUCKET);
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

/** The file name a new logo is stored under: unique, with the ending of its type. */
export function logoPathFor(builderId: string, file: File, unique: string): string {
  const ending = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return `${builderId}/logo-${unique}.${ending}`;
}
