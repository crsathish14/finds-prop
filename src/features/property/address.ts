/**
 * The address of a property page: `/properties/{slug}-{shortId}` (ADR-025). The last eight characters
 * are the public id (`short_id`, from a 32-letter alphabet with no look-alike characters); the slug
 * in front of them is only for people and search engines. The page finds the home by the id alone,
 * so a link with an old or hand-edited slug still opens it, and is sent to the canonical address.
 */

import { isShortId } from "@/lib/short-id";

const SLUG = /^[a-z0-9-]{1,100}$/;

export const PROPERTIES_PATH = "/properties";

export type PropertyAddress = { slug: string; shortId: string };

/** The address segment of a home. */
export function propertySegment(slug: string, shortId: string): string {
  return `${slug}-${shortId}`;
}

/** The address of a home's page. */
export function propertyPath(slug: string, shortId: string): string {
  return `${PROPERTIES_PATH}/${propertySegment(slug, shortId)}`;
}

/**
 * Reads the last part of the address. Capitals are accepted and read as lower case (the canonical
 * address has none); anything that is not a slug, a dash and an id gives null, which is "not found".
 */
export function parsePropertyAddress(segment: string): PropertyAddress | null {
  let text: string;
  try {
    text = decodeURIComponent(segment).toLowerCase();
  } catch {
    return null;
  }
  const dash = text.length - 9;
  if (dash < 1 || text[dash] !== "-") return null;
  const slug = text.slice(0, dash);
  const shortId = text.slice(dash + 1);
  if (!isShortId(shortId) || !SLUG.test(slug)) return null;
  return { slug, shortId };
}

/**
 * Where the visitor should be if the address given is not the canonical one: the same id with the
 * stored slug. Returns the canonical path, or null when the segment already is it (what the browser
 * gave, decoded, compared as written, so a capital letter is also sent to the lower-case address).
 */
export function canonicalPropertyPath(segment: string, stored: PropertyAddress): string | null {
  let given: string;
  try {
    given = decodeURIComponent(segment);
  } catch {
    given = segment;
  }
  const canonical = propertySegment(stored.slug, stored.shortId);
  return given === canonical ? null : propertyPath(stored.slug, stored.shortId);
}
