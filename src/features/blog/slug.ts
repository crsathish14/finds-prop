import { BLOG_SLUG_MAX, BLOG_TAG_MAX_LENGTH } from "./constants";

/**
 * A suggested slug for a title typed in the editor: lower case words joined by hyphens, accents dropped, cut to the
 * limit without leaving a hyphen at the end. The admin may edit it (ADR-144). Pure, so the browser and the server
 * make the same one.
 */
export function slugFromTitle(title: string, max: number = BLOG_SLUG_MAX): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}

/** A tag as the database stores it: the same shape as a slug, at most 40 characters. */
export function tagFromText(text: string): string {
  return slugFromTitle(text, BLOG_TAG_MAX_LENGTH);
}

/** The slug tried after `base` is taken: `base-2`, `base-3`, and so on, still within the slug limit. */
export function slugWithSuffix(base: string, attempt: number): string {
  const suffix = `-${attempt}`;
  return `${base.slice(0, BLOG_SLUG_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
}

/** The slug after the numbered ones are all taken: `base-` and a short random tail, within the slug limit. */
export function slugWithTail(base: string, tail: string): string {
  const suffix = `-${tail}`;
  return `${base.slice(0, BLOG_SLUG_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
}
