import type { BlogBlock } from "@/components/domain/blog-blocks";
import {
  findLinkProblem,
  isAllowedLinkLabel,
  isAllowedLinkUrl,
  stripLinks,
} from "@/lib/inline-links";
import {
  BLOCKS_BYTES_MAX,
  BLOCKS_MAX,
  BLOG_ALT_MAX,
  BLOG_EXCERPT_MAX,
  BLOG_PICTURE_SLOT,
  HEADING_MAX,
  LIST_ITEMS_MAX,
  MARKDOWN_MAX_CHARS,
  LIST_ITEM_MAX,
  PARAGRAPH_MAX,
  QUOTE_CITE_MAX,
  QUOTE_MAX,
} from "../constants";
import { slugFromTitle } from "../slug";

/**
 * The Markdown paste flow's converter (ADR-172): Markdown text in, article blocks out. Pure: no framework, no storage, no
 * dependency (our own small parser, so there is nothing to sanitise and every block is one the article format already
 * has). The browser runs it for the live preview and the server runs it again when the draft is made, and the blocks
 * are then checked by the same Zod schema as any saved article, so what the preview showed is what is stored.
 *
 * Supported: `#` title (the first one is the article's title), `##` and `###` headings, paragraphs, bullet and numbered
 * lists, `>` quotes (a last `— Name` line is the credit) and `[label](address)` links under ADR-169's rules. Everything
 * else is kept as plain words where there are words to keep, and each loss is reported as a warning that names the
 * line, so nothing disappears quietly. The text is never stored: only the blocks it made.
 *
 * To remove the whole Markdown flow later: delete this folder and `components/domain/blog-markdown-flow*.tsx` and the
 * chooser's second card (ADR-172 lists the places). Nothing else imports this folder.
 */

export { MARKDOWN_MAX_CHARS };

export type MarkdownWarningCode =
  | "titleLater"
  | "headingDeep"
  | "headingLink"
  | "nestedList"
  | "formatting"
  | "linkDropped"
  | "codeBlock"
  | "table"
  | "image"
  | "html"
  | "split"
  | "rule"
  | "imageFromAddress"
  | "imageSlotEmpty"
  | "imageSlotRepeated";

export type MarkdownErrorCode = "headingTooLong" | "tooManyBlocks" | "tooBig" | "inputTooBig";

/** What was changed and where: `line` is the 1-based line of the pasted text, `detail` names what was lost. */
export type MarkdownWarning = {
  code: MarkdownWarningCode;
  line: number | null;
  detail?: string;
  count?: number;
};
/** A problem that stops the draft being made. */
export type MarkdownError = {
  code: MarkdownErrorCode;
  line: number | null;
  detail?: string;
  count?: number;
};

/** A place for a picture in the pasted text (ADR-173): a line that is only `![what it shows](IMAGE-1)`. */
export type MarkdownSlot = {
  /** `IMAGE-1`. */
  id: string;
  /** What the pasted text said the picture shows (may be empty); the admin may change it. */
  alt: string;
  line: number;
  /** Set when the pasted line pointed at an address (not an `IMAGE-n` name): that address is never fetched. */
  address?: string;
};

/** A picture the admin chose for a place: where its file is (a stored path, or any name for the preview) and what it shows. */
export type MarkdownPicture = { path: string; alt: string };

export type MarkdownConversion = {
  blocks: BlogBlock[];
  /** Every place for a picture, in the order of the text, whether or not a picture was chosen for it. */
  slots: MarkdownSlot[];
  /** The first `# Title` line, or "". */
  title: string;
  /** The address `slugFromTitle` makes of the title, or "". */
  slug: string;
  /** The first paragraph as plain words (no link syntax), cut to the excerpt limit, or "". */
  excerpt: string;
  warnings: MarkdownWarning[];
  errors: MarkdownError[];
};

