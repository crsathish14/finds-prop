import { beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE_TAGS, tagsAfterBlogChange, tagsAfterFaqChange } from "@/lib/cache-tags";
import { CONTENT_SNIPPET_CHARACTERS } from "@/config/ai";

// UT-ai-content-queries (ADR-143 section 6): the reads behind search_content and get_content_item. The Blog's and the
// FAQ's own reads and the module switch are stand-ins here (their rules, the row policy and the module helper, have
// their own tests); what is checked is that nothing is read from a module that is off, that the two kinds take turns,
// and that a result is small and plain. Everything below is made up.

const getBlogList = vi.fn();
const getPublishedBlogPostById = vi.fn();
const searchPublicFaqs = vi.fn();
const getPublicFaqs = vi.fn();
const getContentModuleOn = vi.fn();

vi.mock("@/features/blog", async () => {
  const { blocksToPlainText } = await import("@/features/blog/body-text");
  return { blocksToPlainText, getBlogList, getPublishedBlogPostById };
});
vi.mock("@/features/faq", async () => {
  const { answerParagraphs } = await import("@/features/faq/view");
  return { answerParagraphs, getPublicFaqs, searchPublicFaqs };
});
vi.mock("@/features/site", () => ({ getContentModuleOn }));

const { readContentItem, searchContent } = await import("../content-queries");

const card = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: `a100000${index}-0000-4000-8000-00000000000${index}`,
  slug: `guide-${index}`,
  title: `Guide ${index}`,
  excerpt: `The excerpt of guide ${index}.`,
  snippet: `…the [[registration]] charge of guide ${index} is paid at the office…`,
  category: { slug: "buying-guide", name: "Buying guide" },
  publishedAt: "2026-11-05T08:00:00.000Z",
  ...overrides,
});

const question = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: `f100000${index}-0000-4000-8000-00000000000${index}`,
  question: `Question ${index}?`,
  answer: `First paragraph of answer ${index}.\n\nRegistration is paid at the sub-registrar office for answer ${index}.`,
  categorySlug: "selling",
  categoryName: "Selling",
  updatedAt: "2026-11-06T08:00:00.000Z",
  ...overrides,
});

function modulesOn(blog: boolean, faq: boolean) {
  getContentModuleOn.mockImplementation(async (module: string) =>
    module === "blog" ? blog : module === "faq" ? faq : false,
  );
}

const REQUEST = {
  query: "registration charges",
  kind: "any",
  categorySlug: null,
  limit: 5,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  modulesOn(true, true);
  getBlogList.mockResolvedValue({ items: [card(0), card(1), card(2)] });
  searchPublicFaqs.mockResolvedValue([question(0), question(1)]);
});

describe("UT-ai-content-queries: searching", () => {
  it("asks the Blog and the FAQ for the words, the category and the number wanted, and nothing else", async () => {
    await searchContent({ ...REQUEST, categorySlug: "selling", limit: 3 });
    expect(getBlogList).toHaveBeenCalledWith({
      query: "registration charges",
      category: "selling",
      page: 1,
    });
    expect(searchPublicFaqs).toHaveBeenCalledWith({
      query: "registration charges",
      categorySlug: "selling",
      limit: 3,
    });
  });

  it("takes turns between articles and questions, an article first, and never more than the limit", async () => {
    const hits = await searchContent({ ...REQUEST, limit: 4 });
    expect(hits.map((hit) => `${hit.kind}:${hit.title}`)).toEqual([
      "article:Guide 0",
      "faq:Question 0?",
      "article:Guide 1",
      "faq:Question 1?",
    ]);
  });

  it("keeps the order the database gave inside a kind, and fills from the longer list when the other runs out", async () => {
    searchPublicFaqs.mockResolvedValue([question(0)]);
    const hits = await searchContent(REQUEST);
    expect(hits.map((hit) => hit.id)).toEqual([card(0).id, question(0).id, card(1).id, card(2).id]);
  });

  it("asks only for the kind wanted", async () => {
    await searchContent({ ...REQUEST, kind: "faq" });
    expect(getBlogList).not.toHaveBeenCalled();
    expect(searchPublicFaqs).toHaveBeenCalled();
    vi.clearAllMocks();
    modulesOn(true, true);
    getBlogList.mockResolvedValue({ items: [] });
    await searchContent({ ...REQUEST, kind: "article" });
    expect(searchPublicFaqs).not.toHaveBeenCalled();
    expect(getBlogList).toHaveBeenCalled();
  });

  it("reads nothing from a module that is switched off, and gives an empty result when both are off", async () => {
    modulesOn(false, true);
    expect((await searchContent(REQUEST)).every((hit) => hit.kind === "faq")).toBe(true);
    expect(getBlogList).not.toHaveBeenCalled();
    vi.clearAllMocks();
    modulesOn(true, false);
    getBlogList.mockResolvedValue({ items: [card(0)] });
    expect((await searchContent(REQUEST)).every((hit) => hit.kind === "article")).toBe(true);
    expect(searchPublicFaqs).not.toHaveBeenCalled();
    vi.clearAllMocks();
    modulesOn(false, false);
    expect(await searchContent(REQUEST)).toEqual([]);
    expect(getBlogList).not.toHaveBeenCalled();
    expect(searchPublicFaqs).not.toHaveBeenCalled();
  });

  it("reads the switch only through the module helper, for the two modules the tools use", async () => {
    await searchContent(REQUEST);
    expect(getContentModuleOn.mock.calls.map(([module]) => module).sort()).toEqual(["blog", "faq"]);
  });

  it("shows the matched words as plain text, in a passage of about the snippet size", async () => {
    getBlogList.mockResolvedValue({
      items: [card(0, { snippet: `[[registration]] ${"charge ".repeat(200)}` })],
    });
    const [hit] = await searchContent({ ...REQUEST, kind: "article" });
    expect(hit?.passage).not.toContain("[[");
    expect(hit?.passage).not.toContain("]]");
    expect(hit?.passage.length).toBeLessThanOrEqual(CONTENT_SNIPPET_CHARACTERS);
    expect(hit?.passage).not.toContain("\n");
  });

  it("falls back to the excerpt when the search gave no passage", async () => {
    getBlogList.mockResolvedValue({ items: [card(0, { snippet: null })] });
    const [hit] = await searchContent({ ...REQUEST, kind: "article" });
    expect(hit?.passage).toBe("The excerpt of guide 0.");
  });

  it("cuts the passage of a question from the paragraph that holds the words", async () => {
    const [hit] = await searchContent({ ...REQUEST, kind: "faq" });
    expect(hit).toMatchObject({
      kind: "faq",
      slug: null,
      categorySlug: "selling",
      passage: "Registration is paid at the sub-registrar office for answer 0.",
    });
  });

  it("names the article's address word and category for the source link", async () => {
    const [hit] = await searchContent({ ...REQUEST, kind: "article" });
    expect(hit).toMatchObject({
      kind: "article",
      id: card(0).id,
      slug: "guide-0",
      categoryName: "Buying guide",
      categorySlug: "buying-guide",
      date: "2026-11-05T08:00:00.000Z",
    });
  });

  it("lets a failed read fail the call (the tool turns it into an unavailable result)", async () => {
    getBlogList.mockRejectedValue(new Error("down"));
    await expect(searchContent(REQUEST)).rejects.toThrow("down");
  });
});

