import { pageAddress } from "./site";

/**
 * A web page's readable text and its links, from its HTML, without running anything (AI search Phase 4). Scripts,
 * styles and other parts a visitor does not read are dropped first, so a page that only fills itself in with scripts
 * gives almost no text, which is how such a page is found. Pure; no library: the result only has to be plain words for
 * the assistant, never HTML put back on a page.
 */

export interface PageLink {
  /** The link's address, made absolute against the page, without a fragment. */
  readonly href: string;
  /** The link's visible words. */
  readonly text: string;
}

export interface PageText {
  readonly title: string;
  readonly text: string;
  readonly links: readonly PageLink[];
}

/** The most links kept from one page, in page order: a menu and a footer are well inside it. */
const LINKS_MAX = 200;
/** The most text kept from one page: what is saved for 7 days and what the assistant can be given. */
export const PAGE_TEXT_MAX = 40_000;
const TITLE_MAX = 300;
const LINK_TEXT_MAX = 200;
const LINK_ADDRESS_MAX = 2000;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  hellip: "...",
  copy: "(c)",
  reg: "(R)",
  trade: "(TM)",
  rupee: "₹",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : " ";
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : " ";
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Text with its tags taken out, entities read and spaces made single. */
function plainOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/[ \t\f\v ]+/g, " ")
    .trim();
}

/** The parts of a page a visitor does not read. */
const HIDDEN_BLOCKS =
  /<(script|style|noscript|svg|template|iframe|object|canvas)\b[\s\S]*?<\/\1\s*>/gi;

/** Tags that start a new line of text. */
const BLOCK_TAGS =
  /<\/?(p|div|br|li|ul|ol|h[1-6]|tr|td|th|table|section|article|header|footer|nav|main|aside|blockquote|dd|dt|dl|figure|figcaption|address|hr)\b[^>]*>/gi;

const LINK_TAG = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
const HREF_ATTRIBUTE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

export function pageTextOf(html: string, pageUrl: string): PageText {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, " ");
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(withoutComments);
  const title = (titleMatch ? plainOf(titleMatch[1] ?? "") : "").slice(0, TITLE_MAX);
  const body = withoutComments
    .replace(/<head\b[\s\S]*?<\/head\s*>/i, " ")
    .replace(HIDDEN_BLOCKS, " ");

  const links: PageLink[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(LINK_TAG)) {
    if (links.length >= LINKS_MAX) break;
    const attributes = match[1] ?? "";
    const found = HREF_ATTRIBUTE.exec(attributes);
    const raw = decodeEntities((found?.[1] ?? found?.[2] ?? found?.[3] ?? "").trim());
    if (raw === "" || raw.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(raw)) continue;
    const href = pageAddress(raw, pageUrl);
    if (href === null || href.length > LINK_ADDRESS_MAX || seen.has(href)) continue;
    seen.add(href);
    links.push({ href, text: plainOf(match[2] ?? "").slice(0, LINK_TEXT_MAX) });
  }

  const text = decodeEntities(body.replace(BLOCK_TAGS, "\n").replace(/<[^>]*>/g, " "))
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v ]+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n")
    .slice(0, PAGE_TEXT_MAX);

  return { title, text, links };
}
