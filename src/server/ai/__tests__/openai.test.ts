import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { MAX_OUTPUT_TOKENS } from "@/config/ai";
import {
  buildOpenAiRequest,
  chooseAiProvider,
  createOpenAiProvider,
  type AiCall,
  type AiEvent,
} from "../index";
import {
  brokenStreamReply,
  completed,
  createMockOpenAi,
  errorEvent,
  errorReply,
  failed,
  functionCallDone,
  garbledStreamReply,
  HANGING_REPLY,
  incomplete,
  NETWORK_FAILURE,
  streamReply,
  TEST_API_KEY,
  TEST_MODEL,
  textDelta,
  textRound,
  type MockReply,
} from "./openai-mock";

const call: AiCall = {
  system: "You are a test assistant.",
  messages: [{ role: "user", text: "Show me homes in Adyar" }],
  tools: [],
  maxOutputTokens: 1200,
};

const searchTool = {
  name: "search_homes",
  description: "Find homes.",
  parameters: {
    type: "object",
    properties: { locality: { type: ["string", "null"] } },
    required: ["locality"],
    additionalProperties: false,
  },
};

function providerFor(replies: readonly MockReply[], idleTimeoutMs?: number) {
  const mock = createMockOpenAi(replies);
  const provider = createOpenAiProvider({
    apiKey: TEST_API_KEY,
    model: TEST_MODEL,
    fetch: mock.fetch,
    ...(idleTimeoutMs === undefined ? {} : { idleTimeoutMs }),
  });
  return { mock, provider };
}

async function collect(
  provider: { stream(next: AiCall): AsyncIterable<AiEvent> },
  next: AiCall = call,
): Promise<AiEvent[]> {
  const events: AiEvent[] = [];
  for await (const event of provider.stream(next)) events.push(event);
  return events;
}

function lastStop(events: readonly AiEvent[]) {
  const last = events.at(-1);
  if (last?.type !== "stop") throw new Error("no stop event");
  return last;
}

function failureKind(events: readonly AiEvent[]): string {
  const stop = lastStop(events);
  return stop.reason === "error" ? stop.failure.kind : `not an error: ${stop.reason}`;
}

