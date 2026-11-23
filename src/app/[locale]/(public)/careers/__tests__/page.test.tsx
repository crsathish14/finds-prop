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
vi.mock("@/features/careers", () => ({
  CareersListScreen: () => null,
  careersListMetadata: mocks.metadata,
  getCareersPage: mocks.page,
  parsePublicJobParams: (raw: Record<string, string | undefined>) => ({
    query: raw["q"] ?? "",
    department: raw["department"] ?? "",
    location: raw["location"] ?? "",
    mode: raw["mode"] ?? "",
    type: raw["type"] ?? "",
    page: Number(raw["page"] ?? 1),
  }),
}));

const { default: CareersPage, generateMetadata } = await import("../page");

type Element = { props: { children: { props: Record<string, unknown> } } };
const ask = (text: string) => Promise.resolve(Object.fromEntries(new URLSearchParams(text)));

const DATA = {
  list: { items: [{ id: "a" }], total: 1, page: 1, pageSize: 12, pageCount: 1 },
  filters: { departments: [], locations: [], total: 1 },
  department: "",
  nothingOpen: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.require.mockResolvedValue(undefined);
  mocks.page.mockResolvedValue(DATA);
});

describe("the public /careers page (ADR-143)", () => {
  it("asks for the Careers module first, and answers not-found without reading anything when it is off", async () => {
    mocks.require.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(CareersPage({ searchParams: ask("") })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.require).toHaveBeenCalledWith("careers");
    expect(mocks.page).not.toHaveBeenCalled();
  });

  it("reads the page for the words, filters and page of the address, and hands the screen what it read", async () => {
    const element = (await CareersPage({
      searchParams: ask("q=engineer&department=sales&location=Chennai&mode=remote&type=contract"),
    })) as unknown as Element;
    const params = {
      query: "engineer",
      department: "sales",
      location: "Chennai",
      mode: "remote",
      type: "contract",
      page: 1,
    };
    expect(mocks.page).toHaveBeenCalledWith(params);
    expect(element.props.children.props).toEqual({ data: DATA, params });
  });

  it("is not found for a page past the last one, but shows page 1 of an empty list", async () => {
    mocks.page.mockResolvedValue({ ...DATA, list: { ...DATA.list, page: 5 } });
    await expect(CareersPage({ searchParams: ask("page=5") })).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.page.mockResolvedValue({
      ...DATA,
      list: { items: [], total: 0, page: 1, pageSize: 12, pageCount: 1 },
      nothingOpen: true,
    });
    await expect(CareersPage({ searchParams: ask("") })).resolves.toBeDefined();
  });

  it("makes the page metadata from the address, with the site translator", async () => {
    mocks.metadata.mockReturnValue({ title: "the title" });
    const metadata = await generateMetadata({ searchParams: ask("q=engineer") });
    expect(mocks.metadata).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ query: "engineer", page: 1 }),
    );
    expect(metadata).toEqual({ title: "the title" });
  });
});
