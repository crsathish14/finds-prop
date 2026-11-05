/**
 * Structured data (JSON-LD) for search engines (FR-PUB-14). This file holds the parts every page
 * shares: the shape of a document, the breadcrumb trail, the postal address and the safe way to write a
 * document into a page. The data of a home and of a project is built next to the feature that owns it.
 * Nothing here ever carries a street address or an exact location: a home's place is its locality,
 * city and state, as on the page itself.
 */

export type JsonLdDocument = Record<string, unknown>;

/** A value that says nothing: null, undefined, an empty text or an empty list. */
function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** The object without its empty values, so a page with no price range or amenity says nothing about it. */
export function compact<T extends Record<string, unknown>>(entries: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(entries).filter(([, value]) => !isEmpty(value)),
  ) as Partial<T>;
}

/** The root every document starts from. */
export const JSON_LD_CONTEXT = "https://schema.org";

export type Crumb = { name: string; url: string };

/** The trail of a page ("Home > Properties > this home"), each step with its whole address. */
export function breadcrumbList(crumbs: readonly Crumb[]): JsonLdDocument {
  return {
    "@context": JSON_LD_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/**
 * A place as a postal address: the locality and city ("Velachery, Chennai") as the locality line, and
 * the state, in India. There is no street line, by design.
 */
export function postalAddress(parts: {
  locality: string | null;
  city?: string | null;
  state?: string | null;
}): JsonLdDocument {
  const line = [parts.locality, parts.city ?? null]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part !== "")
    .join(", ");
  return {
    "@type": "PostalAddress",
    ...compact({ addressLocality: line, addressRegion: parts.state?.trim() ?? null }),
    addressCountry: "IN",
  };
}

/** The characters that must not appear as they are inside a script block: tag marks, `&`, and the two line separators. */
const UNSAFE_IN_SCRIPT = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, "g");

/**
 * The text to put between `<script type="application/ld+json">` tags. `<`, `>` and `&` are written as
 * their unicode escapes, so a title that holds `</script>` can never end the block or start a tag; the
 * line separators JavaScript treats as a newline are escaped too. The result is still the same JSON.
 */
export function serializeJsonLd(document: JsonLdDocument): string {
  return JSON.stringify(document).replace(UNSAFE_IN_SCRIPT, (character) => {
    const code = character.charCodeAt(0).toString(16).padStart(4, "0");
    return String.fromCharCode(92) + "u" + code;
  });
}
