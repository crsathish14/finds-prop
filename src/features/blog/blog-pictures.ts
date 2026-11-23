import { BLOG_IMAGE_MAX_BYTES } from "./constants";

/**
 * Choosing a picture in the Blog editor (ADR-144). The browser checks what it can see at once (the kind the file says it
 * is, and its weight), so the admin is told before anything is sent; the save action still reads every new file back
 * from the bucket and decides from the file's own bytes. No framework code, so it is tested on its own.
 */

/** The kinds the bucket takes (no SVG), and the ending each is stored with. */
const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** What the file input offers in its chooser. */
export const PICTURE_ACCEPT = "image/png,image/jpeg,image/webp";

/** A chosen picture waits under a name like this until the article is saved and its own folder is known. */
const PENDING_PREFIX = "pending/";

export function isPendingPath(path: string): boolean {
  return path.startsWith(PENDING_PREFIX);
}

export function newPendingPath(token: string, extension: string): string {
  return `${PENDING_PREFIX}${token}.${extension}`;
}

/** The ending a file is stored with, or null when its kind is not one the bucket takes. */
export function extensionOf(file: Pick<File, "type">): string | null {
  return EXTENSIONS[file.type] ?? null;
}

/** Why a chosen file cannot be used, or null when it can. */
export function pictureProblem(file: Pick<File, "type" | "size">): "type" | "size" | null {
  if (extensionOf(file) === null) return "type";
  return file.size > BLOG_IMAGE_MAX_BYTES ? "size" : null;
}

/** A short random name (letters and digits only, so a stored name always fits the path rule). */
export function randomToken(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
