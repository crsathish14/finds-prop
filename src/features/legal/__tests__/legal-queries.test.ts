import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  answer: vi.fn(),
  keys: [] as string[],
  error: vi.fn(),
  tag: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: mocks.tag }));
vi.mock("@/server/logger", () => ({ logger: { error: mocks.error } }));

/** A client that records which row it was asked for and answers what the test says. */
function client() {
  return {
    from: () => ({
      select: () => ({
        eq: (_column: string, key: string) => {
          mocks.keys.push(key);
          return { maybeSingle: () => mocks.answer() };
        },
      }),
    }),
  };
}
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => client() }));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: () => Promise.resolve(client()),
}));

const { getLegalDocument, getLegalEditPage } = await import("../queries");
const { legalDocument } = await import("../documents");

const stored = (summary: string, version: string | null = "2") => ({
  draft: false,
  updated: "2026-11-22",
  version,
  summary,
  sections: [{ id: "one", heading: "One", blocks: [{ type: "paragraph", text: "Text." }] }],
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.keys.length = 0;
});

describe("UT-legal-queries: what visitors read (ADR-151)", () => {
  it("reads the published text of the page's own row and tags it with the site content", async () => {
    mocks.answer.mockResolvedValue({
      data: { value: { published: stored("Live text."), working: stored("A draft.") } },
      error: null,
    });
    const document = await getLegalDocument("privacy");
    expect(mocks.keys).toEqual(["legal_privacy"]);
    expect(document).toMatchObject({
      kind: "privacy",
      draft: false,
      summary: "Live text.",
      version: "2",
    });
    expect(mocks.tag).toHaveBeenCalledTimes(1);
  });

  it("reads the Terms from the Terms row", async () => {
    mocks.answer.mockResolvedValue({
      data: { value: { published: stored("Terms.") } },
      error: null,
    });
    await getLegalDocument("terms");
    expect(mocks.keys).toEqual(["legal_terms"]);
  });

  it("shows the text in code when nothing is published, when only a draft is saved, or when there is no row", async () => {
    for (const data of [null, { value: { working: stored("Only a draft.") } }, { value: {} }]) {
      mocks.answer.mockResolvedValue({ data, error: null });
      expect(await getLegalDocument("privacy")).toEqual(legalDocument("privacy"));
    }
  });

  it("shows the text in code when the row is not in the shape, so a page is never empty", async () => {
    mocks.answer.mockResolvedValue({ data: { value: { published: { summary: 5 } } }, error: null });
    expect(await getLegalDocument("terms")).toEqual(legalDocument("terms"));
  });

  it("shows the text in code and logs only the code when the read fails", async () => {
    mocks.answer.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "secret detail" },
    });
    expect(await getLegalDocument("privacy")).toEqual(legalDocument("privacy"));
    expect(mocks.error).toHaveBeenCalledWith(expect.any(String), {
      errorCode: "XX000",
      page: "privacy",
    });
  });

  it("keeps the Cookie information in code and reads nothing for it", async () => {
    expect(await getLegalDocument("cookies")).toEqual(legalDocument("cookies"));
    expect(mocks.keys).toEqual([]);
  });
});

describe("UT-legal-queries: what the editor opens on (ADR-151)", () => {
  it("opens on the working copy and says there are unpublished changes", async () => {
    mocks.answer.mockResolvedValue({
      data: { value: { published: stored("Live."), working: stored("Draft.") } },
      error: null,
    });
    const page = await getLegalEditPage("privacy");
    expect(page.document.summary).toBe("Draft.");
    expect(page.hasUnpublishedChanges).toBe(true);
    expect(page.published).toEqual({ updated: "2026-11-22", version: "2" });
  });

  it("opens on the live text when there is no working copy", async () => {
    mocks.answer.mockResolvedValue({
      data: { value: { published: stored("Live.") } },
      error: null,
    });
    const page = await getLegalEditPage("terms");
    expect(page.document.summary).toBe("Live.");
    expect(page.hasUnpublishedChanges).toBe(false);
    expect(mocks.keys).toEqual(["legal_terms"]);
  });

  it("opens on the text in code, with nothing published, when there is no row", async () => {
    mocks.answer.mockResolvedValue({ data: null, error: null });
    const page = await getLegalEditPage("privacy");
    expect(page.document).toEqual(legalDocument("privacy"));
    expect(page.published).toBeNull();
    expect(page.hasUnpublishedChanges).toBe(false);
  });

  it("fails loudly when it cannot read, so the editor never opens on text that is not what is saved", async () => {
    mocks.answer.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(getLegalEditPage("privacy")).rejects.toThrow("could not be read");
  });
});
