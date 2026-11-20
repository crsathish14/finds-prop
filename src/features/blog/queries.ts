import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { getPublicCategories } from "@/features/content-categories";
import { CACHE_TAGS, blogPostTag } from "@/lib/cache-tags";
import { publicEnv } from "@/lib/public-env";
import { publicStorageUrl } from "@/lib/storage-url";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import {
  BLOG_ADMIN_PAGE_SIZE,
  BLOG_IMAGE_BUCKET,
  BLOG_PAGE_SIZE,
  BLOG_RELATED_COUNT,
  BLOG_TAG_FILTER_MAX,
  type BlogStatus,
} from "./constants";
import {
  ADMIN_POST_COLUMNS,
  ADMIN_ROW_COLUMNS,
  PUBLIC_POST_COLUMNS,
  pageCountOf,
  toAdminPostView,
  toAdminRowView,
  toArticleView,
  toListView,
  type AdminBlogPostView,
  type AdminBlogRowView,
  type BlogArticleView,
  type BlogCardView,
  type BlogListView,
  type SearchRow,
} from "./view";

/** The address of a stored picture on the public bucket. */
export function blogImageUrl(path: string): string {
  return publicStorageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, BLOG_IMAGE_BUCKET, path);
}

/** What the public list is asked: free words, a category slug, a tag and a page number (from 1). */
export interface BlogListQuery {
  query?: string | null;
  category?: string | null;
  tag?: string | null;
  page: number;
}

const DEFAULT_QUERY = { query: null, category: null, tag: null } as const;

/**
 * One page of the public list through the database's search function, which runs as the caller: a visitor sees only
 * published articles that are not in Trash, and only active categories. A page past the end answers no cards but the
 * real total (read again from page 1), so the page can tell "no such page" from "no articles". A failed read throws, so
 * the page's error state shows it.
 */
export async function readBlogList(
  supabase: SupabaseClient<Database>,
  list: BlogListQuery,
  pageSize: number = BLOG_PAGE_SIZE,
): Promise<BlogListView> {
  const page = Math.max(1, Math.floor(list.page));
  const ask = async (offset: number, limit: number) => {
    const { data, error } = await supabase.rpc("search_blog_posts", {
      ...(list.query ? { p_query: list.query } : {}),
      ...(list.category ? { p_category: list.category } : {}),
      ...(list.tag ? { p_tag: list.tag } : {}),
      p_limit: limit,
      p_offset: offset,
    });
    if (error) {
      logger.error("the blog list could not be read", { errorCode: error.code });
      throw error;
    }
    return data as SearchRow[];
  };
  const rows = await ask((page - 1) * pageSize, pageSize);
  if (rows.length === 0 && page > 1) {
    const first = await ask(0, 1);
    const total = first[0]?.total_count ?? 0;
    return { items: [], total, page, pageSize, pageCount: pageCountOf(total, pageSize) };
  }
  return toListView(rows, page, pageSize, blogImageUrl);
}

/** The list without free words is cached under the Blog's tag (a page of the newest, a category, a tag). */
async function getCachedBlogList(
  category: string | null,
  tag: string | null,
  page: number,
): Promise<BlogListView> {
  "use cache";
  cacheTag(CACHE_TAGS.blog);
  cacheLife("minutes");
  return readBlogList(createPublicSupabase(), { category, tag, page });
}

/**
 * The public list. A search (free words) is never cached (search results are not, ADR-042); every other view of the
 * list is public data under the Blog's tag, so a change in the admin refreshes it at once.
 */
export async function getBlogList(list: BlogListQuery): Promise<BlogListView> {
  const words = list.query?.trim() ?? "";
  if (words !== "") {
    return readBlogList(createPublicSupabase(), { ...DEFAULT_QUERY, ...list, query: words });
  }
  return getCachedBlogList(list.category ?? null, list.tag ?? null, list.page);
}

/**
 * One published article by its address, or `null` when there is none (a draft, an archived one, one in Trash and a
 * wrong address all read the same: the row policy hides them). Cached under the Blog's tag and the article's own.
 */
export async function getBlogArticle(slug: string): Promise<BlogArticleView | null> {
  "use cache";
  cacheTag(CACHE_TAGS.blog, blogPostTag(slug));
  cacheLife("minutes");

  const { data, error } = await createPublicSupabase()
    .from("blog_posts")
    .select(PUBLIC_POST_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    logger.error("a blog article could not be read", { errorCode: error.code });
    throw error;
  }
  if (!data) return null;
  const categories = await getPublicCategories("blog");
  const category = categories.find((item) => item.id === data.category_id);
  return toArticleView(
    data,
    category ? { slug: category.slug, name: category.name } : null,
    blogImageUrl,
  );
}

/**
 * Up to three articles to read next: the newest of the same category, then the newest overall, never the article itself.
 * Public data under the Blog's tag.
 */
export async function getRelatedPosts(article: {
  slug: string;
  category: { slug: string } | null;
}): Promise<BlogCardView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.blog);
  cacheLife("minutes");

  const supabase = createPublicSupabase();
  const wanted = BLOG_RELATED_COUNT + 1;
  const same = article.category
    ? (await readBlogList(supabase, { category: article.category.slug, page: 1 }, wanted)).items
    : [];
  const newest =
    same.filter((card) => card.slug !== article.slug).length >= BLOG_RELATED_COUNT
      ? []
      : (await readBlogList(supabase, { page: 1 }, wanted + same.length)).items;
  const seen = new Set<string>([article.slug]);
  const related: BlogCardView[] = [];
  for (const card of [...same, ...newest]) {
    if (seen.has(card.slug)) continue;
    seen.add(card.slug);
    related.push(card);
    if (related.length === BLOG_RELATED_COUNT) break;
  }
  return related;
}

