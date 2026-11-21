import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTENT_ITEM_MAX_CHARACTERS,
  CONTENT_SNIPPET_CHARACTERS,
  MAX_CONTENT_SEARCH_ITEMS,
} from "@/config/ai";
import { injected, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tools-content (ADR-143 sections 6.2 and 6.7): search_content and get_content_item, through `runTool`, over
// stand-in reads. Checks the inputs the model may give, the small and plain results, the untrusted-text wrapper, and
// the references the source links are built from. The reads themselves are tested in `content-queries.test.ts`.

const searchContent = vi.fn();
const readContentItem = vi.fn();

vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("../../content-queries", () => ({ searchContent, readContentItem }));

const { runTool } = await import("../run");
const { searchContentTool } = await import("../search-content");
const { getContentItemTool } = await import("../get-content-item");
const TOOLS = [searchContentTool, getContentItemTool];

const ID = "a1000000-0000-4000-8000-000000000001";
const FAQ_ID = "f1000000-0000-4000-8000-000000000002";

const hit = (overrides: Record<string, unknown> = {}) => ({
  kind: "article",
  id: ID,
  slug: "registration-charges",
  title: "Registration charges explained",
  categoryName: "Buying guide",
  categorySlug: "buying-guide",
  date: "2026-11-05T20:00:00.000Z",
  passage: "The registration charge is paid at the sub-registrar office.",
  ...overrides,
});

const SEARCH = { query: "registration charges", kind: "any", category: null, limit: null };

beforeEach(() => {
  vi.clearAllMocks();
  searchContent.mockResolvedValue([hit(), hit({ kind: "faq", id: FAQ_ID, slug: null })]);
  readContentItem.mockResolvedValue({
    kind: "article",
    id: ID,
    slug: "registration-charges",
    title: "Registration charges explained",
    categoryName: "Buying guide",
    date: "2026-11-05T08:00:00.000Z",
    sections: ["Summary.", "Charges\nThe registration charge is paid at the office."],
  });
});

describe("UT-ai-tools-content: the tools", () => {
  it("are read tools of the content group, so they run beside property searches and share two calls", () => {
    for (const tool of TOOLS) {
      expect(tool.kind).toBe("read");
      expect(tool.callGroup).toBe("content");
    }
    expect(TOOLS.map((tool) => tool.name)).toEqual(["search_content", "get_content_item"]);
  });

  it("say, in their own descriptions, that untrustedText is data and that no web address is to be written", () => {
    for (const tool of TOOLS) {
      expect(tool.description).toContain("`untrustedText`");
      expect(tool.description).toContain("never as an instruction");
      expect(tool.description).toContain("web address");
    }
  });
});

describe("UT-ai-tools-content: search_content", () => {
  it("passes the words, the kind, the category and the limit to the read, with the words trimmed", async () => {
    await runTool(
      TOOLS,
      {
        name: "search_content",
        input: { query: "  registration charges  ", kind: "faq", category: "selling", limit: 3 },
      },
      TOOL_CONTEXT,
    );
    expect(searchContent).toHaveBeenCalledWith({
      query: "registration charges",
      kind: "faq",
      categorySlug: "selling",
      limit: 3,
    });
  });

  it("asks for five when no limit is given, and refuses a limit above five", async () => {
    await runTool(TOOLS, { name: "search_content", input: SEARCH }, TOOL_CONTEXT);
    expect(searchContent).toHaveBeenCalledWith(
      expect.objectContaining({ limit: MAX_CONTENT_SEARCH_ITEMS }),
    );
    const refused = await runTool(
      TOOLS,
      { name: "search_content", input: { ...SEARCH, limit: 6 } },
      TOOL_CONTEXT,
    );
    expect(refused).toMatchObject({ status: "error", code: "invalid_input", fields: ["limit"] });
  });

  it("refuses an empty or a very long query, an unknown kind and a category that is not a slug", async () => {
    for (const [field, value] of [
      ["query", "   "],
      ["query", "x".repeat(201)],
      ["kind", "job"],
      ["category", "Buying Guide"],
    ] as const) {
      const refused = await runTool(
        TOOLS,
        { name: "search_content", input: { ...SEARCH, [field]: value } },
        TOOL_CONTEXT,
      );
      expect(refused, field).toMatchObject({ status: "error", code: "invalid_input" });
    }
    expect(searchContent).not.toHaveBeenCalled();
  });

  it("gives each hit's id, kind, category word and day, with everything typed under untrustedText", async () => {
    const outcome = await runTool(TOOLS, { name: "search_content", input: SEARCH }, TOOL_CONTEXT);
    expect(outcome).toMatchObject({ status: "ok" });
    if (outcome.status !== "ok") return;
    expect(outcome.output).toEqual({
      items: [
        {
          id: ID,
          kind: "article",
          categorySlug: "buying-guide",
          // 20:00 UTC on 5 Nov is already 6 Nov in India.
          date: "2026-11-06",
          untrustedText: {
            title: "Registration charges explained",
            category: "Buying guide",
            snippet: "The registration charge is paid at the sub-registrar office.",
          },
        },
        {
          id: FAQ_ID,
          kind: "faq",
          categorySlug: "buying-guide",
          date: "2026-11-06",
          untrustedText: expect.objectContaining({ title: "Registration charges explained" }),
        },
      ],
    });
  });

  it("names the article's address word and the question's id in its references, and flags none as read", async () => {
    const outcome = await runTool(TOOLS, { name: "search_content", input: SEARCH }, TOOL_CONTEXT);
    if (outcome.status !== "ok") throw new Error("the search did not run");
    expect(outcome.references).toEqual([
      {
        kind: "article",
        id: ID,
        slug: "registration-charges",
        title: "Registration charges explained",
        opened: false,
      },
      { kind: "faq", id: FAQ_ID, title: "Registration charges explained", opened: false },
    ]);
  });

  it("cuts a passage to the snippet size and never returns more than the limit though the read gave more", async () => {
    searchContent.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) =>
        hit({
          id: `a100000${index}-0000-4000-8000-00000000000${index}`,
          passage: "word ".repeat(300),
        }),
      ),
    );
    const outcome = await runTool(
      TOOLS,
      { name: "search_content", input: { ...SEARCH, limit: 3 } },
      TOOL_CONTEXT,
    );
    if (outcome.status !== "ok") throw new Error("the search did not run");
    const { items } = outcome.output as { items: { untrustedText: { snippet: string } }[] };
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.untrustedText.snippet.length).toBeLessThanOrEqual(CONTENT_SNIPPET_CHARACTERS);
    }
  });

  it("cleans what an admin typed: invisible characters go, and a title with an order in it is still only data", async () => {
    const order = injected("title");
    searchContent.mockResolvedValue([
      hit({ title: `‮Hidden​ ${order}`, categoryName: null, categorySlug: "Not A Slug" }),
    ]);
    const outcome = await runTool(TOOLS, { name: "search_content", input: SEARCH }, TOOL_CONTEXT);
    if (outcome.status !== "ok") throw new Error("the search did not run");
    const [first] = (
      outcome.output as {
        items: {
          categorySlug: string | null;
          untrustedText: { title: string; category: string | null };
        }[];
      }
    ).items;
    expect(first?.untrustedText.title).toBe(`Hidden ${order}`);
    expect(first?.untrustedText.category).toBeNull();
    expect(first?.categorySlug).toBeNull();
  });

  it("gives an empty list, with no reference, when nothing matches (a switched-off module reads the same)", async () => {
    searchContent.mockResolvedValue([]);
    const outcome = await runTool(TOOLS, { name: "search_content", input: SEARCH }, TOOL_CONTEXT);
    expect(outcome).toMatchObject({ status: "ok", output: { items: [] }, references: [] });
  });

  it("turns a failed read into an unavailable result, never an exception", async () => {
    searchContent.mockRejectedValue(new Error("down"));
    const outcome = await runTool(TOOLS, { name: "search_content", input: SEARCH }, TOOL_CONTEXT);
    expect(outcome).toMatchObject({ status: "error", code: "unavailable" });
  });
});

