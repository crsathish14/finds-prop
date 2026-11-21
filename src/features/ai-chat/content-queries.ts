import "server-only";
import {
  blocksToPlainText,
  getBlogList,
  getPublishedBlogPostById,
  type Block,
} from "@/features/blog";
import { answerParagraphs, getPublicFaqs, searchPublicFaqs } from "@/features/faq";
import { getContentModuleOn } from "@/features/site";
import { CONTENT_SNIPPET_CHARACTERS } from "@/config/ai";
import { cutAtWord, passageAround, queryWords } from "./content-text";

/**
 * The reads behind the two content tools (ADR-143 section 6). They go through the feature reads the website's own
 * pages use, as an anonymous visitor, so the database's row rules decide what exists: an article or a question that is
 * a draft, archived, in Trash or in an inactive category is not there at all, and a module the admin switched off is
 * asked about only through `getContentModuleOn`, the one helper the pages, the menus, the sitemap and these tools share.
 * A switched-off module answers as if it had nothing (no result, never an error), and nothing is read from it.
 *
 * Nothing here is cached except what the feature reads cache themselves, under the Blog's and the FAQ's tags: a search
 * is never cached, and the cached read of one item is refreshed by `tagsAfterBlogChange` and `tagsAfterFaqChange`,
 * so a publish, an unpublish, an edit, a move to Trash or a module switch changes the assistant's answer at once.
 */

export type ContentKind = "article" | "faq";

/** One search result: enough to choose and to say where it comes from, with a short passage and nothing long. */
export interface ContentHit {
  readonly kind: ContentKind;
  readonly id: string;
  /** An article's address word; null for a question. */
  readonly slug: string | null;
  readonly title: string;
  readonly categoryName: string | null;
  readonly categorySlug: string | null;
  /** The day an article was published, or a question was last updated (ISO date and time). */
  readonly date: string | null;
  /** About `CONTENT_SNIPPET_CHARACTERS` characters, one line. */
  readonly passage: string;
}

export interface ContentSearchRequest {
  readonly query: string;
  readonly kind: "any" | ContentKind;
  readonly categorySlug: string | null;
  readonly limit: number;
}

/** One article or question, as sections of plain text in reading order. */
export interface ContentItem {
  readonly kind: ContentKind;
  readonly id: string;
  readonly slug: string | null;
  readonly title: string;
  readonly categoryName: string | null;
  readonly date: string | null;
  readonly sections: readonly string[];
}

/** The two switches the content tools depend on, read through the one helper. */
async function modulesOn(): Promise<{ article: boolean; faq: boolean }> {
  const [article, faq] = await Promise.all([getContentModuleOn("blog"), getContentModuleOn("faq")]);
  return { article, faq };
}

/** The matched words come back from the database between `[[` and `]]`; the model is shown plain text. */
function withoutMatchMarks(snippet: string): string {
  return snippet.replaceAll("[[", "").replaceAll("]]", "");
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Takes turns between the two lists, the first list first, so neither kind crowds the other out of a short result. */
function interleave<Item>(first: readonly Item[], second: readonly Item[], limit: number): Item[] {
  const merged: Item[] = [];
  for (let index = 0; merged.length < limit && (index < first.length || index < second.length);) {
    const one = first[index];
    if (one !== undefined) merged.push(one);
    const other = second[index];
    if (other !== undefined && merged.length < limit) merged.push(other);
    index += 1;
  }
  return merged;
}

async function searchArticles(request: ContentSearchRequest): Promise<ContentHit[]> {
  const list = await getBlogList({
    query: request.query,
    category: request.categorySlug,
    page: 1,
  });
  return list.items.slice(0, request.limit).map((card) => ({
    kind: "article",
    id: card.id,
    slug: card.slug,
    title: card.title,
    categoryName: card.category?.name ?? null,
    categorySlug: card.category?.slug ?? null,
    date: card.publishedAt,
    passage: cutAtWord(
      oneLine(withoutMatchMarks(card.snippet ?? card.excerpt)),
      CONTENT_SNIPPET_CHARACTERS,
    ),
  }));
}

async function searchQuestions(request: ContentSearchRequest): Promise<ContentHit[]> {
  const words = queryWords(request.query);
  const questions = await searchPublicFaqs({
    query: request.query,
    ...(request.categorySlug === null ? {} : { categorySlug: request.categorySlug }),
    limit: request.limit,
  });
  return questions.slice(0, request.limit).map((question) => ({
    kind: "faq",
    id: question.id,
    slug: null,
    title: question.question,
    categoryName: question.categoryName,
    categorySlug: question.categorySlug,
    date: question.updatedAt,
    passage: passageAround(question.answer, words, CONTENT_SNIPPET_CHARACTERS),
  }));
}

/**
 * The best matches for the words, from the articles, the questions or both. Within a kind the database ranks them
 * (`ts_rank`); the two kinds are searched with different text configurations, so their ranks are not comparable and a
 * search of both takes turns, an article first. A kind whose module is switched off is left out. A failed read throws.
 */
export async function searchContent(request: ContentSearchRequest): Promise<ContentHit[]> {
  const on = await modulesOn();
  const [articles, questions] = await Promise.all([
    on.article && request.kind !== "faq" ? searchArticles(request) : [],
    on.faq && request.kind !== "article" ? searchQuestions(request) : [],
  ]);
  return interleave(articles, questions, request.limit);
}

/** The sections of an article: a heading starts one, and what comes before the first heading is the first. */
function articleSections(blocks: readonly Block[]): string[] {
  const sections: string[] = [];
  let current: string[] = [];
  const close = () => {
    if (current.length > 0) sections.push(current.join("\n"));
    current = [];
  };
  for (const block of blocks) {
    if (block.type === "heading") close();
    const text = blocksToPlainText([block]).trim();
    if (text !== "") current.push(text);
  }
  close();
  return sections;
}

/**
 * One published article or question by the id a search gave, or null when there is none (no such id, not published, in
 * Trash, in an inactive category, or its module switched off: the same answer for all). A failed read throws.
 *
 * Extension point (a later change): a job posting is a third place an id can come from. The Careers tool adds its own
 * read here, behind `getContentModuleOn("careers")`, and returns `kind: "job"`; nothing about jobs is built yet.
 */
export async function readContentItem(id: string): Promise<ContentItem | null> {
  const on = await modulesOn();
  if (on.article) {
    const article = await getPublishedBlogPostById(id);
    if (article !== null) {
      return {
        kind: "article",
        id: article.id,
        slug: article.slug,
        title: article.title,
        categoryName: article.category?.name ?? null,
        date: article.publishedAt,
        sections: [article.excerpt, ...articleSections(article.body)].filter(
          (section) => section.trim() !== "",
        ),
      };
    }
  }
  if (on.faq) {
    const question = (await getPublicFaqs()).find((candidate) => candidate.id === id);
    if (question !== undefined) {
      return {
        kind: "faq",
        id: question.id,
        slug: null,
        title: question.question,
        categoryName: question.categoryName,
        date: question.updatedAt,
        sections: answerParagraphs(question.answer),
      };
    }
  }
  return null;
}
