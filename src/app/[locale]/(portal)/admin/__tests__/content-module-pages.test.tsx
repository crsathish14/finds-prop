import { beforeEach, describe, expect, it, vi } from "vitest";

const read = vi.hoisted(() => ({ modules: vi.fn() }));
vi.mock("@/features/content-modules", () => ({
  ContentModulePageBar: () => null,
  getContentModulesView: read.modules,
}));
vi.mock("@/features/site-content", () => ({ saveContentModules: "the save action" }));

const MODULES = [{ module: "careers", live: true, published: null, drafts: null }];

type Child = { type: unknown; props: Record<string, unknown> };

/** The two children of a module page: the switch bar and the placeholder under it. */
async function render(load: () => Promise<{ default: () => Promise<unknown> }>) {
  const { default: Page } = await load();
  const element = (await Page()) as { props: { children: Child[] } };
  return element.props.children;
}

beforeEach(() => {
  vi.clearAllMocks();
  read.modules.mockResolvedValue(MODULES);
});

// The FAQ and Blog pages are built (ADR-143 phases 2 and 3); their own tests are faq-pages and blog-pages.
describe("the admin Careers page carries the module's switch bar until it is built (ADR-143)", () => {
  const pages = [["careers", () => import("../careers/page")]] as const;

  for (const [module, load] of pages) {
    it(`/admin/${module} puts its own module's bar first, with all three switches and the save action`, async () => {
      const [bar, placeholder] = await render(load);
      expect(bar?.props["module"]).toBe(module);
      expect(bar?.props["modules"]).toEqual(MODULES);
      expect(bar?.props["save"]).toBe("the save action");
      expect(placeholder?.props["route"]).toBe(`/admin/${module}`);
    });
  }

  it("reads the switches and counts once for the visit", async () => {
    await render(pages[0][1]);
    expect(read.modules).toHaveBeenCalledTimes(1);
  });
});
