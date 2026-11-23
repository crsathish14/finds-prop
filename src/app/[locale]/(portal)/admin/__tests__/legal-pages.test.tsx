import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ edit: vi.fn() }));

vi.mock("@/features/legal", () => ({
  getLegalEditPage: mocks.edit,
  saveLegal: "the save action",
}));
vi.mock("@/features/site-content", () => ({ LegalForm: () => null }));
vi.mock("@/features/site", () => ({ getTranslate: async () => (key: string) => key }));

const privacy = await import("../privacy/page");
const terms = await import("../terms/page");

type Child = { type: unknown; props: Record<string, unknown> };
const PAGE = {
  kind: "privacy",
  document: { summary: "S", sections: [] },
  hasUnpublishedChanges: true,
  published: { updated: "2026-11-22", version: "2" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.edit.mockResolvedValue(PAGE);
});

describe("UT-legal-admin-pages: the Privacy Policy and Terms of Use pages (ADR-151, part C)", () => {
  it.each([
    ["privacy", privacy],
    ["terms", terms],
  ] as const)(
    "the %s page reads its own page as the admin and gives the form the save action",
    async (kind, page) => {
      const element = (await page.default()) as unknown as Child;
      expect(mocks.edit).toHaveBeenCalledWith(kind);
      expect(element.props).toMatchObject({
        kind,
        save: "the save action",
        initial: {
          document: PAGE.document,
          hasUnpublishedChanges: true,
          published: PAGE.published,
        },
      });
    },
  );

  it("opens the form fresh when what is saved changes, so the boxes never keep old text", async () => {
    const first = (await privacy.default()) as unknown as { key: string };
    mocks.edit.mockResolvedValue({ ...PAGE, hasUnpublishedChanges: false });
    const second = (await privacy.default()) as unknown as { key: string };
    expect(first.key).not.toEqual(second.key);
  });

  it("names each page in the tab title", async () => {
    expect((await privacy.generateMetadata()).title).toBe(
      "admin.siteContent.legal.privacy.metaTitle",
    );
    expect((await terms.generateMetadata()).title).toBe("admin.siteContent.legal.terms.metaTitle");
  });
});
