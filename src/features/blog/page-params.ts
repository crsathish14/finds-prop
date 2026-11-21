import { z } from "zod";

/**
 * What the Blog's pages read from the address (ADR-143, frontend.md 6.1): one schema for each page, defaults left out,
 * anything that does not fit dropped instead of refused, so a hand-edited address still shows a page.
 */

/** The public list's address, and the address of one article. */
export const BLOG_PATH = "/blog";
export const blogArticlePath = (slug: string): string => `${BLOG_PATH}/${slug}`;
/** The admin list's address, and the editor's. */
export const ADMIN_BLOG_PATH = "/admin/blog";
export const ADMIN_BLOG_NEW_PATH = "/admin/blog/new";
export const adminBlogEditPath = (postId: string): string => `${ADMIN_BLOG_PATH}/${postId}`;

/** The most words a visitor may search with, and the most pages the address may ask for. */
export const BLOG_SEARCH_MAX = 200;
const PAGE_MAX = 10_000;

type RawParams = Record<string, string | string[] | undefined>;

/** The first value of a repeated parameter. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A page number from 1; anything else is page 1. */
const pageNumber = z.coerce.number().int().min(1).max(PAGE_MAX).catch(1);

const publicSchema = z.object({
  words: z.string().trim().max(BLOG_SEARCH_MAX).catch(""),
  category: z.string().regex(SLUG).max(60).catch(""),
  tag: z.string().regex(SLUG).max(40).catch(""),
  page: pageNumber,
});

/** The words typed, the category and tag chosen, and the page on /blog. A category and a tag must be slugs. */
export type PublicBlogParams = { query: string; category: string; tag: string; page: number };

export function parsePublicBlogParams(raw: RawParams): PublicBlogParams {
  const parsed = publicSchema.parse({
    words: first(raw.q) ?? "",
    category: first(raw.category) ?? "",
    tag: first(raw.tag) ?? "",
    page: first(raw.page) ?? 1,
  });
  return { query: parsed.words, category: parsed.category, tag: parsed.tag, page: parsed.page };
}

/** The address of the public list for a choice: each part left out when empty, and page 1 left out. */
export function blogHref(
  choice: { query?: string; category?: string; tag?: string; page?: number } = {},
): string {
  const search = new URLSearchParams();
  if (choice.query) search.set("q", choice.query);
  if (choice.category) search.set("category", choice.category);
  if (choice.tag) search.set("tag", choice.tag);
  if (choice.page && choice.page > 1) search.set("page", String(choice.page));
  const text = search.toString();
  return text === "" ? BLOG_PATH : `${BLOG_PATH}?${text}`;
}

/** The tabs of the admin's list. */
export const BLOG_ADMIN_TABS = ["all", "draft", "published", "archived", "trash"] as const;
export type BlogAdminTab = (typeof BLOG_ADMIN_TABS)[number];

const adminSchema = z.object({
  status: z.enum(BLOG_ADMIN_TABS).catch("all"),
  category: z.uuid().catch(""),
  words: z.string().trim().max(100).catch(""),
  page: pageNumber,
});

/** The tab, the category (an id), the words and the page chosen on the admin list. */
export type AdminBlogParams = {
  status: BlogAdminTab;
  category: string;
  query: string;
  page: number;
};

export function parseAdminBlogParams(raw: RawParams): AdminBlogParams {
  const parsed = adminSchema.parse({
    status: first(raw.status) ?? "all",
    category: (first(raw.category) ?? "").toLowerCase(),
    words: first(raw.q) ?? "",
    page: first(raw.page) ?? 1,
  });
  return {
    status: parsed.status,
    category: parsed.category,
    query: parsed.words,
    page: parsed.page,
  };
}

/** The address of the admin list for a choice, with the defaults (all, no category, no words, page 1) left out. */
export function adminBlogHref(choice: Partial<AdminBlogParams> = {}): string {
  const search = new URLSearchParams();
  if (choice.status && choice.status !== "all") search.set("status", choice.status);
  if (choice.category) search.set("category", choice.category);
  if (choice.query) search.set("q", choice.query);
  if (choice.page && choice.page > 1) search.set("page", String(choice.page));
  const text = search.toString();
  return text === "" ? ADMIN_BLOG_PATH : `${ADMIN_BLOG_PATH}?${text}`;
}

/** An article address as it must read: lower case words joined by hyphens, at most 120 characters. */
export function parseBlogSlug(value: string): string | null {
  return value.length >= 2 && value.length <= 120 && SLUG.test(value) ? value : null;
}
