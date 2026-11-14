/**
 * The format rule of the output check (ADR-128 section 6.4.2, R-SEC-10): the chat shows plain text, so Markdown and
 * HTML are removed from the answer, silently. A link written as `[label](address)` keeps its label; the address is
 * dropped. (An address in plain text is only ever there if the allow-list let it through.) Applied to one segment
 * at a time, so a mark that opens in one segment and closes in the next is not paired: a stray mark is removed.
 */

const LIST_BULLET = /^([ \t]*)[*+•][ \t]+/gmu;
const HEADING = /^[ \t]{0,3}#{1,6}[ \t]+/gmu;
const QUOTE = /^[ \t]{0,3}>[ \t]?/gmu;
const RULE_LINE = /^[ \t]*([-*_])([ \t]*\1){2,}[ \t]*$/gmu;
const FENCE = /^[ \t]*(```|~~~)[^\n]*$/gmu;
const IMAGE = /!\[([^\]\n]*)\]\([^)\n]*\)/gu;
const LINK = /\[([^\]\n]*)\]\([^)\n]*\)/gu;
const HTML_COMMENT = /<!--[\s\S]*?-->/gu;
const HTML_TAG = /<\/?[a-zA-Z][^>\n]*>/gu;
const BOLD = /(\*\*|__)(?=\S)([^\n]*?\S)\1/gu;
const ITALIC_STAR = /(?<![\p{L}\p{N}*])\*(?=\S)([^*\n]*?\S)\*(?![\p{L}\p{N}*])/gu;
const ITALIC_UNDERSCORE = /(?<![\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}_])/gu;
const STRIKE = /~~(?=\S)([^\n]*?\S)~~/gu;
const INLINE_CODE = /`+/gu;
const STRAY_MARKS = /\*\*|~~/gu;

/** The segment as plain text, and whether anything had to be removed. */
export function stripFormat(segment: string): { text: string; changed: boolean } {
  const text = segment
    .replace(HTML_COMMENT, "")
    .replace(FENCE, "")
    .replace(IMAGE, "$1")
    .replace(LINK, "$1")
    .replace(HTML_TAG, "")
    .replace(RULE_LINE, "")
    .replace(HEADING, "")
    .replace(QUOTE, "")
    .replace(LIST_BULLET, "$1- ")
    .replace(BOLD, "$2")
    .replace(STRIKE, "$1")
    .replace(ITALIC_STAR, "$1")
    .replace(ITALIC_UNDERSCORE, "$1")
    .replace(INLINE_CODE, "")
    .replace(STRAY_MARKS, "");
  return { text, changed: text !== segment };
}
