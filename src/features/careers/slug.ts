import { slugFromName } from "@/lib/slug";
import { JOB_SLUG_MAX } from "./constants";

/**
 * A suggested slug for a title typed in the editor: lower case words joined by hyphens, accents dropped, cut to the
 * limit. The admin may edit it (ADR-145). Pure, so the browser and the server make the same one.
 */
export function slugFromTitle(title: string): string {
  return slugFromName(title, JOB_SLUG_MAX);
}

/** The slug tried after `base` is taken: `base-2`, `base-3`, and so on, still within the slug limit. */
export function slugWithSuffix(base: string, attempt: number): string {
  const suffix = `-${attempt}`;
  return `${base.slice(0, JOB_SLUG_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
}

/** The slug after the numbered ones are all taken: `base-` and a short random tail, within the slug limit. */
export function slugWithTail(base: string, tail: string): string {
  const suffix = `-${tail}`;
  return `${base.slice(0, JOB_SLUG_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
}
