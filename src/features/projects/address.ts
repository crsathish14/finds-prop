/**
 * The address of a project page: `/projects/{slug}`. The slug is the project's own, kept by the
 * database in the form `a-b-c` (lower case letters and digits, joined by single dashes, 2 to 80
 * characters), and the database does not let it change once the project has been moderated, so unlike a home
 * there is no separate id in the address.
 */

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MIN = 2;
const SLUG_MAX = 80;

export const PROJECTS_PATH = "/projects";

/** The address of a project's page. */
export function projectPath(slug: string): string {
  return `${PROJECTS_PATH}/${slug}`;
}

/** True for a text the database could hold as a project's slug. */
export function isProjectSlug(text: string): boolean {
  return text.length >= SLUG_MIN && text.length <= SLUG_MAX && SLUG.test(text);
}

/**
 * Reads the last part of the address. Capitals are accepted and read as lower case (the canonical
 * address has none); anything that is not a slug gives null, which is "not found".
 */
export function parseProjectSlug(segment: string): string | null {
  let text: string;
  try {
    text = decodeURIComponent(segment).toLowerCase();
  } catch {
    return null;
  }
  return isProjectSlug(text) ? text : null;
}

/**
 * Where the visitor should be if the address given is not the canonical one (a capital letter, or an
 * encoded character): the stored slug's path. Returns null when the segment already is the slug.
 */
export function canonicalProjectPath(segment: string, storedSlug: string): string | null {
  let given: string;
  try {
    given = decodeURIComponent(segment);
  } catch {
    given = segment;
  }
  return given === storedSlug ? null : projectPath(storedSlug);
}
