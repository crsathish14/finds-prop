import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  require: vi.fn(),
  moduleOn: vi.fn(),
  article: vi.fn(),
  related: vi.fn(),
  metadata: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/site", () => ({
  requireContentModule: mocks.require,
  getContentModuleOn: mocks.moduleOn,
  getTranslate: async () => (key: string) => key,
}));
vi.mock("@/features/seo", () => ({ siteOrigin: () => "https://findsprop.test" }));
vi.mock("@/features/blog", () => ({
  BlogArticleScreen: () => null,
  blogArticleMetadata: mocks.metadata,
  blogImageUrl: "the image address",
  getBlogArticle: mocks.article,
  getRelatedPosts: mocks.related,
  parseBlogSlug: (value: string) => (/^[a-z0-9-]+$/.test(value) ? value : null),
}));

const { default: ArticlePage, generateMetadata } = await import("../page");

type Element = { props: { children: { props: Record<string, unknown> } } };
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const ARTICLE = { slug: "stamp-duty", title: "Stamp duty" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.require.mockResolvedValue(undefined);
  mocks.moduleOn.mockResolvedValue(true);
  mocks.article.mockResolvedValue(ARTICLE);
  mocks.related.mockResolvedValue([{ slug: "other" }]);
});

describe("the public /blog/[slug] page (ADR-143, ADR-144)", () => {
  it("answers not-found without reading anything when the Blog module is off", async () => {
    mocks.require.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(ArticlePage(params("stamp-duty"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.require).toHaveBeenCalledWith("blog");
    expect(mocks.article).not.toHaveBeenCalled();
  });

  it("is not found for an address that is not a slug, without reading", async () => {
    await expect(ArticlePage(params("Not A Slug!"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.article).not.toHaveBeenCalled();
  });

  it("is not found for an article the public read does not give (a draft, an archived one, one in the Trash)", async () => {
    mocks.article.mockResolvedValue(null);
    await expect(ArticlePage(params("a-draft"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.related).not.toHaveBeenCalled();
  });

  it("hands the screen the article, its related articles, the picture address and the site's origin", async () => {
    const element = (await ArticlePage(params("stamp-duty"))) as unknown as Element;
    expect(mocks.article).toHaveBeenCalledWith("stamp-duty");
    expect(mocks.related).toHaveBeenCalledWith(ARTICLE);
    expect(element.props.children.props).toEqual({
      article: ARTICLE,
      related: [{ slug: "other" }],
      imageUrl: "the image address",
      origin: "https://findsprop.test",
    });
  });

  it("makes the metadata from the article, and only a title for one that is not there", async () => {
    mocks.metadata.mockReturnValue({ title: "the title" });
    expect(await generateMetadata(params("stamp-duty"))).toEqual({ title: "the title" });
    expect(mocks.metadata).toHaveBeenCalledWith(expect.any(Function), ARTICLE);
    mocks.article.mockResolvedValue(null);
    expect(await generateMetadata(params("gone"))).toEqual({ title: "notFound.title" });
    expect(await generateMetadata(params("Not A Slug!"))).toEqual({ title: "notFound.title" });
  });

  it("gives a hidden Blog module's article no metadata of its own, and does not even read it", async () => {
    mocks.moduleOn.mockResolvedValue(false);
    expect(await generateMetadata(params("stamp-duty"))).toEqual({ title: "notFound.title" });
    expect(mocks.moduleOn).toHaveBeenCalledWith("blog");
    expect(mocks.article).not.toHaveBeenCalled();
    expect(mocks.metadata).not.toHaveBeenCalled();
  });
});
