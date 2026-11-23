import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  modules: vi.fn(),
  list: vi.fn(),
  counts: vi.fn(),
  usage: vi.fn(),
  one: vi.fn(),
  categories: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/features/content-modules", () => ({
  ContentModulePageBar: () => null,
  getContentModulesView: mocks.modules,
}));
vi.mock("@/features/site-content", () => ({ saveContentModules: "the save action" }));
vi.mock("@/features/site", () => ({ getTranslate: async () => (key: string) => key }));
vi.mock("@/features/content-categories", () => ({
  getAdminCategories: mocks.categories,
  createContentCategory: "create category",
  updateContentCategory: "update category",
  setContentCategoryActive: "set category active",
  deleteContentCategory: "delete category",
}));
vi.mock("@/features/blog", () => ({
  BlogAdminBoard: () => null,
  BlogEditor: () => null,
  BlogMarkdownScreen: () => null,
  ADMIN_BLOG_NEW_PATH: "/admin/blog/new",
  ADMIN_BLOG_PATH: "/admin/blog",
  getAdminBlogList: mocks.list,
  getAdminBlogCounts: mocks.counts,
  getBlogCategoryUsage: mocks.usage,
  getAdminBlogPost: mocks.one,
  createBlogPost: "create post",
  createBlogPostFromMarkdown: "create from markdown",
  updateBlogPost: "update post",
  setBlogCover: "set cover",
  publishBlogPost: "publish post",
  unpublishBlogPost: "unpublish post",
  archiveBlogPost: "archive post",
  trashBlogPost: "trash post",
  restoreBlogPost: "restore post",
  adminBlogHref: (choice: { status?: string }) => `/admin/blog?status=${choice.status}`,
  parseAdminBlogParams: (raw: Record<string, string | undefined>) => ({
    status: raw["status"] ?? "all",
    category: raw["category"] ?? "",
    query: raw["q"] ?? "",
    page: Number(raw["page"] ?? 1),
  }),
}));

const { default: ListPage } = await import("../blog/page");
const { default: NewPage } = await import("../blog/new/page");
const { default: EditPage } = await import("../blog/[id]/page");

type Child = { type: unknown; props: Record<string, unknown> };
const CATEGORIES = [
  { id: "c1", slug: "guides", name: "Guides", active: true },
  { id: "c2", slug: "news", name: "News", active: false },
];
const MODULES = [{ module: "blog", live: false, published: 2, drafts: 1 }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modules.mockResolvedValue(MODULES);
  mocks.categories.mockResolvedValue(CATEGORIES);
  mocks.list.mockResolvedValue({ rows: [{ id: "a" }], total: 41, page: 2, pageCount: 3 });
  mocks.counts.mockResolvedValue({ draft: 1, published: 2, archived: 0, trash: 3 });
  mocks.usage.mockResolvedValue({ c1: 2 });
});

describe("the admin Blog list page (ADR-143)", () => {
  async function render(raw: Record<string, string> = {}) {
    const element = (await ListPage({ searchParams: Promise.resolve(raw) })) as {
      props: { children: Child[] };
    };
    return element.props.children;
  }

  it("keeps the module's switch bar first, and the page works whatever the switch says", async () => {
    const [bar] = await render();
    expect(bar?.props["module"]).toBe("blog");
    expect(bar?.props["modules"]).toEqual(MODULES);
    expect(bar?.props["save"]).toBe("the save action");
  });

  it("asks the list for the tab, category, words and page of the address, and hands the board what it read", async () => {
    const [, board] = await render(
      Object.fromEntries(new URLSearchParams("status=draft&category=c1&q=loan&page=2")),
    );
    expect(mocks.list).toHaveBeenCalledWith({
      status: "draft",
      categoryId: "c1",
      query: "loan",
      page: 2,
    });
    expect(mocks.categories).toHaveBeenCalledWith("blog");
    expect(board?.props).toMatchObject({
      rows: [{ id: "a" }],
      total: 41,
      page: 2,
      pageCount: 3,
      counts: { draft: 1, published: 2, archived: 0, trash: 3 },
      categories: CATEGORIES,
      usage: { c1: 2 },
      params: { status: "draft", category: "c1", query: "loan", page: 2 },
      actions: {
        publish: "publish post",
        unpublish: "unpublish post",
        archive: "archive post",
        trash: "trash post",
        restore: "restore post",
      },
      categoryActions: {
        create: "create category",
        update: "update category",
        setActive: "set category active",
        remove: "delete category",
      },
    });
  });

  it("asks for every status and no category when the address chose none", async () => {
    await render();
    expect(mocks.list).toHaveBeenCalledWith({
      status: null,
      categoryId: null,
      query: "",
      page: 1,
    });
  });
});

