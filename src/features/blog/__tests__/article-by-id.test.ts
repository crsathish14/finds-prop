import { beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE_TAGS, tagsAfterBlogChange } from "@/lib/cache-tags";

// UT-blog-article-by-id (ADR-143 section 6): the read the AI assistant's article tool uses, by the id a search gave. It
// is the page's own read with another key: public columns only, the row policy decides what exists, and the cached read
// carries the Blog's tag so a publish, an unpublish or a move to Trash changes the answer at once. The database is a
// stand-in here; the policy has its own pgTAP test.

const cacheTag = vi.fn();
const cacheLife = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const maybeSingle = vi.fn();
const error = vi.fn();

vi.mock("next/cache", () => ({ cacheTag, cacheLife }));
vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/server/supabase/public", () => ({
  createPublicSupabase: () => ({
    from: (table: string) => ({ select: select.mockImplementation(() => ({ eq })), table }),
  }),
}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/features/content-categories", () => ({
  getPublicCategories: async () => [{ id: "cat-1", slug: "buying-guide", name: "Buying guide" }],
}));

const { getBlogArticle, getPublishedBlogPostById } = await import("../queries");
const { PUBLIC_POST_COLUMNS } = await import("../view");

const ID = "a1000000-0000-4000-8000-000000000001";
const ROW = {
  id: ID,
  slug: "registration-charges",
  title: "Registration charges explained",
  excerpt: "A summary.",
  body: [{ type: "paragraph", text: "The charge is paid at the office." }],
  cover_path: null,
  cover_alt: null,
  category_id: "cat-1",
  tags: [],
  author_name: "Asha Rao",
  status: "published",
  published_at: "2026-11-05T08:00:00.000Z",
  seo_title: null,
  seo_description: null,
  read_minutes: 1,
  updated_at: "2026-11-05T08:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  eq.mockReturnValue({ maybeSingle });
  maybeSingle.mockResolvedValue({ data: ROW, error: null });
});

describe("UT-blog-article-by-id: getPublishedBlogPostById", () => {
  it("reads the public columns of the row with that id, and turns it into the page's own view", async () => {
    const article = await getPublishedBlogPostById(ID);
    expect(select).toHaveBeenCalledWith(PUBLIC_POST_COLUMNS);
    expect(eq).toHaveBeenCalledWith("id", ID);
    expect(article).toMatchObject({
      id: ID,
      slug: "registration-charges",
      title: "Registration charges explained",
      category: { slug: "buying-guide", name: "Buying guide" },
      body: [{ type: "paragraph", text: "The charge is paid at the office." }],
    });
  });

  it("is cached under the Blog's tag, which every article change refreshes", async () => {
    await getPublishedBlogPostById(ID);
    expect(cacheTag).toHaveBeenCalledWith(CACHE_TAGS.blog);
    expect(tagsAfterBlogChange("registration-charges")).toContain(CACHE_TAGS.blog);
    expect(cacheLife).toHaveBeenCalledWith("minutes");
  });

  it("answers null when the row policy shows nothing (a draft, an archived article, Trash, no such id)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getPublishedBlogPostById(ID)).toBeNull();
  });

  it("throws on a failed read, so the failure is not cached as 'no such article', and logs only the code", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "XX000" } });
    await expect(getPublishedBlogPostById(ID)).rejects.toMatchObject({ code: "XX000" });
    expect(error).toHaveBeenCalledWith("a blog article could not be read", { errorCode: "XX000" });
  });

  it("leaves the page's own read by address as it was, on the same helper", async () => {
    await getBlogArticle("registration-charges");
    expect(eq).toHaveBeenCalledWith("slug", "registration-charges");
    expect(cacheTag).toHaveBeenCalledWith(CACHE_TAGS.blog, "blog-post:registration-charges");
  });
});