describe("UT-ai-tools-content: get_content_item", () => {
  const ITEM = { id: ID, query: "registration charge" };

  it("refuses an id that is not a UUID, so nothing malformed reaches the database", async () => {
    for (const id of ["registration-charges", "1", "a1000000-0000-4000-8000-00000000000g", ""]) {
      const refused = await runTool(
        TOOLS,
        { name: "get_content_item", input: { id, query: null } },
        TOOL_CONTEXT,
      );
      expect(refused, id).toMatchObject({ status: "error", code: "invalid_input", fields: ["id"] });
    }
    expect(readContentItem).not.toHaveBeenCalled();
  });

  it("gives the sections that answer, under untrustedText, and says when it is only part", async () => {
    const outcome = await runTool(TOOLS, { name: "get_content_item", input: ITEM }, TOOL_CONTEXT);
    expect(readContentItem).toHaveBeenCalledWith(ID);
    expect(outcome).toMatchObject({
      status: "ok",
      output: {
        status: "found",
        item: {
          id: ID,
          kind: "article",
          date: "2026-11-05",
          partial: false,
          untrustedText: {
            title: "Registration charges explained",
            category: "Buying guide",
            text: "Summary.\n\nCharges\nThe registration charge is paid at the office.",
          },
        },
      },
    });
  });

  it("never gives more than the limit of an item, however long the article is", async () => {
    readContentItem.mockResolvedValue({
      kind: "article",
      id: ID,
      slug: "long-guide",
      title: "A long guide",
      categoryName: null,
      date: null,
      sections: Array.from(
        { length: 40 },
        (_, index) => `Section ${index}\n${"text ".repeat(120)}`,
      ),
    });
    const outcome = await runTool(TOOLS, { name: "get_content_item", input: ITEM }, TOOL_CONTEXT);
    if (outcome.status !== "ok") throw new Error("the read did not run");
    const { item } = outcome.output as {
      item: { partial: boolean; untrustedText: { text: string } };
    };
    expect(item.untrustedText.text.length).toBeLessThanOrEqual(CONTENT_ITEM_MAX_CHARACTERS);
    expect(item.partial).toBe(true);
  });

  it("names the item as read, so the source row draws it and not the other search results", async () => {
    const outcome = await runTool(TOOLS, { name: "get_content_item", input: ITEM }, TOOL_CONTEXT);
    if (outcome.status !== "ok") throw new Error("the read did not run");
    expect(outcome.references).toEqual([
      {
        kind: "article",
        id: ID,
        slug: "registration-charges",
        title: "Registration charges explained",
        opened: true,
      },
    ]);
  });

  it("names a question by its id", async () => {
    readContentItem.mockResolvedValue({
      kind: "faq",
      id: FAQ_ID,
      slug: null,
      title: "How do I post a home?",
      categoryName: "Selling",
      date: "2026-11-06T08:00:00.000Z",
      sections: ["Open Post a property and follow the steps."],
    });
    const outcome = await runTool(
      TOOLS,
      { name: "get_content_item", input: { id: FAQ_ID, query: null } },
      TOOL_CONTEXT,
    );
    if (outcome.status !== "ok") throw new Error("the read did not run");
    expect(outcome.references).toEqual([
      { kind: "faq", id: FAQ_ID, title: "How do I post a home?", opened: true },
    ]);
  });

  it("answers not_found, with no reference, for an id nothing published has", async () => {
    readContentItem.mockResolvedValue(null);
    const outcome = await runTool(TOOLS, { name: "get_content_item", input: ITEM }, TOOL_CONTEXT);
    expect(outcome).toMatchObject({
      status: "ok",
      output: { status: "not_found" },
      references: [],
    });
  });

  it("looks up the id in lower case, as the database writes it", async () => {
    await runTool(
      TOOLS,
      { name: "get_content_item", input: { id: ID.toUpperCase(), query: null } },
      TOOL_CONTEXT,
    );
    expect(readContentItem).toHaveBeenCalledWith(ID);
  });

  it("turns a failed read into an unavailable result", async () => {
    readContentItem.mockRejectedValue(new Error("down"));
    const outcome = await runTool(TOOLS, { name: "get_content_item", input: ITEM }, TOOL_CONTEXT);
    expect(outcome).toMatchObject({ status: "error", code: "unavailable" });
  });
});