/** The tags of the published articles, most used first, for the filter row. Public data under the Blog's tag. */
export async function getBlogTags(): Promise<{ tag: string; count: number }[]> {
  "use cache";
  cacheTag(CACHE_TAGS.blog);
  cacheLife("minutes");

  const { data, error } = await createPublicSupabase()
    .from("blog_posts")
    .select("tags")
    .eq("status", "published")
    .limit(500);
  if (error) {
    logger.error("the blog tags could not be read", { errorCode: error.code });
    return [];
  }
  return countTags(data.map((row) => row.tags));
}

/** Counts each tag, most used first (ties by name), at most the filter's limit. Pure, so a test calls it. */
export function countTags(lists: readonly (readonly string[])[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const list of lists) for (const tag of list) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((first, second) => second.count - first.count || first.tag.localeCompare(second.tag))
    .slice(0, BLOG_TAG_FILTER_MAX);
}

/** The addresses of the published articles, for the sitemap. Public data under the Blog's tag. */
export async function getBlogSitemapEntries(): Promise<{ slug: string; updatedAt: string }[]> {
  "use cache";
  cacheTag(CACHE_TAGS.blog);
  cacheLife("hours");

  const { data, error } = await createPublicSupabase()
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(5000);
  if (error) {
    logger.error("the blog sitemap entries could not be read", { errorCode: error.code });
    return [];
  }
  return data.map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
}

/** What the admin's list is asked: a status (or Trash), a category, free words and a page number (from 1). */
export interface AdminBlogListQuery {
  status?: BlogStatus | "trash" | null;
  categoryId?: string | null;
  query?: string | null;
  page: number;
}

export interface AdminBlogList {
  rows: AdminBlogRowView[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * One page of the admin's list, newest edit first, read as the signed-in admin (the row policy lets only the super admin
 * see drafts, archived articles and Trash). Trash is its own view; every other view leaves Trash out. Never cached:
 * the list must be right after every change. A failed read throws, so the portal's error page shows it.
 */
export async function readAdminBlogList(
  supabase: SupabaseClient<Database>,
  list: AdminBlogListQuery,
  pageSize: number = BLOG_ADMIN_PAGE_SIZE,
): Promise<AdminBlogList> {
  const page = Math.max(1, Math.floor(list.page));
  let request = supabase
    .from("blog_posts")
    .select(ADMIN_ROW_COLUMNS, { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);
  request =
    list.status === "trash"
      ? request.not("deleted_at", "is", null)
      : request.is("deleted_at", null);
  if (list.status && list.status !== "trash") request = request.eq("status", list.status);
  if (list.categoryId) request = request.eq("category_id", list.categoryId);
  const words = list.query?.trim() ?? "";
  if (words !== "") {
    request = request.textSearch("search_vector", words, { type: "websearch", config: "simple" });
  }
  const { data, error, count } = await request;
  if (error) {
    logger.error("the admin's blog list could not be read", { errorCode: error.code });
    throw error;
  }
  const total = count ?? 0;
  return { rows: data.map(toAdminRowView), total, page, pageCount: pageCountOf(total, pageSize) };
}

export async function getAdminBlogList(list: AdminBlogListQuery): Promise<AdminBlogList> {
  return readAdminBlogList(await createServerSupabase(), list);
}

/** How many articles each tab of the admin's list holds. */
export interface AdminBlogCounts {
  draft: number;
  published: number;
  archived: number;
  trash: number;
}

export async function readAdminBlogCounts(
  supabase: SupabaseClient<Database>,
): Promise<AdminBlogCounts> {
  const count = async (status: BlogStatus | "trash"): Promise<number> => {
    const request = supabase.from("blog_posts").select("id", { count: "exact", head: true });
    const { count: found, error } =
      status === "trash"
        ? await request.not("deleted_at", "is", null)
        : await request.is("deleted_at", null).eq("status", status);
    if (error) {
      logger.error("the admin's blog counts could not be read", { errorCode: error.code });
      throw error;
    }
    return found ?? 0;
  };
  const [draft, published, archived, trash] = await Promise.all([
    count("draft"),
    count("published"),
    count("archived"),
    count("trash"),
  ]);
  return { draft, published, archived, trash };
}

export async function getAdminBlogCounts(): Promise<AdminBlogCounts> {
  return readAdminBlogCounts(await createServerSupabase());
}

/** One article for the editor, or `null` when there is none. Read as the signed-in admin; never cached. */
export async function readAdminBlogPost(
  supabase: SupabaseClient<Database>,
  postId: string,
): Promise<AdminBlogPostView | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(ADMIN_POST_COLUMNS)
    .eq("id", postId)
    .maybeSingle();
  if (error) {
    logger.error("an admin blog article could not be read", { errorCode: error.code });
    throw error;
  }
  return data ? toAdminPostView(data, blogImageUrl) : null;
}

export async function getAdminBlogPost(postId: string): Promise<AdminBlogPostView | null> {
  return readAdminBlogPost(await createServerSupabase(), postId);
}