describe("UT-ai-openai: the request the adapter sends", () => {
  it("is stateless: nothing is stored and no stored conversation is referenced", async () => {
    const { mock, provider } = providerFor([streamReply(textRound("ok"))]);
    await collect(provider);
    const body = mock.requests[0]?.body;
    expect(body).toMatchObject({ store: false, stream: true, model: TEST_MODEL });
    for (const key of ["previous_response_id", "conversation", "prompt", "background", "include"]) {
      expect(body).not.toHaveProperty(key);
    }
  });

  it("goes to the Responses endpoint with the key in the authorization header only", async () => {
    const { mock, provider } = providerFor([streamReply(textRound("ok"))]);
    await collect(provider);
    const request = mock.requests[0];
    expect(request?.url).toMatch(/\/responses$/);
    expect(request?.headers.get("authorization")).toBe(`Bearer ${TEST_API_KEY}`);
    expect(JSON.stringify(request?.body)).not.toContain(TEST_API_KEY);
  });

  it("sends the system prompt as instructions and the conversation as input items", async () => {
    const { mock, provider } = providerFor([streamReply(textRound("ok"))]);
    await collect(provider, {
      ...call,
      messages: [
        { role: "user", text: "Show me homes in Adyar" },
        {
          role: "assistant",
          text: "Let me look.",
          toolCalls: [{ id: "call_1", name: "search_homes", input: { locality: "Adyar" } }],
        },
        { role: "tool", callId: "call_1", content: '{"homes":[]}' },
        { role: "user", text: "Thanks" },
      ],
    });
    expect(mock.requests[0]?.body).toMatchObject({
      instructions: "You are a test assistant.",
      input: [
        { role: "user", content: "Show me homes in Adyar" },
        { role: "assistant", content: "Let me look." },
        {
          type: "function_call",
          call_id: "call_1",
          name: "search_homes",
          arguments: '{"locality":"Adyar"}',
        },
        { type: "function_call_output", call_id: "call_1", output: '{"homes":[]}' },
        { role: "user", content: "Thanks" },
      ],
    });
  });

  it("pairs every result with its call by id, and leaves out an empty assistant text", async () => {
    const { mock, provider } = providerFor([streamReply(textRound("ok"))]);
    await collect(provider, {
      ...call,
      messages: [
        { role: "user", text: "Compare them" },
        {
          role: "assistant",
          text: "",
          toolCalls: [
            { id: "call_a", name: "search_homes", input: { locality: "Adyar" } },
            { id: "call_b", name: "search_homes", input: { locality: null } },
          ],
        },
        { role: "tool", callId: "call_a", content: "first" },
        { role: "tool", callId: "call_b", content: "second" },
      ],
    });
    const input = mock.requests[0]?.body.input as {
      role?: string;
      type?: string;
      call_id?: string;
    }[];
    expect(input.map((item) => item.role ?? item.type)).toEqual([
      "user",
      "function_call",
      "function_call",
      "function_call_output",
      "function_call_output",
    ]);
    expect(input.map((item) => item.call_id)).toEqual([
      undefined,
      "call_a",
      "call_b",
      "call_a",
      "call_b",
    ]);
  });

  it("asks for one tool call per round, with strict tools", async () => {
    const { mock, provider } = providerFor([streamReply(textRound("ok"))]);
    await collect(provider, { ...call, tools: [searchTool] });
    expect(mock.requests[0]?.body).toMatchObject({
      parallel_tool_calls: false,
      tool_choice: "auto",
      tools: [
        {
          type: "function",
          name: "search_homes",
          description: "Find homes.",
          strict: true,
          parameters: searchTool.parameters,
        },
      ],
    });
  });

  it("sends no tool list and no tool setting in an answer-only round", async () => {
    const { mock, provider } = providerFor([streamReply(textRound("ok"))]);
    await collect(provider, { ...call, tools: [] });
    for (const key of ["tools", "tool_choice", "parallel_tool_calls"]) {
      expect(mock.requests[0]?.body).not.toHaveProperty(key);
    }
  });

  it("never asks for more output tokens than the configured cap, nor fewer than the API allows", () => {
    expect(
      buildOpenAiRequest({ ...call, maxOutputTokens: 50_000 }, TEST_MODEL).max_output_tokens,
    ).toBe(MAX_OUTPUT_TOKENS);
    expect(
      buildOpenAiRequest({ ...call, maxOutputTokens: 600 }, TEST_MODEL).max_output_tokens,
    ).toBe(600);
    expect(buildOpenAiRequest({ ...call, maxOutputTokens: 1 }, TEST_MODEL).max_output_tokens).toBe(
      16,
    );
  });

  it("makes no request when the deadline has already passed", async () => {
    const { mock, provider } = providerFor([streamReply(textRound("ok"))]);
    const events = await collect(provider, { ...call, signal: AbortSignal.abort() });
    expect(mock.requests).toHaveLength(0);
    expect(failureKind(events)).toBe("timeout");
  });

  it("keeps rounds independent: nothing from one call is carried to the next", async () => {
    const { mock, provider } = providerFor([
      streamReply(textRound("one")),
      streamReply(textRound("two")),
    ]);
    await collect(provider, call);
    await collect(provider, { ...call, messages: [{ role: "user", text: "Another question" }] });
    expect(mock.requests[1]?.body.input).toEqual([{ role: "user", content: "Another question" }]);
  });
});

describe("UT-ai-openai: what the adapter reports", () => {
  it("reports tokens, and cached tokens only when the provider gives them", async () => {
    const withCache = await collect(
      providerFor([streamReply(textRound("ok", { input: 500, output: 20, cached: 300 }))]).provider,
    );
    expect(withCache.find((event) => event.type === "usage")).toEqual({
      type: "usage",
      inputTokens: 500,
      outputTokens: 20,
      cachedInputTokens: 300,
    });
    const withoutCache = await collect(
      providerFor([streamReply(textRound("ok", { input: 500, output: 20 }))]).provider,
    );
    expect(withoutCache.find((event) => event.type === "usage")).toEqual({
      type: "usage",
      inputTokens: 500,
      outputTokens: 20,
    });
  });

  it("treats an empty argument string as an empty object", async () => {
    const events = await collect(
      providerFor([streamReply([functionCallDone("call_1", "search_homes", ""), completed()])])
        .provider,
    );
    expect(events.find((event) => event.type === "tool_call")).toMatchObject({ input: {} });
  });

  it("keeps tool calls out of a round that was cut off, so a half round never runs a tool", async () => {
    const events = await collect(
      providerFor([brokenStreamReply([functionCallDone("call_1", "search_homes", "{}")])]).provider,
    );
    expect(events.some((event) => event.type === "tool_call")).toBe(false);
    expect(failureKind(events)).toBe("interrupted");
  });
});

