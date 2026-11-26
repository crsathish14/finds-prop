import { onSameSite, pageAddress, pageKey } from "./site";
import { TOPIC_WORDS, type PageTopic, type QuestionTopic } from "./topics";

/**
 * Which pages of a builder's website are read for one question (AI search Phase 4, the ranking the owner approved on
 * 27 Nov 2026). Our code chooses, never the model, and the same question on the same site always gives the same pages:
 *
 *  1. The builder's own pages tagged with the question's topic, in the builder's order (for a general question, all of
 *     the builder's pages, in order).
 *  2. The home page (the website on the profile), if a place is left.
 *  3. The best of everything else, by points: 3 for each topic word in a link's words, 2 for each in its address, then 1
 *     more for a link in the home page's menu and 1 for a short address. A page with no topic word scores nothing and is
 *     never read. A tie goes to the link found first. A general question takes the best About page and the best
 *     Projects page.
 *  4. At most `PAGES_PER_QUESTION` pages in all.
 *
 * Pure: the reader gives it what it found.
 */

export const PAGES_PER_QUESTION = 5;

export interface BuilderPage {
  readonly url: string;
  readonly topic: PageTopic;
}

export interface CandidateLink {
  readonly href: string;
  /** The link's visible words; empty for an address from the sitemap. */
  readonly text: string;
  /** Where it was found: the home page's links, one of the builder's pages, or the site's sitemap. */
  readonly from: "home" | "builder_page" | "sitemap";
}

export interface PickInput {
  readonly topic: QuestionTopic;
  readonly website: string;
  readonly builderPages: readonly BuilderPage[];
  readonly candidates: readonly CandidateLink[];
}

export interface PickedPage {
  readonly url: string;
  readonly why: "builder_page" | "home_page" | "points";
}

/** Addresses that are files, not pages: never read. */
const FILE_ENDING = /\.(pdf|jpe?g|png|gif|webp|svg|mp4|mov|zip|docx?|xlsx?|pptx?)$/i;

/** The words of an address's path, so `/completed-projects` reads "completed projects". */
function addressWords(address: string): string {
  try {
    const { pathname } = new URL(address);
    return decodeURIComponent(pathname)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  } catch {
    return "";
  }
}

/** A short address: the site's top level or one step below it, such as `/projects`. */
function isShort(address: string): boolean {
  try {
    const parts = new URL(address).pathname.split("/").filter((part) => part !== "");
    return parts.length <= 1;
  } catch {
    return false;
  }
}

/** True when the words hold the topic word as whole words ("team" is not in "steam"). */
function contains(haystack: string, word: string): boolean {
  return ` ${haystack} `.includes(` ${word} `);
}

/** The points of one link for a topic's words; nothing when no topic word is in it. */
export function pointsFor(link: CandidateLink, words: readonly string[]): number {
  // Punctuation counts as a space, so "About us." and "Projects:" still hold their words.
  const text = link.text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const address = addressWords(link.href);
  let points = 0;
  for (const word of words) {
    if (contains(text, word)) points += 3;
    if (contains(address, word)) points += 2;
  }
  if (points === 0) return 0;
  if (link.from === "home") points += 1;
  if (isShort(link.href)) points += 1;
  return points;
}

/** The best-scoring links for some words, highest first, ties in the order they were found. */
function ranked(candidates: readonly CandidateLink[], words: readonly string[]): CandidateLink[] {
  return candidates
    .map((link, index) => ({ link, index, points: pointsFor(link, words) }))
    .filter((entry) => entry.points > 0)
    .sort((first, second) => second.points - first.points || first.index - second.index)
    .map((entry) => entry.link);
}

export function pickPages(input: PickInput): PickedPage[] {
  const picked: PickedPage[] = [];
  const taken = new Set<string>();
  const add = (address: string, why: PickedPage["why"]) => {
    const url = pageAddress(address);
    const key = url === null ? null : pageKey(url);
    if (url === null || key === null || taken.has(key) || picked.length >= PAGES_PER_QUESTION)
      return;
    if (!onSameSite(url, input.website) || FILE_ENDING.test(new URL(url).pathname)) return;
    taken.add(key);
    picked.push({ url, why });
  };

  for (const page of input.builderPages) {
    if (input.topic === "general" || page.topic === input.topic) add(page.url, "builder_page");
  }
  add(input.website, "home_page");

  // The builder's other pages compete with the links found on the site, as links with no words of their own.
  const candidates: CandidateLink[] = [
    ...input.builderPages.map((page) => ({
      href: page.url,
      text: "",
      from: "builder_page" as const,
    })),
    ...input.candidates,
  ];
  if (input.topic === "general") {
    for (const words of [TOPIC_WORDS.about_company, TOPIC_WORDS.projects]) {
      const best = ranked(candidates, words).find((link) => {
        const url = pageAddress(link.href);
        const key = url === null ? null : pageKey(url);
        return key !== null && !taken.has(key);
      });
      if (best !== undefined) add(best.href, "points");
    }
  } else {
    for (const link of ranked(candidates, TOPIC_WORDS[input.topic])) add(link.href, "points");
  }
  return picked;
}