describe("the admin new article page: the block editor (ADR-143, ADR-172)", () => {
  it("offers the Blog's categories, marking a hidden one, and starts in the category the list was narrowed to", async () => {
    const element = (await NewPage({
      searchParams: Promise.resolve({ method: "blocks", category: "c2" }),
    })) as unknown as Child;
    expect(mocks.categories).toHaveBeenCalledWith("blog");
    expect(element.props["post"]).toBeNull();
    expect(element.props["categories"]).toEqual([
      { id: "c1", slug: "guides", name: "Guides" },
      { id: "c2", slug: "news", name: "admin.blog.category.hidden" },
    ]);
    expect(element.props["initialCategory"]).toBe("c2");
    expect(element.props["actions"]).toEqual({
      create: "create post",
      update: "update post",
      setCover: "set cover",
    });
  });

  it("ignores a category that is not one of the Blog's", async () => {
    const element = (await NewPage({
      searchParams: Promise.resolve({ method: "blocks", category: "elsewhere" }),
    })) as unknown as Child;
    expect(element.props).not.toHaveProperty("initialCategory");
  });
});

describe("the admin new article page: choosing how to start (ADR-172)", () => {
  type Tree = { type: unknown; props: Record<string, unknown> };
  const chooserOf = (element: Tree): Tree => {
    const children = element.props["children"] as Tree[];
    return children[children.length - 1] as Tree;
  };

  it("asks first when no way is chosen, and the cards go to the two ways", async () => {
    const element = (await NewPage({ searchParams: Promise.resolve({}) })) as unknown as Tree;
    expect(element.type).toBe("div");
    const chooser = chooserOf(element);
    expect(chooser.props["blocksHref"]).toBe("/admin/blog/new?method=blocks");
    expect(chooser.props["markdownHref"]).toBe("/admin/blog/new?method=markdown");
  });

  it("keeps the category the list was narrowed to in both cards, and drops one that is not the Blog's", async () => {
    const narrowed = chooserOf(
      (await NewPage({ searchParams: Promise.resolve({ category: "c1" }) })) as unknown as Tree,
    );
    expect(narrowed.props["blocksHref"]).toBe("/admin/blog/new?method=blocks&category=c1");
    expect(narrowed.props["markdownHref"]).toBe("/admin/blog/new?method=markdown&category=c1");
    const other = chooserOf(
      (await NewPage({ searchParams: Promise.resolve({ category: "x" }) })) as unknown as Tree,
    );
    expect(other.props["blocksHref"]).toBe("/admin/blog/new?method=blocks");
  });

  it("asks again for a way it does not know", async () => {
    const element = (await NewPage({
      searchParams: Promise.resolve({ method: "html" }),
    })) as unknown as Tree;
    expect(element.type).toBe("div");
  });

  it("opens the paste flow with the categories and the Markdown action only", async () => {
    const element = (await NewPage({
      searchParams: Promise.resolve({ method: "markdown", category: "c2" }),
    })) as unknown as Tree;
    expect(element.props["categories"]).toEqual([
      { id: "c1", name: "Guides" },
      { id: "c2", name: "admin.blog.category.hidden" },
    ]);
    expect(element.props["initialCategory"]).toBe("c2");
    expect(element.props["actions"]).toEqual({ create: "create from markdown" });
  });
});

describe("the admin edit article page (ADR-143, ADR-144)", () => {
  const ID = "00000000-0000-4000-a400-000000000001";
  const run = (id: string) => EditPage({ params: Promise.resolve({ id }) });

  it("opens the editor with the stored article, and a key that changes with every save", async () => {
    mocks.one.mockResolvedValue({ id: ID, trashed: false, updatedAt: "2026-11-20T10:00:00Z" });
    const element = (await run(ID.toUpperCase())) as unknown as Child & { key: string };
    expect(mocks.one).toHaveBeenCalledWith(ID);
    expect(element.props["post"]).toMatchObject({ id: ID });
    expect(element.key).toBe("2026-11-20T10:00:00Z");
    expect((element.props["actions"] as Record<string, string>)["update"]).toBe("update post");
  });

  it("is not found for an address that is not an id and for an article that does not exist", async () => {
    await expect(run("not-an-id")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.one).not.toHaveBeenCalled();
    mocks.one.mockResolvedValue(null);
    await expect(run(ID)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends an article in the Trash to the Trash tab of the list, where it can be restored", async () => {
    mocks.one.mockResolvedValue({ id: ID, trashed: true, updatedAt: "2026-11-20T10:00:00Z" });
    await expect(run(ID)).rejects.toThrow("NEXT_REDIRECT /admin/blog?status=trash");
  });
});
