import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  modules: vi.fn(),
  list: vi.fn(),
  counts: vi.fn(),
  usage: vi.fn(),
  one: vi.fn(),
  departments: vi.fn(),
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
  getAdminCategories: mocks.departments,
  createContentCategory: "create department",
  updateContentCategory: "update department",
  setContentCategoryActive: "set department active",
  deleteContentCategory: "delete department",
}));
vi.mock("@/features/careers", () => ({
  CareersAdminBoard: () => null,
  JobEditor: () => null,
  getAdminJobList: mocks.list,
  getAdminJobCounts: mocks.counts,
  getJobDepartmentUsage: mocks.usage,
  getAdminJob: mocks.one,
  createJobPosting: "create job",
  updateJobPosting: "update job",
  openJobPosting: "open job",
  closeJobPosting: "close job",
  trashJobPosting: "trash job",
  restoreJobPosting: "restore job",
  adminJobsHref: (choice: { status?: string }) => `/admin/careers?status=${choice.status}`,
  parseAdminJobParams: (raw: Record<string, string | undefined>) => ({
    status: raw["status"] ?? "all",
    department: raw["department"] ?? "",
    query: raw["q"] ?? "",
    page: Number(raw["page"] ?? 1),
  }),
}));

const { default: ListPage } = await import("../careers/page");
const { default: NewPage } = await import("../careers/new/page");
const { default: EditPage } = await import("../careers/[id]/page");

type Child = { type: unknown; props: Record<string, unknown> };
const DEPARTMENTS = [
  { id: "d1", slug: "sales", name: "Sales", active: true },
  { id: "d2", slug: "legal", name: "Legal", active: false },
];
const MODULES = [{ module: "careers", live: false, published: 2, drafts: 1 }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modules.mockResolvedValue(MODULES);
  mocks.departments.mockResolvedValue(DEPARTMENTS);
  mocks.list.mockResolvedValue({ rows: [{ id: "a" }], total: 41, page: 2, pageCount: 3 });
  mocks.counts.mockResolvedValue({ draft: 1, open: 2, closed: 0, trash: 3 });
  mocks.usage.mockResolvedValue({ d1: 2 });
});

describe("the admin Careers list page (ADR-143)", () => {
  async function render(raw: Record<string, string> = {}) {
    const element = (await ListPage({ searchParams: Promise.resolve(raw) })) as {
      props: { children: Child[] };
    };
    return element.props.children;
  }

  it("keeps the module's switch bar first, and the page works whatever the switch says", async () => {
    const [bar] = await render();
    expect(bar?.props["module"]).toBe("careers");
    expect(bar?.props["modules"]).toEqual(MODULES);
    expect(bar?.props["save"]).toBe("the save action");
  });

  it("asks the list for the tab, department, words and page of the address, and hands the board what it read", async () => {
    const [, board] = await render(
      Object.fromEntries(new URLSearchParams("status=draft&department=d1&q=engineer&page=2")),
    );
    expect(mocks.list).toHaveBeenCalledWith({
      status: "draft",
      departmentId: "d1",
      query: "engineer",
      page: 2,
    });
    expect(mocks.departments).toHaveBeenCalledWith("department");
    expect(board?.props).toMatchObject({
      rows: [{ id: "a" }],
      total: 41,
      page: 2,
      pageCount: 3,
      counts: { draft: 1, open: 2, closed: 0, trash: 3 },
      departments: DEPARTMENTS,
      usage: { d1: 2 },
      params: { status: "draft", department: "d1", query: "engineer", page: 2 },
      actions: {
        open: "open job",
        close: "close job",
        trash: "trash job",
        restore: "restore job",
      },
      departmentActions: {
        create: "create department",
        update: "update department",
        setActive: "set department active",
        remove: "delete department",
      },
    });
  });

  it("asks for every status and no department when the address chose none", async () => {
    await render();
    expect(mocks.list).toHaveBeenCalledWith({
      status: null,
      departmentId: null,
      query: "",
      page: 1,
    });
  });
});

describe("the admin new job page (ADR-143)", () => {
  it("offers the job departments, marking a hidden one, and starts in the department the list was narrowed to", async () => {
    const element = (await NewPage({
      searchParams: Promise.resolve({ department: "d2" }),
    })) as unknown as Child;
    expect(mocks.departments).toHaveBeenCalledWith("department");
    expect(element.props["job"]).toBeNull();
    expect(element.props["departments"]).toEqual([
      { value: "d1", label: "Sales" },
      { value: "d2", label: "admin.careers.hiddenDepartment" },
    ]);
    expect(element.props["initialDepartment"]).toBe("d2");
    expect(element.props["actions"]).toEqual({ create: "create job", update: "update job" });
    expect(element.props["statusActions"]).toEqual({ open: "open job", close: "close job" });
  });

  it("ignores a department that is not one of the job departments", async () => {
    const element = (await NewPage({
      searchParams: Promise.resolve({ department: "elsewhere" }),
    })) as unknown as Child;
    expect(element.props).not.toHaveProperty("initialDepartment");
  });
});

describe("the admin edit job page (ADR-143, ADR-147)", () => {
  const ID = "00000000-0000-4000-a400-000000000001";
  const run = (id: string) => EditPage({ params: Promise.resolve({ id }) });

  it("opens the editor with the stored job, and a key that changes with every save", async () => {
    mocks.one.mockResolvedValue({ id: ID, trashed: false, updatedAt: "2026-11-21T10:00:00Z" });
    const element = (await run(ID.toUpperCase())) as unknown as Child & { key: string };
    expect(mocks.one).toHaveBeenCalledWith(ID);
    expect(element.props["job"]).toMatchObject({ id: ID });
    expect(element.key).toBe("2026-11-21T10:00:00Z");
    expect((element.props["actions"] as Record<string, string>)["update"]).toBe("update job");
  });

  it("is not found for an address that is not an id and for a job that does not exist", async () => {
    await expect(run("not-an-id")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.one).not.toHaveBeenCalled();
    mocks.one.mockResolvedValue(null);
    await expect(run(ID)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends a job in the Trash to the Trash tab of the list, where it can be restored", async () => {
    mocks.one.mockResolvedValue({ id: ID, trashed: true, updatedAt: "2026-11-21T10:00:00Z" });
    await expect(run(ID)).rejects.toThrow("NEXT_REDIRECT /admin/careers?status=trash");
  });
});