/** Private-use characters stand in for text that must not be read as Markdown while the rest is worked on. */
const OPEN = String.fromCharCode(0xe000);
const CLOSE = String.fromCharCode(0xe001);
const ESCAPE_BASE = 0xe100;
const ESCAPABLE = "\\`*_{}[]()#+-.!|>~<";
const PRIVATE_USE = new RegExp("[\\uE000-\\uE1FF]", "g");
const RESTORE_ESCAPE = new RegExp("[\\uE100-\\uE1FF]", "g");
const RESTORE_ADDRESS = new RegExp(`${OPEN}(\\d+)${CLOSE}`, "g");
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!|><~])/g;

const CANDIDATE = /\[([^[\]]*)\]\(([^)]*)\)/g;
const IMAGE = /!\[([^\]]*)\]\(([^)]*)\)/g;
const TAG = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g;
const HIDDEN_BLOCKS = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;
const AUTOLINK = /<(https:\/\/[^\s<>]+)>/g;

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}>/;
/** A line that is only a picture: its description and its address (an `IMAGE-n` name, or any address). */
const PICTURE_LINE = /^ {0,3}!\[([^\]]*)\]\(([^)]*)\)[ \t]*$/;
const LIST = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(\S.*)$/;
const TABLE_SEPARATOR = /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/;
const CITE = /^(?:—|–|―|--)[ \t]*(\S.*)$/;

type Context = {
  warnings: MarkdownWarning[];
  errors: MarkdownError[];
  /** How many pieces of formatting (bold, italic, code, strike) were removed: ONE summary warning at the end. */
  formatting: number;
  rules: number;
};

function warn(
  context: Context,
  code: MarkdownWarningCode,
  line: number | null,
  extra: { detail?: string; count?: number } = {},
): void {
  context.warnings.push({ code, line, ...extra });
}

const shorten = (text: string, max = 60): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

/** The address of a `[label](address "title")`: the title part is dropped, `<...>` brackets are taken off. */
function addressOf(raw: string): string {
  const text = raw.trim();
  const spaced = /^(\S+)[ \t]+["'(].*$/.exec(text);
  const first = spaced?.[1] ?? text;
  return first.startsWith("<") && first.endsWith(">") ? first.slice(1, -1) : first;
}

/**
 * Every `[label](address)`-shaped piece of the text: an allowed one is kept (cleaned), anything else becomes its label
 * alone with a warning. Run again until nothing changes, because taking a link out can leave `[` `]` next to each other.
 */
function resolveLinks(
  text: string,
  line: number,
  context: Context,
  keepLinks: boolean,
  announce: boolean,
): string {
  let current = text;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = current.replace(
      CANDIDATE,
      (whole: string, rawLabel: string, rawAddress: string) => {
        const label = rawLabel.trim().replace(/\s+/g, " ");
        const address = addressOf(rawAddress);
        if (keepLinks && isAllowedLinkLabel(label) && isAllowedLinkUrl(address)) {
          return `[${label}](${address})`;
        }
        if (announce) {
          if (keepLinks) warn(context, "linkDropped", line, { detail: shorten(rawAddress.trim()) });
          else warn(context, "headingLink", line);
        }
        return label;
      },
    );
    if (next === current) break;
    current = next;
    announce = false;
  }
  return keepLinks && findLinkProblem(current) !== null ? current.replace(/[[\]]/g, "") : current;
}

