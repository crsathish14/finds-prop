import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import {
  countTags,
  readAdminBlogCounts,
  readAdminBlogList,
  readAdminBlogPost,
  readBlogList,
} from "../queries";
import type { SearchRow } from "../view";

const ROW: SearchRow = {
  id: "00000000-0000-4000-b500-0000000000a1",
  slug: "guide",
  title: "Guide",
  excerpt: "A guide.",
  snippet: "A guide.",
  cover_path: null,
  cover_alt: null,
  category_id: null,
  category_slug: null,
  category_name: null,
  tags: [],
  author_name: "Asha Rao",
  published_at: "2026-03-01T10:00:00+00:00",
  read_minutes: 1,
  total_count: 30,
};

/** A client whose rpc answers from a script of pages: the offset decides which. */
function searchClient(pages: Record<number, SearchRow[]>, failure?: { code: string }) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (failure) return Promise.resolve({ data: null, error: failure });
    return Promise.resolve({ data: pages[args.p_offset as number] ?? [], error: null });
  });
  return { supabase: { rpc } as unknown as SupabaseClient<Database>, calls };
}

describe("UT-blog-queries: the public list", () => {
  it("asks the search function for one page and draws it with the total", async () => {
    const { supabase, calls } = searchClient({ 12: [ROW] });
    const list = await readBlogList(supabase, {
      query: "registration",
      category: "buying",
      tag: "chennai",
      page: 2,
    });
    expect(calls).toEqual([
      {
        name: "search_blog_posts",
        args: {
          p_query: "registration",
          p_category: "buying",
          p_tag: "chennai",
          p_limit: 12,
          p_offset: 12,
        },
      },
    ]);
    expect(list).toMatchObject({ total: 30, page: 2, pageCount: 3 });
    expect(list.items.map((card) => card.slug)).toEqual(["guide"]);
  });

  it("leaves out the filters that are not set", async () => {
    const { supabase, calls } = searchClient({ 0: [ROW] });
    await readBlogList(supabase, { page: 1 });
    expect(calls[0]?.args).toEqual({ p_limit: 12, p_offset: 0 });
  });

  it("answers a page past the end with no cards but the real total, so the page can say there is no such page", async () => {
    const { supabase, calls } = searchClient({ 0: [ROW] });
    const list = await readBlogList(supabase, { page: 9 });
    expect(list).toMatchObject({ items: [], total: 30, page: 9, pageCount: 3 });
    expect(calls.map((call) => call.args.p_offset)).toEqual([96, 0]);
  });

  it("answers an empty Blog with one empty page", async () => {
    const { supabase } = searchClient({});
    expect(await readBlogList(supabase, { page: 1 })).toMatchObject({
      items: [],
      total: 0,
      pageCount: 1,
    });
  });

  it("treats a page below one as the first, and throws a failed read", async () => {
    const { supabase, calls } = searchClient({ 0: [ROW] });
    await readBlogList(supabase, { page: -3 });
    expect(calls[0]?.args.p_offset).toBe(0);
    const failing = searchClient({}, { code: "XX000" });
    await expect(readBlogList(failing.supabase, { page: 1 })).rejects.toEqual({ code: "XX000" });
  });
});

describe("UT-blog-queries: the tag filter", () => {
  it("counts tags, most used first, ties by name", () => {
    expect(countTags([["b", "a"], ["a"], ["c", "b"], []])).toEqual([
      { tag: "a", count: 2 },
      { tag: "b", count: 2 },
      { tag: "c", count: 1 },
    ]);
  });

  it("keeps at most thirty", () => {
    const many = Array.from({ length: 40 }, (_, index) => [
      `tag-${String(index).padStart(2, "0")}`,
    ]);
    expect(countTags(many)).toHaveLength(30);
  });
});

