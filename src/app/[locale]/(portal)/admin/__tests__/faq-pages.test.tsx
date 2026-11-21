import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  modules: vi.fn(),
  list: vi.fn(),
  one: vi.fn(),
  categories: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
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
vi.mock("@/features/faq", () => ({
  FaqAdminBoard: () => null,
  FaqEditor: () => null,
  getAdminFaqs: mocks.list,
  getAdminFaq: mocks.one,
  createFaq: "create faq",
  updateFaq: "update faq",
  publishFaq: "publish faq",
  unpublishFaq: "unpublish faq",
  trashFaq: "trash faq",
  restoreFaq: "restore faq",
  reorderFaqs: "reorder faqs",
  parseAdminFaqParams: (raw: Record<string, string | undefined>) => ({
    view: raw["view"] ?? "all",
    category: raw["category"] ?? "",
    query: raw["q"] ?? "",
  }),
}));

const { default: ListPage } = await import("../faq/page");
const { default: NewPage } = await import("../faq/new/page");
const { default: EditPage } = await import("../faq/[id]/page");

type Child = { type: unknown; props: Record<string, unknown> };
const CATEGORIES = [
  { id: "c1", name: "Buyers", active: true },
  { id: "c2", name: "Sellers", active: false },
];
const MODULES = [{ module: "faq", live: false, published: 2, drafts: 1 }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modules.mockResolvedValue(MODULES);
  mocks.categories.mockResolvedValue(CATEGORIES);
  mocks.list.mockImplementation(async ({ trashed }: { trashed: boolean }) =>
    trashed ? [{ id: "t" }] : [{ id: "a" }, { id: "b" }],
  );
});

describe("the admin FAQ list page (ADR-143)", () => {
  async function render(raw: Record<string, string> = {}) {
    const element = (await ListPage({ searchParams: Promise.resolve(raw) })) as {
      props: { children: Child[] };
    };
    return element.props.children;
  }

  it("keeps the module's switch bar first, and the page works whatever the switch says", async () => {
    const [bar] = await render();
    expect(bar?.props["module"]).toBe("faq");
    expect(bar?.props["modules"]).toEqual(MODULES);
    expect(bar?.props["save"]).toBe("the save action");
  });

  it("reads the questions outside the Trash, the Trash and the FAQ categories, and hands them to the board with the actions", async () => {
    const [, board] = await render({ view: "draft", category: "c1" });
    expect(mocks.list).toHaveBeenCalledWith({ trashed: false });
    expect(mocks.list).toHaveBeenCalledWith({ trashed: true });
    expect(mocks.categories).toHaveBeenCalledWith("faq");
    expect(board?.props).toMatchObject({
      faqs: [{ id: "a" }, { id: "b" }],
      trashed: [{ id: "t" }],
      categories: CATEGORIES,
      params: { view: "draft", category: "c1", query: "" },
      actions: {
        publish: "publish faq",
        unpublish: "unpublish faq",
        trash: "trash faq",
        restore: "restore faq",
        reorder: "reorder faqs",
      },
      categoryActions: {
        create: "create category",
        update: "update category",
        setActive: "set category active",
        remove: "delete category",
      },
    });
  });

  it("starts the board over when the tab or the category changes", async () => {
    const [, first] = await render({ view: "draft" });
    const [, second] = await render({ view: "trash" });
    expect(first?.type).toBe(second?.type);
    expect((first as unknown as { key: string }).key).not.toBe(
      (second as unknown as { key: string }).key,
    );
  });
});

describe("the admin new question page (ADR-143)", () => {
  it("offers the FAQ categories, marking a hidden one, and starts in the category the list was narrowed to", async () => {
    const element = (await NewPage({
      searchParams: Promise.resolve({ category: "c2" }),
    })) as unknown as Child;
    expect(mocks.categories).toHaveBeenCalledWith("faq");
    expect(element.props["faq"]).toBeNull();
    expect(element.props["categories"]).toEqual([
      { value: "c1", label: "Buyers" },
      { value: "c2", label: "admin.faq.category.hidden" },
    ]);
    expect(element.props["initialCategory"]).toBe("c2");
  });

  it("ignores a category that is not one of the FAQ's", async () => {
    const element = (await NewPage({
      searchParams: Promise.resolve({ category: "elsewhere" }),
    })) as unknown as Child;
    expect(element.props).not.toHaveProperty("initialCategory");
  });
});

describe("the admin edit question page (ADR-143)", () => {
  const ID = "00000000-0000-4000-a400-000000000001";
  const run = (id: string) => EditPage({ params: Promise.resolve({ id }) });

  it("opens the editor with the stored question", async () => {
    mocks.one.mockResolvedValue({ id: ID, deletedAt: null });
    const element = (await run(ID.toUpperCase())) as unknown as Child;
    expect(mocks.one).toHaveBeenCalledWith(ID);
    expect(element.props["faq"]).toEqual({ id: ID, deletedAt: null });
    expect((element.props["actions"] as Record<string, string>)["update"]).toBe("update faq");
  });

  it("is not found for an address that is not an id, for a question that does not exist and for one in the Trash", async () => {
    await expect(run("not-an-id")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.one).not.toHaveBeenCalled();
    mocks.one.mockResolvedValue(null);
    await expect(run(ID)).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.one.mockResolvedValue({ id: ID, deletedAt: "2026-11-10T10:00:00Z" });
    await expect(run(ID)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