/** Bold, italic, strike and code markers off the words (the words stay); counts what it took off. */
const FORMATTING: readonly RegExp[] = [
  /`+([^`]+?)`+/g,
  /~~(?=\S)(.+?)(?<=\S)~~/g,
  /\*\*(?=\S)(.+?)(?<=\S)\*\*/g,
  /(?<![A-Za-z0-9_])__(?=\S)(.+?)(?<=\S)__(?![A-Za-z0-9_])/g,
  /(?<!\*)\*(?=[^\s*])([^*]+?)(?<=[^\s*])\*(?!\*)/g,
  /(?<![A-Za-z0-9_])_(?=[^\s_])([^_]+?)(?<=[^\s_])_(?![A-Za-z0-9_])/g,
];

function stripFormatting(text: string, context: Context): string {
  let result = text;
  for (const pattern of FORMATTING) {
    result = result.replace(pattern, (_whole: string, inner: string) => {
      context.formatting += 1;
      return inner;
    });
  }
  return result;
}

/**
 * One inline run of Markdown as plain words. `keepLinks` is false for a heading, a credit and a title: they never hold
 * links, so a link there leaves its label. `literal` (fenced code) skips the Markdown reading and only settles links.
 */
function inline(
  raw: string,
  line: number,
  context: Context,
  options: { keepLinks: boolean; literal?: boolean },
): string {
  const addresses: string[] = [];
  let text = raw.replace(PRIVATE_USE, "");

  if (!options.literal) {
    let changedHtml = false;
    const markHtml = (replacement: string) => (): string => {
      changedHtml = true;
      return replacement;
    };
    text = text
      .replace(COMMENT, markHtml(""))
      .replace(HIDDEN_BLOCKS, markHtml(""))
      .replace(AUTOLINK, "$1")
      .replace(TAG, markHtml(""));
    if (changedHtml) warn(context, "html", line);
    text = text.replace(IMAGE, (_whole: string, alt: string, address: string) => {
      warn(context, "image", line, { detail: shorten(alt.trim() || address.trim()) });
      return alt;
    });
  }

  // A backslash before a mark makes it a plain character: set it aside until the end.
  text = text.replace(ESCAPED, (_whole: string, char: string) =>
    String.fromCharCode(ESCAPE_BASE + ESCAPABLE.indexOf(char)),
  );
  // Addresses are set aside so a `*` or `_` inside one is never read as formatting.
  text = text.replace(
    CANDIDATE,
    (_whole: string, label: string, address: string) =>
      `[${label}](${OPEN}${addresses.push(address) - 1}${CLOSE})`,
  );
  if (!options.literal) text = stripFormatting(text, context);

  text = text
    .replace(RESTORE_ADDRESS, (_whole: string, index: string) => addresses[Number(index)] ?? "")
    .replace(RESTORE_ESCAPE, (char: string) => ESCAPABLE[char.charCodeAt(0) - ESCAPE_BASE] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return resolveLinks(text, line, context, options.keepLinks, true);
}

/** The places of the text that a cut must not fall inside: each `[label](address)`. */
function linkSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  for (const match of text.matchAll(CANDIDATE)) {
    const start = match.index ?? 0;
    spans.push([start, start + match[0].length]);
  }
  return spans;
}

/**
 * Cuts a long text into pieces of at most `max` characters: at the last sentence end in the second half of the piece when
 * there is one, otherwise at the last space, otherwise (one very long word) anywhere. Never inside a link; a link longer
 * than `max` becomes its label first.
 */
function splitText(input: string, max: number, line: number, context: Context): string[] {
  if (input.length <= max) return [input];
  let text = input;
  for (const [start, end] of linkSpans(text).reverse()) {
    if (end - start > max) {
      const label = /^\[([^\]]*)\]/.exec(text.slice(start, end))?.[1] ?? "";
      warn(context, "linkDropped", line, { detail: shorten(text.slice(start, end)) });
      text = `${text.slice(0, start)}${label}${text.slice(end)}`;
    }
  }
  const spans = linkSpans(text);
  const inside = (index: number): boolean => spans.some(([from, to]) => index > from && index < to);
  const pieces: string[] = [];
  let start = 0;
  while (text.length - start > max) {
    const limit = start + max;
    let sentence = -1;
    let space = -1;
    for (let index = limit; index > start; index -= 1) {
      if (inside(index)) continue;
      const boundary = /\s/.test(text.charAt(index));
      if (!boundary) continue;
      if (space === -1) space = index;
      if (/[.!?]/.test(text.charAt(index - 1))) {
        sentence = index;
        break;
      }
    }
    let cut = sentence > start + max / 2 ? sentence : space;
    if (cut <= start) {
      cut = limit;
      if (/[\uD800-\uDBFF]/.test(text.charAt(cut - 1))) cut -= 1;
    }
    pieces.push(text.slice(start, cut).trim());
    start = cut;
    while (/\s/.test(text.charAt(start))) start += 1;
  }
  const rest = text.slice(start).trim();
  if (rest !== "") pieces.push(rest);
  return pieces.filter((piece) => piece !== "");
}

const indentOf = (line: string): number => {
  let width = 0;
  for (const char of line) {
    if (char === " ") width += 1;
    else if (char === "\t") width += 4;
    else break;
  }
  return width;
};

/** The first words of an article's first paragraph as plain words, cut at a word to the excerpt limit. */
function excerptOf(blocks: readonly BlogBlock[]): string {
  const first = blocks.find((block) => block.type === "paragraph");
  if (!first || first.type !== "paragraph") return "";
  const text = stripLinks(first.text).replace(/\s+/g, " ").trim();
  if (text.length <= BLOG_EXCERPT_MAX) return text;
  const cut = text.slice(0, BLOG_EXCERPT_MAX - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > BLOG_EXCERPT_MAX / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Splits one table row into its cells. */
function cellsOf(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|");
}

/**
 * Pictures (ADR-173): a line that is only `![what it shows](IMAGE-1)` is a place for a picture. `pictures` holds the
 * ones the admin has chosen so far, by place name; a place with a picture becomes an image block at that spot, a place
 * without one is left out (with a note). A picture line that points at any other address becomes a place too, named
 * for it here: the address is never fetched (no picture is read from the internet), the admin chooses the file.
 */
export function convertMarkdown(
  source: string,
  pictures: Readonly<Record<string, MarkdownPicture>> = {},
): MarkdownConversion {
  const context: Context = { warnings: [], errors: [], formatting: 0, rules: 0 };
  const blocks: BlogBlock[] = [];
  const slots: MarkdownSlot[] = [];
  let title = "";

  if (source.length > MARKDOWN_MAX_CHARS) {
    context.errors.push({ code: "inputTooBig", line: null, count: MARKDOWN_MAX_CHARS });
    return { blocks, slots, title, slug: "", excerpt: "", warnings: [], errors: context.errors };
  }

  const lines = (source.charCodeAt(0) === 0xfeff ? source.slice(1) : source)
    .replace(/\r\n?/g, "\n")
    .split("\n");

  // The names the text gives its pictures are kept for them; a picture with another address gets the next free one.
  const named = new Set<string>();
  for (const text of lines) {
    const address = PICTURE_LINE.exec(text)?.[2];
    if (address !== undefined && BLOG_PICTURE_SLOT.test(addressOf(address)))
      named.add(addressOf(address));
  }
  const used = new Set<string>();
  let counter = 0;
  const freshName = (): string => {
    do counter += 1;
    while (named.has(`IMAGE-${counter}`) || used.has(`IMAGE-${counter}`));
    return `IMAGE-${counter}`;
  };

  const startsBlock = (index: number): boolean => {
    const line = lines[index] ?? "";
    if (PICTURE_LINE.test(line)) return true;
    if (FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line)) return true;
    const item = LIST.exec(line);
    if (item && (/^[-*+]$/.test(item[2] ?? "") || /^1[.)]$/.test(item[2] ?? ""))) return true;
    return (
      line.includes("|") &&
      TABLE_SEPARATOR.test(lines[index + 1] ?? "") &&
      (lines[index + 1] ?? "").includes("|")
    );
  };

  const addParagraphs = (text: string, line: number): void => {
    if (text === "") return;
    const pieces = splitText(text, PARAGRAPH_MAX, line, context);
    if (pieces.length > 1)
      warn(context, "split", line, { detail: "paragraph", count: pieces.length });
    for (const piece of pieces) blocks.push({ type: "paragraph", text: piece });
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    const number = index + 1;

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    // Fenced code: kept as one plain paragraph.
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1] ?? "```";
      const body: string[] = [];
      index += 1;
      while (index < lines.length) {
        const next = lines[index] ?? "";
        const closing = new RegExp(
          `^ {0,3}${marker[0] === "`" ? "`" : "~"}{${marker.length},}[ \\t]*$`,
        );
        index += 1;
        if (closing.test(next)) break;
        body.push(next);
      }
      warn(context, "codeBlock", number);
      addParagraphs(
        resolveLinks(
          body
            .map((part) => part.trim())
            .filter((part) => part !== "")
            .join(" ")
            .replace(PRIVATE_USE, ""),
          number,
          context,
          true,
          false,
        ),
        number,
      );
      continue;
    }

    // A picture on a line of its own: a place for a picture, never read from the address.
    const picture = PICTURE_LINE.exec(line);
    if (picture) {
      index += 1;
      const address = addressOf(picture[2] ?? "");
      const given = BLOG_PICTURE_SLOT.test(address);
      if (given && used.has(address)) {
        warn(context, "imageSlotRepeated", number, { count: Number(address.slice(6)) });
        continue;
      }
      const id = given ? address : freshName();
      used.add(id);
      const alt = inline(picture[1] ?? "", number, context, { keepLinks: false }).slice(
        0,
        BLOG_ALT_MAX,
      );
      slots.push({ id, alt, line: number, ...(given ? {} : { address }) });
      if (!given) {
        warn(context, "imageFromAddress", number, {
          detail: shorten(address, 80),
          count: Number(id.slice(6)),
        });
      }
      const chosen = pictures[id];
      if (chosen) {
        blocks.push({
          type: "image",
          path: chosen.path,
          alt: chosen.alt.replace(/\s+/g, " ").trim(),
        });
      } else {
        warn(context, "imageSlotEmpty", number, { count: Number(id.slice(6)) });
      }
      continue;
    }

    // A heading.
    const heading = HEADING.exec(line);
    if (heading) {
      const hashes = (heading[1] ?? "#").length;
      const words = inline(heading[2] ?? "", number, context, { keepLinks: false });
      index += 1;
      if (words === "") continue;
      if (words.length > HEADING_MAX) {
        context.errors.push({ code: "headingTooLong", line: number, count: words.length });
        continue;
      }
      if (hashes === 1 && title === "") {
        title = words;
        continue;
      }
      if (hashes === 1) warn(context, "titleLater", number);
      if (hashes > 3) warn(context, "headingDeep", number, { count: hashes });
      blocks.push({ type: "heading", level: hashes <= 2 ? 2 : 3, text: words });
      continue;
    }

    // A horizontal rule is dropped.
    if (RULE.test(line)) {
      context.rules += 1;
      index += 1;
      continue;
    }

    // A table: each row becomes one plain paragraph of its cells.
    if (
      line.includes("|") &&
      TABLE_SEPARATOR.test(lines[index + 1] ?? "") &&
      (lines[index + 1] ?? "").includes("|")
    ) {
      warn(context, "table", number);
      const rows: string[] = [line];
      index += 2;
      while (
        index < lines.length &&
        (lines[index] ?? "").trim() !== "" &&
        (lines[index] ?? "").includes("|")
      ) {
        rows.push(lines[index] ?? "");
        index += 1;
      }
      for (const row of rows) {
        const cells = cellsOf(row)
          .map((cell) => inline(cell, number, context, { keepLinks: true }))
          .filter((cell) => cell !== "");
        addParagraphs(cells.join(" · "), number);
      }
      continue;
    }

    // A quote: its lines (a lazy line right after one too), a last `— Name` line is the credit.
    if (QUOTE.test(line)) {
      const parts: string[] = [];
      while (index < lines.length) {
        const next = lines[index] ?? "";
        if (QUOTE.test(next)) parts.push(next.replace(/^(?: {0,3}>[ \t]?)+/, ""));
        else if (
          next.trim() !== "" &&
          !startsBlock(index) &&
          parts.length > 0 &&
          (lines[index - 1] ?? "").trim() !== ""
        )
          parts.push(next);
        else break;
        index += 1;
      }
      const filled = parts.map((part) => part.trim()).filter((part) => part !== "");
      let cite: string | undefined;
      const last = filled[filled.length - 1] ?? "";
      const match = filled.length > 1 ? CITE.exec(last) : null;
      if (match) {
        const credit = inline(match[1] ?? "", number, context, { keepLinks: false });
        if (credit !== "" && credit.length <= QUOTE_CITE_MAX) {
          cite = credit;
          filled.pop();
        }
      }
      const words = inline(filled.join(" "), number, context, { keepLinks: true });
      if (words === "") continue;
      const pieces = splitText(words, QUOTE_MAX, number, context);
      if (pieces.length > 1)
        warn(context, "split", number, { detail: "quote", count: pieces.length });
      pieces.forEach((piece, place) =>
        blocks.push({
          type: "quote",
          text: piece,
          ...(cite !== undefined && place === pieces.length - 1 ? { cite } : {}),
        }),
      );
      continue;
    }

    // A list: bullets or numbers; a nested item is flattened; a line that continues an item joins it.
    const first = LIST.exec(line);
    if (first) {
      const ordered = /^\d/.test(first[2] ?? "");
      const items: string[] = [];
      let nested = 0;
      while (index < lines.length) {
        const next = lines[index] ?? "";
        const item = LIST.exec(next);
        if (item && !RULE.test(next)) {
          const itemOrdered = /^\d/.test(item[2] ?? "");
          const deep = indentOf(item[1] ?? "") >= 2;
          if (!deep && itemOrdered !== ordered) break;
          if (deep) nested += 1;
          items.push(item[3] ?? "");
          index += 1;
        } else if (next.trim() === "") {
          let after = index + 1;
          while (after < lines.length && (lines[after] ?? "").trim() === "") after += 1;
          const following = LIST.exec(lines[after] ?? "");
          if (
            following &&
            !RULE.test(lines[after] ?? "") &&
            (indentOf(following[1] ?? "") >= 2 || /^\d/.test(following[2] ?? "") === ordered)
          )
            index = after;
          else break;
        } else if (!startsBlock(index) || indentOf(next) >= 2) {
          items[items.length - 1] = `${items[items.length - 1] ?? ""} ${next.trim()}`;
          index += 1;
        } else break;
      }
      if (nested > 0) warn(context, "nestedList", number, { count: nested });
      const texts: string[] = [];
      for (const item of items) {
        const words = inline(item, number, context, { keepLinks: true });
        if (words === "") continue;
        const pieces = splitText(words, LIST_ITEM_MAX, number, context);
        if (pieces.length > 1)
          warn(context, "split", number, { detail: "item", count: pieces.length });
        texts.push(...pieces);
      }
      const chunks = Math.ceil(texts.length / LIST_ITEMS_MAX);
      if (chunks > 1) warn(context, "split", number, { detail: "list", count: chunks });
      for (let at = 0; at < texts.length; at += LIST_ITEMS_MAX)
        blocks.push({ type: "list", ordered, items: texts.slice(at, at + LIST_ITEMS_MAX) });
      continue;
    }

    // Anything else is a paragraph: its lines run on until a blank line or the start of another kind of block.
    const parts: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? "").trim() !== "" &&
      (parts.length === 0 || !startsBlock(index))
    ) {
      parts.push((lines[index] ?? "").trim().replace(/\\$/, ""));
      index += 1;
    }
    addParagraphs(inline(parts.join(" "), number, context, { keepLinks: true }), number);
  }

  if (context.formatting > 0) warn(context, "formatting", null, { count: context.formatting });
  if (context.rules > 0) warn(context, "rule", null, { count: context.rules });

  if (blocks.length > BLOCKS_MAX)
    context.errors.push({ code: "tooManyBlocks", line: null, count: blocks.length });
  const bytes = new TextEncoder().encode(JSON.stringify(blocks)).length;
  if (bytes > BLOCKS_BYTES_MAX) context.errors.push({ code: "tooBig", line: null, count: bytes });

  return {
    blocks,
    slots,
    title,
    slug: slugFromTitle(title),
    excerpt: excerptOf(blocks),
    warnings: context.warnings,
    errors: context.errors,
  };
}
