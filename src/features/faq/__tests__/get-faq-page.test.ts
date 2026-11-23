import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ rpc }) }));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const { getFaqPage, getPublicFaqs, searchPublicFaqs } = await import("../queries");

const row = (id: string, slug: string, name: string, question: string, sortOrder = 1) => ({
  id,
  category_id: `c-${slug}`,
  category_slug: slug,
  category_name: name,
  question,
  answer: "An answer.",
  sort_order: sortOrder,
  updated_at: "2026-11-20T10:00:00Z",
});

const ALL = [
  row("a", "buyers", "Buyers", "Buy one?"),
  row("b", "buyers", "Buyers", "Buy two?", 2),
  row("c", "sellers", "Sellers", "Sell one?"),
];

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: ALL, error: null });
});

describe("UT-faq-page-data: what the public page reads (ADR-143)", () => {
  it("shows every published question with no words and no category, and the chips from the categories that have one", async () => {
    const page = await getFaqPage({ query: "", category: "" });
    expect(page.faqs.map((faq) => faq.id)).toEqual(["a", "b", "c"]);
    expect(page.categories).toEqual([
      { slug: "buyers", name: "Buyers" },
      { slug: "sellers", name: "Sellers" },
    ]);
    expect(page.category).toBe("");
    expect(page.nothingPublished).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("filters the cached list by a category, without another read", async () => {
    const page = await getFaqPage({ query: "", category: "sellers" });
    expect(page.faqs.map((faq) => faq.id)).toEqual(["c"]);
    expect(page.category).toBe("sellers");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("drops a category that has no published question, and shows everything", async () => {
    const page = await getFaqPage({ query: "", category: "tenants" });
    expect(page.category).toBe("");
    expect(page.faqs).toHaveLength(3);
  });

  it("sends words to the search function with the category, as a read of its own", async () => {
    rpc.mockResolvedValueOnce({ data: ALL, error: null });
    rpc.mockResolvedValueOnce({ data: [ALL[2]], error: null });
    const page = await getFaqPage({ query: "sell", category: "sellers" });
    expect(rpc).toHaveBeenLastCalledWith("search_faqs", {
      p_query: "sell",
      p_category: "sellers",
      p_limit: 200,
    });
    expect(page.faqs.map((faq) => faq.id)).toEqual(["c"]);
    expect(page.categories).toHaveLength(2);
  });

  it("says nothing is published when the list is empty", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const page = await getFaqPage({ query: "", category: "" });
    expect(page.nothingPublished).toBe(true);
    expect(page.faqs).toEqual([]);
  });

  it("answers an empty list, and logs, when the read fails: the page still renders", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect(await getPublicFaqs()).toEqual([]);
    expect(await searchPublicFaqs({ query: "deed" })).toEqual([]);
  });
});
