import { describe, expect, it, vi } from "vitest";
import {
  WEB_ANSWER_MAX_SOURCES,
  WEB_ANSWER_MEMORY_DAYS,
  WEB_SEARCH_TIMEOUT_MS,
} from "@/config/web-search";
import type { KeptAnswer, WebAnswerStore } from "@/server/audit/web-answers";
import { TOOL_CONTEXT } from "./fixtures";
import type { ToolContext, ToolSpend } from "../types";

// UT-ai-tool-search-web (ADR-218): `search_web` over a scripted web search and an in-memory 7-day memory. Every
// question, answer and website here is made up.

vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const { createFakeWebSearch, toPortableJsonSchema } = await import("@/server/ai");
const { runTool } = await import("../run");
const { cleanQuery, createSearchWebTool, queryKeyOf, searchWebInputSchema, SITE_LOOKUP_TOOLS } =
  await import("../search-web");

const NOW = new Date("2026-11-27T10:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const SPEND = { inputTokens: 5200, cachedInputTokens: 0, outputTokens: 90, webSearches: 1 };
const ANSWER = "The registration fee is 1 per cent of the property value (made-up page, 2026).";

/** A memory held in a map, recording every write. */
function memoryStore(initial: Record<string, KeptAnswer> = {}, switchOn = true) {
  const rows = new Map(Object.entries(initial));
  const saved: Parameters<WebAnswerStore["save"]>[0][] = [];
  const used: [string, number][] = [];
  const store: WebAnswerStore = {
    webSearchOn: () => Promise.resolve(switchOn),
    find: (key) => Promise.resolve(rows.get(key) ?? null),
    markUsed: (key, before) => {
      used.push([key, before]);
      return Promise.resolve();
    },
    save: (entry) => {
      saved.push(entry);
      return Promise.resolve();
    },
  };
  return { store, saved, used };
}

function setUp(
  options: {
    results?: Parameters<typeof createFakeWebSearch>[0];
    kept?: Record<string, KeptAnswer>;
  } = {},
) {
  const searcher = createFakeWebSearch(
    options.results ?? [
      {
        ok: true,
        answer: ANSWER,
        sources: [
          { title: "Fees | Registration Department", url: "https://tnreginet.example.test/fees" },
        ],
        spend: SPEND,
      },
    ],
  );
  const memory = memoryStore(options.kept);
  const tool = createSearchWebTool({ searcher, store: memory.store, now: () => NOW });
  const spent: ToolSpend[] = [];
  const context: ToolContext = {
    ...TOOL_CONTEXT,
    earlierResults: ["search_content"],
    spend: (spend) => spent.push(spend),
  };
  const search = (input: Record<string, unknown> = {}, changes: Partial<ToolContext> = {}) =>
    runTool(
      [tool],
      { name: "search_web", input: { query: "registration fee flat Chennai 2026", ...input } },
      { ...context, ...changes },
    );
  return { tool, searcher, memory, spent, search };
}

describe("UT-ai-tool-search-web: the rules the server keeps", () => {
  it("is a read tool in its own call group of one, with its own time of about 15 s", () => {
    const { tool } = setUp();
    expect(tool.name).toBe("search_web");
    expect(tool.kind).toBe("read");
    expect(tool.callGroup).toBe("web");
    expect(tool.timeoutMs).toBe(WEB_SEARCH_TIMEOUT_MS);
    expect(() => toPortableJsonSchema(searchWebInputSchema)).not.toThrow();
  });

  it("refuses a customer who is not signed in, and searches nothing", async () => {
    const { search, searcher } = setUp();
    const outcome = await search({}, { signedIn: false });
    expect(outcome).toMatchObject({ status: "error", code: "sign_in_required" });
    expect(searcher.queries).toEqual([]);
  });

  it("refuses with site_first until a lookup on our own site gave its result this message", async () => {
    const { search, searcher } = setUp();
    expect(await search({}, { earlierResults: [] })).toMatchObject({ code: "site_first" });
    expect(await search({}, { earlierResults: ["calculate_emi"] })).toMatchObject({
      code: "site_first",
    });
    expect(searcher.queries).toEqual([]);
    for (const name of SITE_LOOKUP_TOOLS) {
      const fresh = setUp();
      expect((await fresh.search({}, { earlierResults: [name] })).status, name).toBe("ok");
    }
  });

  it("refuses search words holding a phone number or an email, so nothing about a customer is searched", async () => {
    const { search, searcher, memory } = setUp();
    for (const query of ["stamp duty 9841000000", "loan rate for someone@example.test"]) {
      expect(await search({ query })).toMatchObject({ code: "invalid_input", fields: ["query"] });
    }
    expect(searcher.queries).toEqual([]);
    expect(memory.saved).toEqual([]);
  });
});

describe("UT-ai-tool-search-web: the search and the 7-day memory", () => {
  it("searches, reports what the search spent, and keeps the words, the answer and its sources for 7 days", async () => {
    const { search, searcher, memory, spent } = setUp();
    const outcome = await search({ query: "  Registration   fee flat\u0007 Chennai 2026 " });
    expect(outcome.status).toBe("ok");
    expect(searcher.queries).toEqual(["Registration fee flat Chennai 2026"]);
    expect(spent).toEqual([SPEND]);
    expect(memory.saved).toEqual([
      {
        queryKey: "registration fee flat chennai 2026",
        query: "Registration fee flat Chennai 2026",
        answer: ANSWER,
        sources: [
          { title: "Fees | Registration Department", url: "https://tnreginet.example.test/fees" },
        ],
        expiresAt: new Date(NOW.getTime() + WEB_ANSWER_MEMORY_DAYS * DAY_MS),
        timesUsedBefore: 0,
      },
    ]);
    if (outcome.status !== "ok") return;
    expect(outcome.output).toEqual({
      status: "found",
      fromMemory: false,
      untrustedText: { answer: ANSWER },
      sources: [
        {
          sourceUrl: "https://tnreginet.example.test/fees",
          untrustedText: { title: "Fees | Registration Department" },
        },
      ],
    });
  });

  it("answers words asked in the last 7 days from the memory, with no paid search, and counts the use", async () => {
    const key = queryKeyOf(cleanQuery("registration fee flat Chennai 2026"));
    const { search, searcher, memory, spent } = setUp({
      kept: {
        [key]: {
          answer: "A kept answer.",
          sources: [],
          expiresAt: new Date(NOW.getTime() + DAY_MS),
          timesUsed: 4,
        },
      },
    });
    const outcome = await search();
    expect(outcome).toMatchObject({
      status: "ok",
      output: { status: "found", fromMemory: true, untrustedText: { answer: "A kept answer." } },
    });
    expect(searcher.queries).toEqual([]);
    expect(spent).toEqual([]);
    expect(memory.used).toEqual([[key, 4]]);
  });

  it("searches again when the kept answer is older than 7 days, and keeps counting its uses", async () => {
    const key = queryKeyOf(cleanQuery("registration fee flat Chennai 2026"));
    const { search, searcher, memory } = setUp({
      kept: {
        [key]: {
          answer: "Old.",
          sources: [],
          expiresAt: new Date(NOW.getTime() - 1),
          timesUsed: 9,
        },
      },
    });
    await search();
    expect(searcher.queries).toHaveLength(1);
    expect(memory.saved[0]).toMatchObject({ queryKey: key, answer: ANSWER, timesUsedBefore: 9 });
  });

  it("keeps nothing and says nothing_found or unavailable when the search gives no answer", async () => {
    const none = setUp({
      results: [{ ok: false, reason: "nothing_found", spend: SPEND }],
    });
    expect(await none.search()).toMatchObject({ output: { status: "nothing_found" } });
    expect(none.spent).toEqual([SPEND]);
    expect(none.memory.saved).toEqual([]);

    const failed = setUp({
      results: [{ ok: false, reason: "timeout", spend: { ...SPEND, webSearches: 1 } }],
    });
    expect(await failed.search()).toMatchObject({ output: { status: "unavailable" } });
    expect(failed.memory.saved).toEqual([]);
  });

  it("keeps only plain https sources, at most five, and puts every word of the websites under untrustedText", async () => {
    const sources = [
      { title: "Plain http", url: "http://insecure.example.test/" },
      ...Array.from({ length: 7 }, (_, index) => ({
        title: `Page ${index}`,
        url: `https://site${index}.example.test/`,
      })),
    ];
    const { search } = setUp({ results: [{ ok: true, answer: ANSWER, sources, spend: SPEND }] });
    const outcome = await search();
    if (outcome.status !== "ok") throw new Error("expected a result");
    const output = outcome.output as { sources: { sourceUrl: string | null }[] };
    expect(output.sources).toHaveLength(WEB_ANSWER_MAX_SOURCES);
    expect(output.sources.every((source) => source.sourceUrl?.startsWith("https://"))).toBe(true);
    expect(JSON.parse(outcome.content)).not.toHaveProperty("answer");
  });
});
