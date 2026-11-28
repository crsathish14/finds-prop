import { describe, expect, it } from "vitest";
import { WEB_SEARCH_MAX_ACTIONS, WEB_SEARCH_TRUSTED_DOMAINS } from "@/config/web-search";
import { buildWebSearchRequest, createOpenAiWebSearch } from "../index";
import {
  createMockOpenAi,
  errorReply,
  HANGING_REPLY,
  NETWORK_FAILURE,
  TEST_API_KEY,
  TEST_MODEL,
  type MockReply,
} from "./openai-mock";

// UT-ai-web-search (ADR-218): the web search call over mocked HTTP. The real `openai` package runs; only its `fetch`
// is replaced. No network, no real key; every page and answer here is made up.

/** A finished (non-streaming) Responses reply. */
function responseReply(
  output: unknown[],
  usage = { input: 4800, cached: 0, output: 70 },
): MockReply {
  return new Response(
    JSON.stringify({
      id: "resp_test",
      object: "response",
      status: "completed",
      output,
      usage: {
        input_tokens: usage.input,
        input_tokens_details: { cached_tokens: usage.cached },
        output_tokens: usage.output,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: usage.input + usage.output,
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

const searchCall = (sources: string[] = []) => ({
  type: "web_search_call",
  id: "ws_1",
  status: "completed",
  action: { type: "search", query: "fee", sources: sources.map((url) => ({ type: "url", url })) },
});

const message = (text: string, citations: { title: string; url: string }[] = []) => ({
  type: "message",
  id: "msg_1",
  role: "assistant",
  status: "completed",
  content: [
    {
      type: "output_text",
      text,
      annotations: citations.map((citation) => ({
        type: "url_citation",
        start_index: 0,
        end_index: 1,
        ...citation,
      })),
    },
  ],
});

function searcher(replies: MockReply[], timeoutMs?: number) {
  const mock = createMockOpenAi(replies);
  return {
    mock,
    web: createOpenAiWebSearch({
      apiKey: TEST_API_KEY,
      model: TEST_MODEL,
      fetch: mock.fetch,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    }),
  };
}

describe("UT-ai-web-search: the request", () => {
  it("sends only the search words, to the web_search tool on the trusted sites, in Tamil Nadu, stateless, at most 3 steps", () => {
    const request = buildWebSearchRequest("stamp duty Chennai 2026", TEST_MODEL);
    expect(request).toMatchObject({
      model: TEST_MODEL,
      store: false,
      stream: false,
      max_tool_calls: 3,
      input: [{ role: "user", content: "Search words: stamp duty Chennai 2026" }],
      tools: [
        {
          type: "web_search",
          filters: { allowed_domains: [...WEB_SEARCH_TRUSTED_DOMAINS] },
          user_location: { type: "approximate", country: "IN", region: "Tamil Nadu" },
        },
      ],
    });
    expect(WEB_SEARCH_MAX_ACTIONS).toBe(3);
    // Never the preview tool, which costs more (checked 27 Nov 2026).
    expect(JSON.stringify(request)).not.toContain("web_search_preview");
  });

  it("is the request the adapter really sends", async () => {
    const { mock, web } = searcher([responseReply([searchCall(), message("An answer.")])]);
    await web.search("stamp duty Chennai 2026");
    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0]?.url).toContain("/responses");
    expect(mock.requests[0]?.body).toMatchObject({ store: false, max_tool_calls: 3 });
  });
});

describe("UT-ai-web-search: the result", () => {
  it("takes OpenAI's tracking tags out of the addresses and keeps one source per page", async () => {
    const { web } = searcher([
      responseReply([
        searchCall([
          "https://tnhb.example.test/note.pdf",
          "https://tnhb.example.test/a?page=2&utm_medium=x",
        ]),
        message("The portal lists registered projects.", [
          { title: "Policy note", url: "https://tnhb.example.test/note.pdf?utm_source=openai" },
        ]),
      ]),
    ]);
    const result = await web.search("TN RERA project search");
    expect(result).toMatchObject({
      ok: true,
      sources: [
        { title: "Policy note", url: "https://tnhb.example.test/note.pdf" },
        { title: "", url: "https://tnhb.example.test/a?page=2" },
      ],
    });
  });

  it("gives the answer, the cited pages first, and counts every web search the response reports", async () => {
    const { web } = searcher([
      responseReply([
        searchCall(["https://tnreginet.example.test/fees", "http://plain.example.test/"]),
        searchCall(["https://rbi.example.test/"]),
        message("The fee is 1 per cent.", [
          { title: "Fees", url: "https://tnreginet.example.test/fees" },
        ]),
      ]),
    ]);
    const result = await web.search("registration fee");
    expect(result).toEqual({
      ok: true,
      answer: "The fee is 1 per cent.",
      sources: [
        { title: "Fees", url: "https://tnreginet.example.test/fees" },
        { title: "", url: "https://rbi.example.test/" },
      ],
      spend: { inputTokens: 4800, cachedInputTokens: 0, outputTokens: 70, webSearches: 2 },
    });
  });

  it("says nothing_found when the model found no answer, and still reports the spend", async () => {
    const { web } = searcher([responseReply([searchCall(), message("NOTHING_FOUND")])]);
    expect(await web.search("anything")).toEqual({
      ok: false,
      reason: "nothing_found",
      spend: { inputTokens: 4800, cachedInputTokens: 0, outputTokens: 70, webSearches: 1 },
    });
  });

  it("never throws: a refused call or a lost connection is failed with nothing spent", async () => {
    const zero = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, webSearches: 0 };
    for (const reply of [errorReply(500, "server_error"), NETWORK_FAILURE]) {
      const { web } = searcher([reply]);
      expect(await web.search("anything")).toEqual({ ok: false, reason: "failed", spend: zero });
    }
  });

  it("stops a search that takes too long, and counts it as one search so the estimate is not low", async () => {
    const { web } = searcher([HANGING_REPLY], 20);
    expect(await web.search("anything")).toEqual({
      ok: false,
      reason: "timeout",
      spend: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, webSearches: 1 },
    });
  });
});