describe("UT-ai-content-queries: reading one item", () => {
  const article = {
    id: card(0).id,
    slug: "guide-0",
    title: "Guide 0",
    excerpt: "A short summary.",
    category: { slug: "buying-guide", name: "Buying guide" },
    publishedAt: "2026-11-05T08:00:00.000Z",
    body: [
      { type: "paragraph", text: "An opening paragraph." },
      { type: "heading", level: 2, text: "Stamp duty" },
      { type: "paragraph", text: "Stamp duty is paid first." },
      { type: "list", ordered: false, items: ["PAN card", "Sale deed"] },
      { type: "heading", level: 2, text: "Registration" },
      { type: "quote", text: "Register soon.", cite: "A clerk" },
    ],
  };

  it("splits an article at its headings, after the summary", async () => {
    getPublishedBlogPostById.mockResolvedValue(article);
    const item = await readContentItem(article.id);
    expect(item).toMatchObject({
      kind: "article",
      id: article.id,
      slug: "guide-0",
      title: "Guide 0",
      categoryName: "Buying guide",
      date: "2026-11-05T08:00:00.000Z",
    });
    expect(item?.sections).toEqual([
      "A short summary.",
      "An opening paragraph.",
      "Stamp duty\nStamp duty is paid first.\nPAN card Sale deed",
      "Registration\nRegister soon. A clerk",
    ]);
    expect(getPublicFaqs).not.toHaveBeenCalled();
  });

  it("finds a question by its id when no article has it, as its paragraphs", async () => {
    getPublishedBlogPostById.mockResolvedValue(null);
    getPublicFaqs.mockResolvedValue([question(0), question(1)]);
    const item = await readContentItem(question(1).id);
    expect(item).toMatchObject({
      kind: "faq",
      id: question(1).id,
      slug: null,
      title: "Question 1?",
      categoryName: "Selling",
      date: "2026-11-06T08:00:00.000Z",
    });
    expect(item?.sections).toHaveLength(2);
  });

  it("answers null for an id nothing published has, and for an id of a module that is switched off", async () => {
    getPublishedBlogPostById.mockResolvedValue(null);
    getPublicFaqs.mockResolvedValue([question(0)]);
    expect(await readContentItem("a1000000-0000-4000-8000-0000000000ff")).toBeNull();
    vi.clearAllMocks();
    modulesOn(false, false);
    expect(await readContentItem(article.id)).toBeNull();
    expect(getPublishedBlogPostById).not.toHaveBeenCalled();
    expect(getPublicFaqs).not.toHaveBeenCalled();
    vi.clearAllMocks();
    modulesOn(false, true);
    getPublicFaqs.mockResolvedValue([question(0)]);
    expect(await readContentItem(article.id)).toBeNull();
    expect(getPublishedBlogPostById).not.toHaveBeenCalled();
  });
});

describe("UT-ai-content-queries: a publish, an unpublish or a delete changes the answer at once (ADR-143 section 6.4)", () => {
  it("the article change helper refreshes the Blog's tag, the one the cached read of an item carries", () => {
    expect(tagsAfterBlogChange("any-slug")).toContain(CACHE_TAGS.blog);
  });

  it("the question change helper refreshes the FAQ's tag, the one the cached list the item read uses carries", () => {
    expect(tagsAfterFaqChange()).toContain(CACHE_TAGS.faq);
  });
});
