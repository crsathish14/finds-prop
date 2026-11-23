import "server-only";
import {
  blocksToPlainText,
  getBlogList,
  getPublishedBlogPostById,
  type Block,
} from "@/features/blog";
import {
  getJobList,
  getOpenJobById,
  isJobOpenAt,
  pointsOf,
  descriptionParagraphs,
  type EmploymentType,
  type WorkMode,
} from "@/features/careers";
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

/** One open job in a search result: enough to choose it and to say where it comes from. */
export interface JobHit {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly departmentName: string | null;
  readonly departmentSlug: string | null;
  readonly location: string;
  readonly workMode: WorkMode;
  readonly employmentType: EmploymentType;
  readonly experience: string;
  readonly salaryNote: string | null;
  /** The last moment to apply (ISO date and time), or null when the job has no closing date. */
  readonly closesAt: string | null;
  /** About `CONTENT_SNIPPET_CHARACTERS` characters, one line: the matched passage, or the summary. */
  readonly passage: string;
}

export interface JobSearchRequest {
  readonly query: string | null;
  readonly departmentSlug: string | null;
  readonly location: string | null;
  readonly workMode: WorkMode | null;
  readonly type: EmploymentType | null;
  readonly limit: number;
}

/** One article, question or job, as sections of plain text in reading order. */
export interface ContentItem {
  readonly kind: ContentKind | "job";
  readonly id: string;
  readonly slug: string | null;
  readonly title: string;
  readonly categoryName: string | null;
  readonly date: string | null;
  readonly sections: readonly string[];
}

/** The two switches `search_content` and the article and question reads depend on, read through the one helper. */
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

/**
 * The open jobs that match the words and the filters, best match first (the database ranks them), as an anonymous visitor
 * through the page's own read, so a draft, a closed job, one past its closing date and one in Trash are not there.
 * A switched-off Careers module answers as if it had no jobs (an empty list, never an error). A failed read throws.
 */
export async function searchJobs(request: JobSearchRequest): Promise<JobHit[]> {
  if (!(await getContentModuleOn("careers"))) return [];
  const now = new Date();
  const list = await getJobList({
    query: request.query,
    department: request.departmentSlug,
    location: request.location,
    workMode: request.workMode,
    type: request.type,
    page: 1,
  });
  // A list kept for a few minutes may still hold a job whose closing date has just passed; the assistant never offers it.
  return list.items
    .filter((job) => isJobOpenAt(job, now))
    .slice(0, request.limit)
    .map((job) => ({
      id: job.id,
      slug: job.slug,
      title: job.title,
      departmentName: job.department?.name ?? null,
      departmentSlug: job.department?.slug ?? null,
      location: job.location,
      workMode: job.workMode,
      employmentType: job.employmentType,
      experience: job.experience,
      salaryNote: job.salaryNote,
      closesAt: job.closesAt,
      passage: cutAtWord(
        oneLine(job.snippet === null ? job.summary : withoutMatchMarks(job.snippet)),
        CONTENT_SNIPPET_CHARACTERS,
      ),
    }));
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
 * One published article, question or open job by the id a search gave, or null when there is none (no such id, not
 * published or open, in Trash, past its closing date, in an inactive category, or its module switched off: the same
 * answer for all). A failed read throws.
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
  if (await getContentModuleOn("careers")) {
    const job = await getOpenJobById(id);
    // The read is cached for a few minutes, so a job that passed its closing date since is asked about again here.
    if (job !== null && isJobOpenAt(job, new Date())) {
      return {
        kind: "job",
        id: job.id,
        slug: job.slug,
        title: job.title,
        categoryName: job.department?.name ?? null,
        date: job.postedAt,
        sections: [
          job.summary,
          ...descriptionParagraphs(job.description),
          ...jobPointsSection(job.responsibilities),
          ...jobPointsSection(job.requirements),
        ].filter((section) => section.trim() !== ""),
      };
    }
  }
  return null;
}

/** A list of points (one per line) as one section, so the text selection keeps the points together. */
function jobPointsSection(text: string): string[] {
  const points = pointsOf(text);
  return points.length === 0 ? [] : [points.map((point) => `- ${point}`).join("\n")];
}
