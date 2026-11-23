/**
 * The one inline link of a Blog article: `[label](address)` (ADR-169, which amends ADR-144). Everything stored is still
 * plain text; this is the only piece of text that is read as more than words, in a paragraph, a list item and a quote.
 * A link is drawn by React as an anchor, never as HTML (R-SEC-10). Pure: no framework, no storage.
 *
 * What counts as a link is ONE pattern, written so the database can run the same one (`blog_body_text` strips it with
 * `regexp_replace`, and `blog_block_is_valid` refuses a refused link). It only uses what PostgreSQL's regular expressions
 * and JavaScript's share, and a test reads the migration and fails when the two drift:
 *   - the label is 1 to 160 characters, starts with something other than a space, and has no `[`, `]`, `(` or `)`;
 *   - the address is `https://` followed by plain ASCII (no spaces, no control characters, no `( ) [ ] < > " \` and no
 *     letters outside ASCII), or a path of the site itself starting with ONE `/` (never `//`).
 * On top of that, an address is only allowed when `isAllowedLinkUrl` agrees (a host with a dot, at most 2,000
 * characters). A piece of text that looks like a link but is not allowed stays plain text when drawn, and the editor and
 * the schema refuse to SAVE it, with words that say why (`findLinkProblem`).
 */

export const LINK_LABEL_MAX = 160;
export const LINK_URL_MAX = 2000;

/**
 * Printable ASCII except the quotes (`" '`), the brackets (`( ) < > [ ] { }`), `\`, `^`, `` ` `` and `|`: every character a
 * link address may hold. (No quote, so the pattern can sit inside an SQL string unchanged.)
 */
const URL_CHAR = "[!#-&*-;=?-Z_a-z~]";
/** The same without `/`, for the first character of a site path (so `//` is never one). */
const URL_CHAR_NOT_SLASH = "[!#-&*-.0-;=?-Z_a-z~]";

/** The label: no brackets, parentheses or line breaks; the first character is not a space or a tab. */
const LABEL = "[^ \\t\\[\\]()\\r\\n][^\\[\\]()\\r\\n]{0,159}";
const TARGET = `https://${URL_CHAR}+|/(?:${URL_CHAR_NOT_SLASH}${URL_CHAR}*)?`;

/** The pattern of one link, as source text (a test compares it with the migration). */
export const LINK_PATTERN_SOURCE = `\\[(${LABEL})\\]\\((${TARGET})\\)`;
/** Anything shaped like a link, whatever is inside: the editor refuses the ones that are not allowed. */
const CANDIDATE_PATTERN_SOURCE = "\\[([^\\[\\]]*)\\]\\(([^)]*)\\)";

/** An allowed address: `https://` and a host with at least one dot, or a path of this site. */
const EXTERNAL_URL = new RegExp(
  `^https://[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)+(?::[0-9]{1,5})?(?:[/?#]${URL_CHAR}*)?$`,
);
const SITE_PATH = new RegExp(`^/(?:${URL_CHAR_NOT_SLASH}${URL_CHAR}*)?$`);
const LABEL_ONLY = new RegExp(`^${LABEL}$`, "u");

export type InlineNode =
  { kind: "text"; text: string } | { kind: "link"; label: string; href: string; external: boolean };

/** Is this address one a link may point to? (`https://` with a dotted host, or a path of this site.) */
export function isAllowedLinkUrl(url: string): boolean {
  if (url.length === 0 || url.length > LINK_URL_MAX) return false;
  return url.startsWith("/") ? SITE_PATH.test(url) : EXTERNAL_URL.test(url);
}

/** Does this label fit? 1 to 160 characters, no brackets or parentheses, not starting with a space. */
export function isAllowedLinkLabel(label: string): boolean {
  return [...label].length <= LINK_LABEL_MAX && LABEL_ONLY.test(label);
}

/** The text as pieces of words and links, in order. Never throws; refused syntax stays inside a text piece. */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  const pattern = new RegExp(LINK_PATTERN_SOURCE, "gu");
  for (const match of text.matchAll(pattern)) {
    const [whole = "", label = "", address = ""] = match;
    if (!isAllowedLinkUrl(address)) continue;
    const start = match.index ?? 0;
    pushText(nodes, text.slice(last, start));
    nodes.push({ kind: "link", label, href: address, external: !address.startsWith("/") });
    last = start + whole.length;
  }
  pushText(nodes, text.slice(last));
  return nodes;
}

function pushText(nodes: InlineNode[], text: string): void {
  if (text === "") return;
  const previous = nodes[nodes.length - 1];
  if (previous?.kind === "text") previous.text += text;
  else nodes.push({ kind: "text", text });
}

/** The words only: every link becomes its label. This is what the search, the reading time and the AI read. */
export function stripLinks(text: string): string {
  return parseInline(text)
    .map((node) => (node.kind === "text" ? node.text : node.label))
    .join("");
}

export type LinkProblem = "label" | "address" | "tooLong";

/**
 * The first thing wrong with a piece of text that has link-shaped syntax, or null when every link in it is allowed
 * (and when it has none). `[note](below)` is a problem: it looks like a link and would not work as one.
 */
export function findLinkProblem(text: string): LinkProblem | null {
  for (const match of text.matchAll(new RegExp(CANDIDATE_PATTERN_SOURCE, "g"))) {
    const [, label = "", address = ""] = match;
    if (!isAllowedLinkLabel(label)) return "label";
    if (address.length > LINK_URL_MAX) return "tooLong";
    if (!isAllowedLinkUrl(address)) return "address";
  }
  return null;
}

/** Makes `[label](address)` from what the editor's dialog collected, or the problem with it. */
export function buildLink(
  label: string,
  address: string,
): { ok: true; syntax: string } | { ok: false; problem: LinkProblem } {
  const cleanLabel = label.trim().replace(/\s+/g, " ");
  const cleanAddress = address.trim();
  if (!isAllowedLinkLabel(cleanLabel)) return { ok: false, problem: "label" };
  if (cleanAddress.length > LINK_URL_MAX) return { ok: false, problem: "tooLong" };
  if (!isAllowedLinkUrl(cleanAddress)) return { ok: false, problem: "address" };
  return { ok: true, syntax: `[${cleanLabel}](${cleanAddress})` };
}
