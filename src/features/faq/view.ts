import type { FaqAdminViewName, FaqStatus } from "./constants";

/** A question as the website, its structured data and the AI assistant draw it (published, in an active category). */
export interface FaqView {
  id: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  question: string;
  answer: string;
  sortOrder: number;
  updatedAt: string;
}

/** A question as the admin's list and edit form draw it: any status, and the trash time when it is in the trash. */
export interface FaqAdminView {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  sortOrder: number;
  status: FaqStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The columns the admin's reads name (never `select *`; the search vector is not one of them). */
export const FAQ_ADMIN_COLUMNS =
  "id, category_id, question, answer, sort_order, status, deleted_at, created_at, updated_at";

/** What `search_faqs` answers for one row (the generated type, as plain fields). */
interface SearchRecord {
  id: string;
  category_id: string;
  category_slug: string;
  category_name: string;
  question: string;
  answer: string;
  sort_order: number;
  updated_at: string;
}

/** Turns the search function's rows into views. The function already orders them; the order is kept. */
export function toFaqViews(rows: SearchRecord[]): FaqView[] {
  return rows.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  }));
}

interface AdminRecord {
  id: string;
  category_id: string;
  question: string;
  answer: string;
  sort_order: number;
  status: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Turns the admin's rows into views, in the order of the questions inside their category (order, then age). */
export function toAdminFaqViews(rows: AdminRecord[]): FaqAdminView[] {
  return rows
    .map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      question: row.question,
      answer: row.answer,
      sortOrder: row.sort_order,
      status: row.status === "published" ? ("published" as const) : ("draft" as const),
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    .sort(
      (first, second) =>
        first.sortOrder - second.sortOrder || first.createdAt.localeCompare(second.createdAt),
    );
}

/** One group of the public page: a category and its questions, in the order the search function gave them. */
export interface FaqGroup {
  slug: string;
  name: string;
  items: FaqView[];
}

/**
 * Groups questions by category, groups in the order they first appear (the function gives the admin's category order)
 * and questions in the order given. A search result is grouped the same way, so the best match stays first inside its
 * category.
 */
export function groupFaqs(faqs: readonly FaqView[]): FaqGroup[] {
  const groups = new Map<string, FaqGroup>();
  for (const faq of faqs) {
    const group = groups.get(faq.categorySlug);
    if (group) group.items.push(faq);
    else {
      groups.set(faq.categorySlug, {
        slug: faq.categorySlug,
        name: faq.categoryName,
        items: [faq],
      });
    }
  }
  return [...groups.values()];
}

/** An answer's paragraphs: a blank line starts a new one. The page draws each as text, never as HTML. */
export function answerParagraphs(answer: string): string[] {
  return answer
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** The filters of the admin list: the tab, one category and words in the question or the answer. */
export interface AdminFaqFilters {
  view?: FaqAdminViewName;
  categoryId?: string | undefined;
  query?: string | undefined;
}

/**
 * Narrows the admin's questions. `trash` shows only the trashed ones; every other view hides them. Words match the
 * question or the answer, any case, all of them (the list is short, so this happens here and not in the database).
 */
export function filterAdminFaqs(
  faqs: readonly FaqAdminView[],
  filters: AdminFaqFilters,
): FaqAdminView[] {
  const view = filters.view ?? "all";
  const words = (filters.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return faqs.filter((faq) => {
    if (view === "trash" ? faq.deletedAt === null : faq.deletedAt !== null) return false;
    if (view === "published" && faq.status !== "published") return false;
    if (view === "draft" && faq.status !== "draft") return false;
    if (filters.categoryId && faq.categoryId !== filters.categoryId) return false;
    if (words.length === 0) return true;
    const text = `${faq.question} ${faq.answer}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