describe("UT-ai-openai: errors become our closed set, and no provider text or key gets out", () => {
  it.each([
    ["429 rate limit", () => errorReply(429, "rate_limit_exceeded"), "rate_limited"],
    ["429 out of credit (ours to fix)", () => errorReply(429, "insufficient_quota"), "rejected"],
    ["500 server error", () => errorReply(500, "server_error"), "unavailable"],
    ["503 overloaded", () => errorReply(503, null), "unavailable"],
    ["504 gateway timeout", () => errorReply(504, null), "timeout"],
    ["408 request timeout", () => errorReply(408, null), "timeout"],
    ["401 bad key", () => errorReply(401, "invalid_api_key"), "rejected"],
    ["403 not allowed", () => errorReply(403, null), "rejected"],
    ["404 unknown model", () => errorReply(404, "model_not_found"), "rejected"],
    ["400 bad request", () => errorReply(400, "invalid_request_error"), "rejected"],
    ["400 content policy", () => errorReply(400, "content_policy_violation"), "refused"],
    ["400 flagged prompt", () => errorReply(400, "invalid_prompt"), "refused"],
    ["network failure", () => NETWORK_FAILURE, "unavailable"],
    [
      "error event: rate limit",
      () => streamReply([errorEvent("rate_limit_exceeded")]),
      "rate_limited",
    ],
    ["error event: server error", () => streamReply([errorEvent("server_error")]), "unavailable"],
    ["error event: unknown code", () => streamReply([errorEvent("something_new")]), "rejected"],
    ["failed response: server error", () => streamReply([failed("server_error")]), "unavailable"],
    [
      "failed response: rate limit",
      () => streamReply([failed("rate_limit_exceeded")]),
      "rate_limited",
    ],
    ["failed response: flagged prompt", () => streamReply([failed("invalid_prompt")]), "refused"],
    [
      "incomplete for an unknown reason",
      () => streamReply([incomplete("something_new")]),
      "interrupted",
    ],
    ["event text that is not JSON", () => garbledStreamReply(), "rejected"],
  ])("%s becomes %s", async (_label, reply, expected) => {
    const events = await collect(providerFor([reply()]).provider);
    expect(failureKind(events)).toBe(expected);
  });

  it("does not let the provider's message or the key reach any event", async () => {
    for (const reply of [errorReply(500, "server_error"), errorReply(401, "invalid_api_key")]) {
      const events = await collect(providerFor([reply]).provider);
      const text = JSON.stringify(events);
      expect(text).not.toContain("PROVIDER-MESSAGE-MUST-NOT-LEAK");
      expect(text).not.toContain(TEST_API_KEY);
    }
  });

  it("does not retry by itself: one failed reply is one request", async () => {
    const { mock, provider } = providerFor([errorReply(503, null), streamReply(textRound("ok"))]);
    const events = await collect(provider);
    expect(failureKind(events)).toBe("unavailable");
    expect(mock.requests).toHaveLength(1);
    expect(mock.remainingReplies).toBe(1);
  });

  it("ends a round that goes quiet as a timeout, without waiting for the caller", async () => {
    const events = await collect(providerFor([HANGING_REPLY], 20).provider);
    expect(failureKind(events)).toBe("timeout");
  });

  it("ends a round that sends text and then goes quiet as a timeout, keeping the text", async () => {
    // The reply sends one event and then never closes; the idle clock cuts it.
    const open = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          const event = textDelta("Here are");
          controller.enqueue(
            new TextEncoder().encode(
              `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`,
            ),
          );
        },
      }),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );
    const events = await collect(providerFor([open], 20).provider);
    expect(events.filter((event) => event.type === "text_delta")).toHaveLength(1);
    expect(failureKind(events)).toBe("timeout");
  });
});

describe("UT-ai-openai: choosing the provider", () => {
  it("returns the OpenAI adapter by name when the key and model are given", () => {
    const provider = chooseAiProvider("openai", {
      openai: { apiKey: TEST_API_KEY, model: TEST_MODEL, fetch: createMockOpenAi([]).fetch },
    });
    expect(provider.name).toBe("openai");
  });

  it("uses the injected HTTP function, so a test never reaches the network", async () => {
    const mock = createMockOpenAi([streamReply(textRound("hello"))]);
    const provider = chooseAiProvider("openai", {
      openai: { apiKey: TEST_API_KEY, model: TEST_MODEL, fetch: mock.fetch },
    });
    const events = await collect(provider);
    expect(mock.requests).toHaveLength(1);
    expect(events.map((event) => (event.type === "text_delta" ? event.text : "")).join("")).toBe(
      "hello",
    );
  });

  it("refuses OpenAI with no key or no model, and the message names the variable, never a value", () => {
    for (const openai of [
      { apiKey: "", model: TEST_MODEL },
      { apiKey: TEST_API_KEY, model: "" },
    ]) {
      try {
        chooseAiProvider("openai", { openai });
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(ActionError);
        expect((error as ActionError).code).toBe("INTERNAL");
        expect((error as ActionError).message).toMatch(/OPENAI_API_KEY|AI_MODEL/);
        expect((error as ActionError).message).not.toContain(TEST_API_KEY);
      }
    }
  });

  it("still refuses a provider that is not wired, and never falls back to the fake", () => {
    expect(() => chooseAiProvider("gemini")).toThrow(ActionError);
  });
});