/** A query builder that records each call and answers the result when awaited. */
function builder(result: { data: unknown; error: unknown; count?: number | null }) {
  const calls: string[] = [];
  const query: Record<string, unknown> = {};
  for (const name of ["select", "order", "range", "not", "is", "eq", "textSearch", "maybeSingle"]) {
    query[name] = (...args: unknown[]) => {
      calls.push(
        `${name}:${args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg))).join(",")}`,
      );
      return query;
    };
  }
  query.then = (resolve: (value: unknown) => unknown) => resolve(result);
  const supabase = { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>;
  return { supabase, calls };
}

const ADMIN_ROW = {
  id: "00000000-0000-4000-b500-0000000000a1",
  slug: "guide",
  title: "Guide",
  status: "draft",
  category_id: null,
  author_name: "Asha Rao",
  tags: [],
  published_at: null,
  updated_at: "2026-03-02T10:00:00+00:00",
  deleted_at: null,
};

describe("UT-blog-queries: the admin's list", () => {
  it("reads a page with named columns, newest edit first, leaving Trash out", async () => {
    const { supabase, calls } = builder({ data: [ADMIN_ROW], error: null, count: 41 });
    const list = await readAdminBlogList(supabase, { status: "draft", page: 2 });
    expect(calls).toEqual([
      expect.stringContaining("select:id, slug, title, status, category_id, author_name, tags"),
      'order:updated_at,{"ascending":false}',
      'order:id,{"ascending":true}',
      "range:20,39",
      "is:deleted_at,null",
      "eq:status,draft",
    ]);
    expect(calls[0]).not.toContain("body");
    expect(list).toMatchObject({ total: 41, page: 2, pageCount: 3 });
    expect(list.rows[0]).toMatchObject({ slug: "guide", status: "draft", trashed: false });
  });

  it("shows Trash as its own view, and filters by category and words", async () => {
    const trash = builder({ data: [], error: null, count: 0 });
    await readAdminBlogList(trash.supabase, { status: "trash", page: 1 });
    expect(trash.calls).toContain("not:deleted_at,is,null");
    expect(trash.calls.some((call) => call.startsWith("eq:status"))).toBe(false);

    const filtered = builder({ data: [], error: null, count: 0 });
    await readAdminBlogList(filtered.supabase, {
      categoryId: "00000000-0000-4000-b500-000000000001",
      query: " registration ",
      page: 1,
    });
    expect(filtered.calls).toContain("eq:category_id,00000000-0000-4000-b500-000000000001");
    expect(filtered.calls).toContain(
      'textSearch:search_vector,registration,{"type":"websearch","config":"simple"}',
    );
  });

  it("throws a failed read, so the portal's error page shows it", async () => {
    const failure = { code: "XX000", message: "down" };
    const { supabase } = builder({ data: null, error: failure });
    await expect(readAdminBlogList(supabase, { page: 1 })).rejects.toBe(failure);
  });
});

describe("UT-blog-queries: the admin's counts and editor", () => {
  it("counts each tab with a head request", async () => {
    const { supabase } = builder({ data: null, error: null, count: 4 });
    expect(await readAdminBlogCounts(supabase)).toEqual({
      draft: 4,
      published: 4,
      archived: 4,
      trash: 4,
    });
  });

  it("reads one article for the editor, or nothing", async () => {
    const found = builder({
      data: {
        ...ADMIN_ROW,
        excerpt: "A guide.",
        body: [{ type: "paragraph", text: "Hi" }],
        cover_path: null,
        cover_alt: null,
        seo_title: null,
        seo_description: null,
        read_minutes: 1,
        created_at: "2026-03-01T10:00:00+00:00",
      },
      error: null,
    });
    const view = await readAdminBlogPost(found.supabase, ADMIN_ROW.id);
    expect(view?.body).toEqual([{ type: "paragraph", text: "Hi" }]);
    expect(found.calls).toContain(`eq:id,${ADMIN_ROW.id}`);
    const missing = builder({ data: null, error: null });
    expect(await readAdminBlogPost(missing.supabase, ADMIN_ROW.id)).toBeNull();
  });
});
