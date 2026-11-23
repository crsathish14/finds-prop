import type { Json } from "@/types/database.types";
import type { BlogStatus } from "./constants";
import { storedBodySchema, type Block } from "./schemas";

/**
 * The shapes the Blog's pages and admin draw, and the functions that turn rows into them (R-BE-06: a read names its
 * columns and maps them to a view model; a page never sees a raw row). Pure: no framework and no storage, so a
 * test builds rows by hand. A picture's address is made by the caller (`imageUrl`), because it depends on the
 * project's storage address.
 */

/** The columns the public list's search function answers. */
export interface SearchRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  snippet: string | null;
  cover_path: string | null;
  cover_alt: string | null;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  tags: string[];
  author_name: string;
  published_at: string | null;
  read_minutes: number;
  total_count: number;
}

/** The public columns of one article, as the article page and the related list read them. */
export const PUBLIC_POST_COLUMNS =
  "id, slug, title, excerpt, body, cover_path, cover_alt, category_id, tags, author_name, status, published_at, seo_title, seo_description, read_minutes, updated_at";

export interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: Json;
  cover_path: string | null;
  cover_alt: string | null;
  category_id: string | null;
  tags: string[];
  author_name: string;
  status: string;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  read_minutes: number | null;
  updated_at: string;
}

/** An admin row adds the Trash date and the creation date. */
export interface AdminPostRow extends PostRow {
  deleted_at: string | null;
  created_at: string;
}

export interface BlogCategoryRef {
  id: string;
  slug: string;
  name: string;
}

/** One article on a card or in a list. */
export interface BlogCardView {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** A passage around the matched words, the matches between [[ and ]] (see `snippetParts`); null with no search. */
  snippet: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  category: { slug: string; name: string } | null;
  tags: string[];
  authorName: string;
  publishedAt: string | null;
  readMinutes: number;
}

/** One page of the public list. */
export interface BlogListView {
  items: BlogCardView[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** An article page. */
export interface BlogArticleView extends Omit<BlogCardView, "snippet" | "category"> {
  body: Block[];
  categoryId: string | null;
  category: { slug: string; name: string } | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

/** One row of the admin's list. */
export interface AdminBlogRowView {
  id: string;
  slug: string;
  title: string;
  status: BlogStatus;
  categoryId: string | null;
  authorName: string;
  tags: string[];
  publishedAt: string | null;
  updatedAt: string;
  trashed: boolean;
}

/** An article in the admin's editor. */
export interface AdminBlogPostView extends AdminBlogRowView {
  excerpt: string;
  body: Block[];
  coverPath: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
}

const STATUSES: readonly string[] = ["draft", "published", "archived"];

function statusOf(value: string): BlogStatus {
  return STATUSES.includes(value) ? (value as BlogStatus) : "draft";
}

/**
 * The blocks stored in a row. The table checks the shape, so a stored body is expected to be valid; one that is
 * not (a row edited outside the app) reads as an empty body instead of breaking the page.
 */
export function parseBody(stored: Json): Block[] {
  const parsed = storedBodySchema.safeParse(stored);
  return parsed.success ? parsed.data : [];
}

/** The pages count for a total: at least one, so an empty list still has a page 1. */
export function pageCountOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function toCardView(row: SearchRow, imageUrl: (path: string) => string): BlogCardView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    snippet: row.snippet && row.snippet !== row.excerpt ? row.snippet : null,
    coverUrl: row.cover_path ? imageUrl(row.cover_path) : null,
    coverAlt: row.cover_alt,
    category:
      row.category_slug && row.category_name
        ? { slug: row.category_slug, name: row.category_name }
        : null,
    tags: row.tags,
    authorName: row.author_name,
    publishedAt: row.published_at,
    readMinutes: row.read_minutes,
  };
}

export function toListView(
  rows: SearchRow[],
  page: number,
  pageSize: number,
  imageUrl: (path: string) => string,
): BlogListView {
  const total = rows[0]?.total_count ?? 0;
  return {
    items: rows.map((row) => toCardView(row, imageUrl)),
    total,
    page,
    pageSize,
    pageCount: pageCountOf(total, pageSize),
  };
}

export function toArticleView(
  row: PostRow,
  category: { slug: string; name: string } | null,
  imageUrl: (path: string) => string,
): BlogArticleView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverUrl: row.cover_path ? imageUrl(row.cover_path) : null,
    coverAlt: row.cover_alt,
    tags: row.tags,
    authorName: row.author_name,
    publishedAt: row.published_at,
    readMinutes: row.read_minutes ?? 1,
    body: parseBody(row.body),
    categoryId: row.category_id,
    category,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    updatedAt: row.updated_at,
  };
}

/** The columns the admin's list reads (no body). */
export const ADMIN_ROW_COLUMNS =
  "id, slug, title, status, category_id, author_name, tags, published_at, updated_at, deleted_at";

export interface AdminListRecord {
  id: string;
  slug: string;
  title: string;
  status: string;
  category_id: string | null;
  author_name: string;
  tags: string[];
  published_at: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export function toAdminRowView(row: AdminListRecord): AdminBlogRowView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: statusOf(row.status),
    categoryId: row.category_id,
    authorName: row.author_name,
    tags: row.tags,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    trashed: row.deleted_at !== null,
  };
}

/** The columns the editor reads. */
export const ADMIN_POST_COLUMNS =
  "id, slug, title, excerpt, body, cover_path, cover_alt, category_id, tags, author_name, status, published_at, seo_title, seo_description, read_minutes, updated_at, created_at, deleted_at";

export function toAdminPostView(
  row: AdminPostRow,
  imageUrl: (path: string) => string,
): AdminBlogPostView {
  return {
    ...toAdminRowView(row),
    excerpt: row.excerpt,
    body: parseBody(row.body),
    coverPath: row.cover_path,
    coverUrl: row.cover_path ? imageUrl(row.cover_path) : null,
    coverAlt: row.cover_alt,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at,
  };
}

/** A search snippet cut into plain text and matched words, so a page can draw the matches without any HTML. */
export interface SnippetPart {
  text: string;
  matched: boolean;
}

export function snippetParts(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  const pattern = /\[\[(.*?)\]\]/g;
  let last = 0;
  for (const match of snippet.matchAll(pattern)) {
    const start = match.index;
    if (start > last) parts.push({ text: snippet.slice(last, start), matched: false });
    parts.push({ text: match[1] ?? "", matched: true });
    last = start + match[0].length;
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), matched: false });
  return parts;
}
