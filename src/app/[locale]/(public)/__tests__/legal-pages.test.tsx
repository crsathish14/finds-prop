import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ read: vi.fn(), metadata: vi.fn() }));

vi.mock("@/features/legal", () => ({
  LegalPage: () => null,
  getLegalDocument: mocks.read,
  legalMetadata: mocks.metadata,
}));
vi.mock("@/features/site", () => ({ getTranslate: async () => (key: string) => key }));

const privacy = await import("../privacy/page");
const terms = await import("../terms/page");
const cookies = await import("../cookies/page");

type Child = { props: { children: { props: Record<string, unknown> } } };
const DOCUMENT = { kind: "privacy", draft: false, summary: "Published.", sections: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue(DOCUMENT);
  mocks.metadata.mockReturnValue({ title: "A title" });
});

describe("UT-public-legal-pages: the three legal pages read what the admin published (ADR-151, part D)", () => {
  it.each([
    ["privacy", privacy],
    ["terms", terms],
    ["cookies", cookies],
  ] as const)("the %s page draws the text it read", async (kind, page) => {
    const element = (await page.default()) as unknown as Child;
    expect(mocks.read).toHaveBeenCalledWith(kind);
    expect(element.props.children.props).toMatchObject({ kind, document: DOCUMENT });
  });

  it.each([
    ["privacy", privacy],
    ["terms", terms],
    ["cookies", cookies],
  ] as const)("the %s page decides whether to index from the same text", async (kind, page) => {
    await page.generateMetadata();
    expect(mocks.read).toHaveBeenCalledWith(kind);
    expect(mocks.metadata).toHaveBeenCalledWith(kind, expect.any(Function), DOCUMENT);
  });
});
