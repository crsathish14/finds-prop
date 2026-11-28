/**
 * The links under an answer that name where a content answer came from (ADR-143 section 6.5): an article of the Blog, a
 * question of the FAQ and a job of Careers. The model never writes one. A tool
 * returns the id of what it read; the server builds the address here from that id, and the chat draws it as a source.
 * A link the model wrote is dropped by the output check unless it is exactly one of these built for this message
 * (`guards/output.ts`), and the browser draws only an address that `isSourcePath` accepts.
 *
 * No server-only code: the chat island imports this file for `isSourcePath`.
 */
import { AI_MAX_SOURCES_PER_ANSWER } from "@/config/ai";
import type { SourceReference, ToolReference } from "./tools/types";
import { webSourceHref } from "./trusted-sites";

/** A word of an address as the database writes it: lower case words joined by single hyphens. */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The longest address word the Blog accepts (`BLOG_SLUG_MAX`, ADR-144) and the Careers address will. */
const SLUG_MAX_CHARACTERS = 120;

function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX_CHARACTERS && SLUG.test(value);
}

/**
 * The address of a source, or null when its id does not have the shape of one (a malformed id never becomes a link).
 * An article is `/blog/<slug>`, a question is `/faq#faq-<id>` (the FAQ page's own anchor), a job is `/careers/<slug>`.
 */
export function sourceHref(reference: SourceReference): string | null {
  switch (reference.kind) {
    case "article":
      return isSlug(reference.slug) ? `/blog/${reference.slug}` : null;
    case "faq":
      return UUID.test(reference.id) ? `/faq#faq-${reference.id}` : null;
    case "job":
      return isSlug(reference.slug) ? `/careers/${reference.slug}` : null;
    case "web":
      return webSourceHref(reference.url);
  }
}

/** Whether an address is one `sourceHref` can build: the only addresses the chat draws as a source. */
export function isSourcePath(path: string): boolean {
  if (path.startsWith("https://")) return webSourceHref(path) !== null;
  if (path.startsWith("/blog/")) return isSlug(path.slice("/blog/".length));
  if (path.startsWith("/careers/")) return isSlug(path.slice("/careers/".length));
  if (path.startsWith("/faq#faq-")) return UUID.test(path.slice("/faq#faq-".length));
  return false;
}

export function isSourceReference(reference: ToolReference): reference is SourceReference {
  return reference.kind === "article" || reference.kind === "faq" || reference.kind === "job";
}

/** The web pages a web answer drew on (ADR-218): drawn under every web answer, whether or not a link was asked for. */
export function webSourcesToShow(references: readonly ToolReference[]): SourceReference[] {
  return references
    .filter((reference): reference is SourceReference => reference.kind === "web")
    .filter((one) => sourceHref(one) !== null)
    .slice(0, AI_MAX_SOURCES_PER_ANSWER);
}

/**
 * The sources an answer draws, from the records the tools named this message: when the assistant read some in full
 * (`get_content_item`), those only; otherwise the best matches of the search, in the order they came. At most
 * `AI_MAX_SOURCES_PER_ANSWER`, each once, and only a record whose address can be built.
 */
export function sourcesToShow(references: readonly ToolReference[]): SourceReference[] {
  const sources = references.filter(isSourceReference).filter((one) => sourceHref(one) !== null);
  const opened = sources.filter((one) => one.opened);
  return (opened.length > 0 ? opened : sources).slice(0, AI_MAX_SOURCES_PER_ANSWER);
}
