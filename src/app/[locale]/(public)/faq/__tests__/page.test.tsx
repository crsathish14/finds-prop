import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  require: vi.fn(),
  page: vi.fn(),
  metadata: vi.fn(),
}));

vi.mock("@/features/site", () => ({
  requireContentModule: mocks.require,
  getTranslate: async () => (key: string) => key,
}));
vi.mock("@/features/faq", () => ({
  FaqScreen: () => null,
  faqMetadata: mocks.metadata,
  getFaqPage: mocks.page,
  parsePublicFaqParams: (raw: Record<string, string | undefined>) => ({
    query: raw["q"] ?? "",
    category: raw["category"] ?? "",
  }),
}));

const { default: FaqPage, generateMetadata } = await import("../page");

type Element = { props: { children: { props: Record<string, unknown> } } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.require.mockResolvedValue(undefined);
  mocks.page.mockResolvedValue({
    faqs: [{ id: "a" }],
    categories: [{ slug: "buyers", name: "Buyers" }],
    category: "",
    nothingPublished: false,
  });
});

describe("the public /faq page (ADR-143)", () => {
  it("asks for the FAQ module first, and answers not-found without reading anything when it is off", async () => {
    mocks.require.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(FaqPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.require).toHaveBeenCalledWith("faq");
    expect(mocks.page).not.toHaveBeenCalled();
  });

  it("reads the page for the words and the category of the address, and hands the screen what it read", async () => {
    const element = (await FaqPage({
      searchParams: Promise.resolve(
        Object.fromEntries(new URLSearchParams("q=deed&category=buyers")),
      ),
    })) as unknown as Element;
    expect(mocks.page).toHaveBeenCalledWith({ query: "deed", category: "buyers" });
    expect(element.props.children.props).toEqual({
      faqs: [{ id: "a" }],
      categories: [{ slug: "buyers", name: "Buyers" }],
      params: { query: "deed", category: "" },
      nothingPublished: false,
    });
  });

  it("makes the page's metadata from the address, with the site's translator", async () => {
    mocks.metadata.mockReturnValue({ title: "the title" });
    const metadata = await generateMetadata({
      searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams("q=deed"))),
    });
    expect(mocks.metadata).toHaveBeenCalledWith(expect.any(Function), {
      query: "deed",
      category: "",
    });
    expect(metadata).toEqual({ title: "the title" });
  });
});
