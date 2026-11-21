/**
 * The plain-text helpers of the content tools (ADR-143 section 6.2): the words of a search, the passage a result
 * shows, the sections `get_content_item` hands over, and the day a date is written as. Pure: no framework, no read, so
 * the tests call them directly and the tools and the reads share one set of rules.
 *
 * The search itself is the database's (`search_blog_posts`, `search_faqs`: full-text, ranked by `ts_rank`). What is here
 * only decides which part of a text the model is shown, so a long article never reaches it whole.
 */

/** Words that say nothing about which section is the right one ("what is the stamp duty": "stamp" and "duty" do). */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "can",
  "do",
  "does",
  "for",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "when",
  "which",
  "with",
]);

const WORD = /[\p{L}\p{M}\p{N}]+/gu;

/** The distinct words of a search, lower case, without the very common ones; none when nothing is left. */
export function queryWords(query: string | null): string[] {
  if (query === null) return [];
  const words = new Set<string>();
  for (const match of query.toLowerCase().matchAll(WORD)) {
    const word = match[0];
    if (word.length >= 2 && !STOP_WORDS.has(word)) words.add(word);
  }
  return [...words];
}

/** How many of the words a text holds (each once, as a part of a word, so "registration" holds "registr"). */
export function wordsFound(text: string, words: readonly string[]): number {
  const lower = text.toLowerCase();
  return words.filter((word) => lower.includes(word)).length;
}

/** The text on one line: every run of space, a line break included, as one space. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** At most `max` characters of the text, cut at a word, with an ellipsis where it was cut. */
export function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(1, max - 1));
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * About `max` characters of a text around where the words are: the best-matching paragraph (most of the words, the
 * first on a tie), cut so that the first word found is near the start. No word in it (or none given) shows its
 * beginning. Always one line.
 */
export function passageAround(text: string, words: readonly string[], max: number): string {
  const paragraphs = text.split(/\n{2,}/).filter((paragraph) => paragraph.trim() !== "");
  let best = paragraphs[0] ?? text;
  let bestScore = -1;
  for (const paragraph of paragraphs) {
    const score = wordsFound(paragraph, words);
    if (score > bestScore) {
      best = paragraph;
      bestScore = score;
    }
  }
  const line = oneLine(best);
  if (line.length <= max) return line;
  const lower = line.toLowerCase();
  const first = words
    .map((word) => lower.indexOf(word))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  if (first === undefined || first < max / 4) return cutAtWord(line, max);
  // Start a little before the first match, at a word, and say that the passage begins mid-text.
  const from = line.indexOf(" ", Math.max(0, first - 40));
  const start = from === -1 || from > first ? Math.max(0, first - 40) : from + 1;
  return `…${cutAtWord(line.slice(start), max - 1)}`;
}

/** What `selectSections` gives: the chosen text, and whether the item holds more than it. */
export interface SelectedSections {
  readonly text: string;
  /** True when some of the item's text was left out (a section not chosen, or one cut short). */
  readonly partial: boolean;
}

/** Two sections are joined with a blank line. */
const SECTION_SEPARATOR = "\n\n";

/** A section is only cut short, rather than left out, when at least this much room is left for it. */
const MIN_CUT_ROOM = 200;

/**
 * The sections of one article or question that answer the words best, at most `max` characters in all and never a
 * whole long text. Sections that hold more of the words come first in the choosing; with no words, or none found, the
 * choosing starts from the beginning. The chosen ones are given in the order they are in the item. A section that
 * does not fit is cut at a word when there is room (`MIN_CUT_ROOM`), and left out when there is not.
 */
export function selectSections(
  sections: readonly string[],
  words: readonly string[],
  max: number,
): SelectedSections {
  const cleaned = sections.map((section) => section.trim()).filter((section) => section !== "");
  const scored = cleaned.map((text, index) => ({ text, index, score: wordsFound(text, words) }));
  const anyFound = scored.some((entry) => entry.score > 0);
  const order = anyFound
    ? [...scored].sort((left, right) => right.score - left.score || left.index - right.index)
    : scored;

  const chosen = new Map<number, string>();
  let room = max;
  let partial = false;
  for (const entry of order) {
    const needed = entry.text.length + (chosen.size === 0 ? 0 : SECTION_SEPARATOR.length);
    if (needed <= room) {
      chosen.set(entry.index, entry.text);
      room -= needed;
    } else if (room >= MIN_CUT_ROOM || chosen.size === 0) {
      const available = room - (chosen.size === 0 ? 0 : SECTION_SEPARATOR.length);
      chosen.set(entry.index, cutAtWord(entry.text, Math.max(1, available)));
      room = 0;
      partial = true;
      break;
    }
  }
  if (chosen.size < cleaned.length) partial = true;
  const text = [...chosen.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, section]) => section)
    .join(SECTION_SEPARATOR);
  return { text, partial };
}

/** The day of a date and time, in India time, as `2026-11-20` (what a result says "published" or "updated" with). */
export function indiaDay(iso: string | null): string | null {
  if (iso === null) return null;
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);
}

/** A category's address word as the database stores it (lower case words joined by single hyphens); anything else is not one. */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isCategorySlug(value: string): boolean {
  return value.length <= 80 && SLUG.test(value);
}

/** An id as the database writes it (a UUID); the tools check one before a read, because a malformed id is an error there. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isContentId(value: string): boolean {
  return UUID.test(value.trim());
}
