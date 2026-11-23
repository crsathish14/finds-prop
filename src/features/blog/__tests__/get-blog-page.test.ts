import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  tags: vi.fn(),
  categories: vi.fn(),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/features/content-categories", () => ({ getPublicCategories: mocks.categories }));
vi.mock("@/server/supabase/public", () => ({
  createPublicSupabase: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ limit: () => mocks.tags() }) }),
    }),
  }),
}));

const { getBlogPage, readBlogCategoryUsage } = await import("../queries");

const row = (slug: string, total = 2) => ({
  id: `id-${slug}`,
  slug,
  title: `Title ${slug}`,
  excerpt: "A summary.",
  snippet: null,
  cover_path: null,
  cover_alt: null,
  category_id: null,
  category_slug: null,
  category_name: null,
  tags: [],
  author_name: "Asha Rao",
  published_at: "2026-11-10T08:00:00+00:00",
  read_minutes: 1,
  total_count: total,
});

const CATEGORIES = [
  { id: "c1", module: "blog", slug: "guides", name: "Guides", sortOrder: 1, active: true },
  { id: "c2", module: "blog", slug: "news", name: "News", sortOrder: 2, active: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: [row("a"), row("b")], error: null });
  mocks.tags.mockResolvedValue({
    data: [{ tags: ["loans", "chennai"] }, { tags: ["loans"] }],
    error: null,
  });
  mocks.categories.mockResolvedValue(CATEGORIES);
});

describe("UT-blog-page-data: what the public Blog list reads (ADR-143)", () => {
  it("reads the page, the active categories and the tags, and says nothing is missing", async () => {
    const page = await getBlogPage({ query: "", category: "", tag: "", page: 1 });
    expect(page.list.items.map((card) => card.slug)).toEqual(["a", "b"]);
    expect(page.categories).toEqual([
      { slug: "guides", name: "Guides" },
      { slug: "news", name: "News" },
    ]);
    expect(page.tags).toEqual([
      { tag: "loans", count: 2 },
      { tag: "chennai", count: 1 },
    ]);
    expect(page.category).toBe("");
    expect(page.nothingPublished).toBe(false);
    expect(mocks.categories).toHaveBeenCalledWith("blog");
  });

  it("sends the category, the tag and the page to the search function, and the words too", async () => {
    await getBlogPage({ query: "stamp duty", category: "guides", tag: "loans", page: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith("search_blog_posts", {
      p_query: "stamp duty",
      p_category: "guides",
      p_tag: "loans",
      p_limit: 12,
      p_offset: 12,
    });
  });

  it("drops a category that is not an active one, and shows the list without it", async () => {
    const page = await getBlogPage({ query: "", category: "hidden-one", tag: "", page: 1 });
    expect(page.category).toBe("");
    expect(mocks.rpc).toHaveBeenCalledWith("search_blog_posts", { p_limit: 12, p_offset: 0 });
  });

  it("says nothing is published only when nothing was asked for and nothing is there", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(
      (await getBlogPage({ query: "", category: "", tag: "", page: 1 })).nothingPublished,
    ).toBe(true);
    expect(
      (await getBlogPage({ query: "zzz", category: "", tag: "", page: 1 })).nothingPublished,
    ).toBe(false);
    expect(
      (await getBlogPage({ query: "", category: "", tag: "loans", page: 1 })).nothingPublished,
    ).toBe(false);
  });

  it("answers no tags, and still renders, when the tag read fails", async () => {
    mocks.tags.mockResolvedValue({ data: null, error: { code: "XX000" } });
    const page = await getBlogPage({ query: "", category: "", tag: "", page: 1 });
    expect(page.tags).toEqual([]);
    expect(page.list.items).toHaveLength(2);
  });

  it("throws when the list itself cannot be read, so the error page shows it", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    await expect(getBlogPage({ query: "", category: "", tag: "", page: 1 })).rejects.toBeDefined();
  });
});

describe("UT-blog-category-usage: how many articles each category holds (ADR-143)", () => {
  function client(result: { data: unknown; error: unknown }) {
    const calls: string[] = [];
    const query: Record<string, unknown> = {};
    query["select"] = (columns: string) => {
      calls.push(`select:${columns}`);
      return query;
    };
    query["not"] = (...args: unknown[]) => {
      calls.push(`not:${args.join(",")}`);
      return query;
    };
    query["limit"] = () => Promise.resolve(result);
    return { calls, supabase: { from: () => query } as unknown as SupabaseClient<Database> };
  }

  it("counts the articles of each category, the Trash included, from named columns", async () => {
    const { supabase, calls } = client({
      data: [{ category_id: "c1" }, { category_id: "c1" }, { category_id: "c2" }],
      error: null,
    });
    expect(await readBlogCategoryUsage(supabase)).toEqual({ c1: 2, c2: 1 });
    expect(calls).toEqual(["select:category_id", "not:category_id,is,"]);
  });

  it("throws a failed read", async () => {
    const { supabase } = client({ data: null, error: { code: "XX000" } });
    await expect(readBlogCategoryUsage(supabase)).rejects.toEqual({ code: "XX000" });
  });
});
