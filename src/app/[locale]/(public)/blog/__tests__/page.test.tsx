import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  require: vi.fn(),
  page: vi.fn(),
  metadata: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/site", () => ({
  requireContentModule: mocks.require,
  getTranslate: async () => (key: string) => key,
}));
vi.mock("@/features/blog", () => ({
  BlogListScreen: () => null,
  blogListMetadata: mocks.metadata,
  getBlogPage: mocks.page,
  parsePublicBlogParams: (raw: Record<string, string | undefined>) => ({
    query: raw["q"] ?? "",
    category: raw["category"] ?? "",
    tag: raw["tag"] ?? "",
    page: Number(raw["page"] ?? 1),
  }),
}));

const { default: BlogPage, generateMetadata } = await import("../page");

type Element = { props: { children: { props: Record<string, unknown> } } };
const ask = (text: string) => Promise.resolve(Object.fromEntries(new URLSearchParams(text)));

const DATA = {
  list: { items: [{ id: "a" }], total: 1, page: 1, pageSize: 12, pageCount: 1 },
  categories: [{ slug: "guides", name: "Guides" }],
  tags: [],
  category: "",
  nothingPublished: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.require.mockResolvedValue(undefined);
  mocks.page.mockResolvedValue(DATA);
});

describe("the public /blog page (ADR-143)", () => {
  it("asks for the Blog module first, and answers not-found without reading anything when it is off", async () => {
    mocks.require.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(BlogPage({ searchParams: ask("") })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.require).toHaveBeenCalledWith("blog");
    expect(mocks.page).not.toHaveBeenCalled();
  });

  it("reads the page for the words, category, tag and page of the address, and hands the screen what it read", async () => {
    const element = (await BlogPage({
      searchParams: ask("q=loan&category=guides&tag=home-loans"),
    })) as unknown as Element;
    expect(mocks.page).toHaveBeenCalledWith({
      query: "loan",
      category: "guides",
      tag: "home-loans",
      page: 1,
    });
    expect(element.props.children.props).toEqual({
      data: DATA,
      params: { query: "loan", category: "guides", tag: "home-loans", page: 1 },
    });
  });

  it("is not found for a page past the last one, but shows page 1 of an empty list", async () => {
    mocks.page.mockResolvedValue({ ...DATA, list: { ...DATA.list, page: 5 } });
    await expect(BlogPage({ searchParams: ask("page=5") })).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.page.mockResolvedValue({
      ...DATA,
      list: { items: [], total: 0, page: 1, pageSize: 12, pageCount: 1 },
      nothingPublished: true,
    });
    await expect(BlogPage({ searchParams: ask("") })).resolves.toBeDefined();
  });

  it("makes the page's metadata from the address, with the site's translator", async () => {
    mocks.metadata.mockReturnValue({ title: "the title" });
    const metadata = await generateMetadata({ searchParams: ask("q=loan") });
    expect(mocks.metadata).toHaveBeenCalledWith(expect.any(Function), {
      query: "loan",
      category: "",
      tag: "",
      page: 1,
    });
    expect(metadata).toEqual({ title: "the title" });
  });
});
