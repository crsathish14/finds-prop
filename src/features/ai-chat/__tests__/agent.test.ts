import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  MAX_MODEL_ROUNDS,
  MAX_PARALLEL_READ_CALLS,
  MAX_TOOL_CALLS_PER_MESSAGE,
  TOOL_TIMEOUT_MS,
} from "@/config/ai";
import {
  createFakeAiProvider,
  cutOffTurn,
  failureTurn,
  HANGING_TURN,
  refusalTurn,
  textTurn,
  toolCallTurn,
  truncatedTurn,
  type AiEvent,
  type AiMessage,
  type AiProvider,
  type FakeAiProvider,
  type FakeToolCall,
  type FakeTurn,
} from "@/server/ai";
import { TOOL_CONTEXT } from "../tools/__tests__/fixtures";
import type { AiChatTool, AnyAiChatTool } from "../tools/types";
import {
  AGENT_MESSAGE_KEYS,
  type AgentDone,
  type AgentEvent,
  type AgentInput,
} from "../agent-types";

// UT-ai-agent (ADR-128 sections 4.4 rule 3, 4.5, 8 and 9): the agent loop, played against the fake provider
// with stand-in tools. Every home, tool and sentence here is made up. The numbers in the scripts come from
// `src/config/ai.ts`, the same place the loop reads them, so a change there changes both.

const logged = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("@/server/logger", () => ({ logger: logged }));

const { runAgent } = await import("../agent");
const { ANSWER_ONLY_INSTRUCTION } = await import("../prompts/answer-only");

// ---------------------------------------------------------------- stand-in tools

const lookupInput = z.object({ id: z.string() });
const lookupOutput = z.object({ name: z.string() });
const lookedUp = vi.fn();
const lookupTool: AiChatTool<z.infer<typeof lookupInput>, z.infer<typeof lookupOutput>> = {
  name: "lookup_home",
  kind: "read",
  description: "Looks up a made-up home by its id, for the loop tests.",
  input: lookupInput,
  output: lookupOutput,
  async run(input) {
    lookedUp(input.id);
    return {
      output: { name: `Home ${input.id}` },
      references: [{ kind: "home", homeId: input.id, slug: `slug-${input.id}` }],
    };
  },
};

const delayedInput = z.object({ id: z.string(), delayMs: z.int() });
const delayedStarted = vi.fn();
const delayedTool: AiChatTool<z.infer<typeof delayedInput>, z.infer<typeof lookupOutput>> = {
  name: "delayed_read",
  kind: "read",
  description: "Answers after a delay, for the loop tests.",
  input: delayedInput,
  output: lookupOutput,
  async run(input) {
    delayedStarted(input.id);
    await new Promise((resolve) => setTimeout(resolve, input.delayMs));
    return { output: { name: `Slow ${input.id}` }, references: [] };
  },
};

const hangingStarted = vi.fn();
const hangingTool: AiChatTool<z.infer<typeof lookupInput>, z.infer<typeof lookupOutput>> = {
  name: "hanging_read",
  kind: "read",
  description: "Never answers, for the loop tests.",
  input: lookupInput,
  output: lookupOutput,
  run() {
    hangingStarted();
    return new Promise(() => undefined);
  },
};

const brokenTool: AiChatTool<z.infer<typeof lookupInput>, z.infer<typeof lookupOutput>> = {
  name: "broken_read",
  kind: "read",
  description: "Always fails, for the loop tests.",
  input: lookupInput,
  output: lookupOutput,
  async run() {
    throw new Error("made-up database failure");
  },
};

const proposed = vi.fn();
const proposeTool: AiChatTool<z.infer<typeof lookupInput>, z.infer<typeof lookupOutput>> = {
  name: "propose_visit",
  kind: "propose",
  description: "Prepares a made-up visit, for the loop tests.",
  input: lookupInput,
  output: lookupOutput,
  async run(input) {
    proposed(input.id);
    return { output: { name: `Proposal ${input.id}` }, references: [] };
  },
};

const projectTool: AiChatTool<z.infer<typeof lookupInput>, z.infer<typeof lookupOutput>> = {
  name: "lookup_project",
  kind: "read",
  description: "Looks up a made-up project by its slug, for the loop tests.",
  input: lookupInput,
  output: lookupOutput,
  async run(input) {
    return {
      output: { name: `Project ${input.id}` },
      references: [{ kind: "project", slug: input.id }],
    };
  },
};

const TOOLS: readonly AnyAiChatTool[] = [
  lookupTool,
  projectTool,
  delayedTool,
  hangingTool,
  brokenTool,
  proposeTool,
];

// ---------------------------------------------------------------- helpers

const SYSTEM = "You are a made-up assistant for the loop tests.";
const USER_MESSAGE: AiMessage = { role: "user", text: "Zzcustomer: 2 BHK near the made-up park" };

const lookup = (id: string, name = "lookup_home", callId = `call-${id}`): FakeToolCall => ({
  id: callId,
  name,
  input: { id },
});

async function collect(provider: AiProvider, overrides: Partial<AgentInput> = {}) {
  const events: AgentEvent[] = [];
  for await (const event of runAgent({
    provider,
    tools: TOOLS,
    system: SYSTEM,
    messages: [USER_MESSAGE],
    context: TOOL_CONTEXT,
    ...overrides,
  })) {
    events.push(event);
  }
  const done = events.at(-1);
  if (done?.type !== "done") throw new Error("The loop did not end with a done event");
  const text = events.map((event) => (event.type === "text_delta" ? event.text : "")).join("");
  return { events, done: done as AgentDone, text };
}

/** The results the loop sent back in the call at `index`, as [call id, parsed content]. */
function sentResults(provider: FakeAiProvider, index: number): [string, Record<string, unknown>][] {
  const call = provider.calls[index];
  if (call === undefined) throw new Error(`The provider was not called ${index + 1} times`);
  return call.messages.flatMap((message): [string, Record<string, unknown>][] =>
    message.role === "tool"
      ? [[message.callId, JSON.parse(message.content) as Record<string, unknown>]]
      : [],
  );
}

const toolRound = (...ids: string[]): FakeTurn => toolCallTurn(ids.map((id) => lookup(id)));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

// ---------------------------------------------------------------- the normal turn

describe("UT-ai-agent: a turn that needs no tool", () => {
  it("passes the answer on in pieces and ends with one done event", async () => {
    const provider = createFakeAiProvider([textTurn("Here are some homes near the park.")]);
    const { events, done, text } = await collect(provider);
    expect(text).toBe("Here are some homes near the park.");
    expect(events.filter((event) => event.type === "text_delta").length).toBeGreaterThan(1);
    expect(events.filter((event) => event.type === "done")).toHaveLength(1);
    expect(done).toMatchObject({
      outcome: "answered",
      noticeKey: null,
      limit: null,
      fallbackReason: null,
      truncated: false,
      rounds: 1,
      retried: false,
      toolCallsPerRound: [],
      toolsRan: [],
      references: [],
    });
  });

  it("sends the system prompt, the conversation and every tool, and nothing else added", async () => {
    const provider = createFakeAiProvider([textTurn("Hello.")]);
    await collect(provider);
    expect(provider.calls).toHaveLength(1);
    const [call] = provider.calls;
    expect(call?.system).toBe(SYSTEM);
    expect(call?.messages).toEqual([USER_MESSAGE]);
    expect(call?.tools.map((tool) => tool.name)).toEqual(TOOLS.map((tool) => tool.name));
    expect(call?.maxOutputTokens).toBeGreaterThan(0);
  });

  it("does not change the conversation it was given", async () => {
    const messages: readonly AiMessage[] = [USER_MESSAGE];
    const provider = createFakeAiProvider([toolRound("a"), textTurn("Done.")]);
    await collect(provider, { messages });
    expect(messages).toEqual([USER_MESSAGE]);
  });
});

describe("UT-ai-agent: a turn with a tool", () => {
  it("runs the tool, sends its result back paired by call id, and answers", async () => {
    const provider = createFakeAiProvider([toolRound("h1"), textTurn("Home h1 is a good fit.")]);
    const { done, text } = await collect(provider);
    expect(text).toBe("Home h1 is a good fit.");
    expect(done.outcome).toBe("answered");
    expect(done.rounds).toBe(2);
    expect(lookedUp).toHaveBeenCalledExactlyOnceWith("h1");

    const second = provider.calls[1];
    expect(second?.messages.map((message) => message.role)).toEqual(["user", "assistant", "tool"]);
    expect(second?.messages[1]).toMatchObject({
      role: "assistant",
      toolCalls: [{ id: "call-h1", name: "lookup_home", input: { id: "h1" } }],
    });
    expect(sentResults(provider, 1)).toEqual([["call-h1", { name: "Home h1" }]]);
  });

  it("does not show the text a model writes in a round that ends with a tool call", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("h1")], { text: "Zzhalf-formed: let me check that for you" }),
      textTurn("The final answer."),
    ]);
    const { events, text } = await collect(provider);
    expect(text).toBe("The final answer.");
    expect(JSON.stringify(events)).not.toContain("Zzhalf-formed");
  });

  it("says once, before the tools run, which known tools it is about to run", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("h1"), lookup("h2"), lookup("x", "no_such_tool")]),
      textTurn("Done."),
    ]);
    const { events } = await collect(provider);
    const statuses = events.filter((event) => event.type === "status");
    expect(statuses).toEqual([
      { type: "status", messageKey: "ai.searching", tools: ["lookup_home"] },
    ]);
    expect(events.indexOf(statuses[0] as AgentEvent)).toBeLessThan(
      events.findIndex((event) => event.type === "text_delta"),
    );
  });

  it("records the rounds, the calls per round, the tools that ran and the usage", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("h1"), lookup("h2")], { usage: { inputTokens: 100, outputTokens: 10 } }),
      toolCallTurn([{ id: "slow-h3", name: "delayed_read", input: { id: "h3", delayMs: 0 } }], {
        usage: { inputTokens: 200, outputTokens: 20, cachedInputTokens: 50 },
      }),
      textTurn("Done.", { usage: { inputTokens: 300, outputTokens: 30, cachedInputTokens: 70 } }),
    ]);
    const { done } = await collect(provider);
    expect(done.rounds).toBe(3);
    expect(done.toolCallsPerRound).toEqual([2, 1]);
    expect(done.toolsRan).toEqual(["lookup_home", "delayed_read"]);
    expect(done.usage).toEqual({ inputTokens: 600, outputTokens: 60, cachedInputTokens: 120 });
  });

  it("tracks every home a tool returned, each once, across rounds and calls", async () => {
    const provider = createFakeAiProvider([
      toolRound("h1", "h2"),
      toolRound("h2", "h3"),
      textTurn("Done."),
    ]);
    const { done } = await collect(provider);
    expect(done.references).toEqual([
      { kind: "home", homeId: "h1", slug: "slug-h1" },
      { kind: "home", homeId: "h2", slug: "slug-h2" },
      { kind: "home", homeId: "h3", slug: "slug-h3" },
    ]);
  });

  it("tracks a project by its slug, apart from a home with the same text, across rounds", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("same"), lookup("same", "lookup_project", "call-project")]),
      toolCallTurn([
        lookup("kadal-vista", "lookup_project"),
        lookup("same", "lookup_project", "call-again"),
      ]),
      textTurn("Done."),
    ]);
    const { done } = await collect(provider);
    expect(done.references).toEqual([
      { kind: "home", homeId: "same", slug: "slug-same" },
      { kind: "project", slug: "same" },
      { kind: "project", slug: "kadal-vista" },
    ]);
  });

  it("tracks no home from a call that failed or was refused", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("h1", "broken_read"), lookup("h2", "no_such_tool")]),
      textTurn("Done."),
    ]);
    const { done } = await collect(provider);
    expect(done.references).toEqual([]);
  });
});

// ---------------------------------------------------------------- parallel reads

describe("UT-ai-agent: parallel read calls", () => {
  it("runs at most the allowed number of reads together; each other call gets an error result", async () => {
    const ids = Array.from({ length: MAX_PARALLEL_READ_CALLS + 1 }, (_, index) => `h${index}`);
    const provider = createFakeAiProvider([toolRound(...ids), textTurn("Done.")]);
    const { done } = await collect(provider);
    expect(lookedUp).toHaveBeenCalledTimes(MAX_PARALLEL_READ_CALLS);
    expect(done.toolCallsPerRound).toEqual([MAX_PARALLEL_READ_CALLS]);
    const results = sentResults(provider, 1);
    expect(results).toHaveLength(ids.length);
    expect(results.at(-1)?.[1]).toMatchObject({ error: "too_many_calls" });
    expect(results.slice(0, -1).every(([, content]) => "name" in content)).toBe(true);
  });

  it("runs identical calls once, however the keys are ordered, and gives each id the shared result", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([
        { id: "first", name: "lookup_home", input: { id: "h1" } },
        { id: "second", name: "lookup_home", input: { id: "h1" } },
        { id: "third", name: "delayed_read", input: { id: "h1", delayMs: 0 } },
        { id: "fourth", name: "delayed_read", input: { delayMs: 0, id: "h1" } },
      ]),
      textTurn("Done."),
    ]);
    const { done } = await collect(provider);
    expect(lookedUp).toHaveBeenCalledTimes(1);
    expect(delayedStarted).toHaveBeenCalledTimes(1);
    expect(done.toolCallsPerRound).toEqual([2]);
    const results = sentResults(provider, 1);
    expect(results.map(([callId]) => callId)).toEqual(["first", "second", "third", "fourth"]);
    expect(results[0]?.[1]).toEqual(results[1]?.[1]);
    expect(results[2]?.[1]).toEqual(results[3]?.[1]);
  });

  it("lets one failing tool error only its own call", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("h1"), lookup("h2", "broken_read"), lookup("h3")]),
      textTurn("Here is what I could check."),
    ]);
    const { done, text } = await collect(provider);
    expect(sentResults(provider, 1)).toEqual([
      ["call-h1", { name: "Home h1" }],
      ["call-h2", { error: "unavailable" }],
      ["call-h3", { name: "Home h3" }],
    ]);
    expect(text).toBe("Here is what I could check.");
    expect(done.outcome).toBe("answered");
  });

  it("gives results in the order of the calls, paired by id, whichever tool finishes first", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const provider = createFakeAiProvider([
      toolCallTurn([
        { id: "slow", name: "delayed_read", input: { id: "a", delayMs: 500 } },
        { id: "quick", name: "delayed_read", input: { id: "b", delayMs: 10 } },
        { id: "middle", name: "delayed_read", input: { id: "c", delayMs: 200 } },
      ]),
      textTurn("Done."),
    ]);
    const pending = collect(provider);
    await vi.waitFor(() => expect(delayedStarted).toHaveBeenCalledTimes(3));
    await vi.advanceTimersByTimeAsync(600);
    await pending;
    expect(sentResults(provider, 1)).toEqual([
      ["slow", { name: "Slow a" }],
      ["quick", { name: "Slow b" }],
      ["middle", { name: "Slow c" }],
    ]);
  });

  it("answers a provider that returns several calls when asked for one: all run in order, none dropped", async () => {
    // A provider with parallel calls switched off may still return several (ADR-128 section 4.4, rule 3).
    const provider = createFakeAiProvider([toolRound("h1", "h2"), textTurn("Both checked.")]);
    const { done } = await collect(provider);
    expect(lookedUp.mock.calls).toEqual([["h1"], ["h2"]]);
    expect(sentResults(provider, 1).map(([callId]) => callId)).toEqual(["call-h1", "call-h2"]);
    expect(done.toolCallsPerRound).toEqual([2]);
  });
});

describe("UT-ai-agent: propose tools run alone", () => {
  it("runs the reads of a mixed round and tells the propose call to come back alone", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("h1"), lookup("h1", "propose_visit", "propose-1"), lookup("h2")]),
      toolCallTurn([lookup("h1", "propose_visit", "propose-2")]),
      textTurn("I have prepared that for you to confirm."),
    ]);
    const { done } = await collect(provider);
    const mixed = sentResults(provider, 1);
    expect(mixed.map(([callId]) => callId)).toEqual(["call-h1", "propose-1", "call-h2"]);
    expect(mixed[0]?.[1]).toEqual({ name: "Home h1" });
    expect(mixed[1]?.[1]).toMatchObject({ error: "call_alone" });
    expect(mixed[2]?.[1]).toEqual({ name: "Home h2" });
    // Alone in the next round, it runs.
    expect(proposed).toHaveBeenCalledExactlyOnceWith("h1");
    expect(done.toolCallsPerRound).toEqual([2, 1]);
    expect(done.toolsRan).toEqual(["lookup_home", "propose_visit"]);
  });

  it("never runs two propose calls together", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("h1", "propose_visit"), lookup("h2", "propose_visit")]),
      textTurn("Done."),
    ]);
    await collect(provider);
    expect(proposed).not.toHaveBeenCalled();
    expect(sentResults(provider, 1).map(([, content]) => content.error)).toEqual([
      "call_alone",
      "call_alone",
    ]);
  });
});

// ---------------------------------------------------------------- calls the model got wrong

describe("UT-ai-agent: unknown tools and invalid arguments", () => {
  it("feeds back an unknown tool as an error result and lets the model correct the call", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("h1", "delete_everything")]),
      toolRound("h1"),
      textTurn("Home h1 it is."),
    ]);
    const { done, text } = await collect(provider);
    expect(sentResults(provider, 1)).toEqual([["call-h1", { error: "unknown_tool" }]]);
    expect(sentResults(provider, 2).at(-1)).toEqual(["call-h1", { name: "Home h1" }]);
    expect(text).toBe("Home h1 it is.");
    expect(done.outcome).toBe("answered");
    expect(done.toolsRan).toEqual(["lookup_home"]);
  });

  it("feeds back invalid arguments with the fields to correct, runs nothing, and lets the model correct once", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([{ id: "wrong", name: "lookup_home", input: { id: 7 } }]),
      toolRound("h1"),
      textTurn("Home h1 it is."),
    ]);
    const { done } = await collect(provider);
    expect(sentResults(provider, 1)).toEqual([
      ["wrong", { error: "invalid_input", fields: ["id"] }],
    ]);
    expect(lookedUp).toHaveBeenCalledExactlyOnceWith("h1");
    expect(done.outcome).toBe("answered");
    expect(done.toolCallsPerRound).toEqual([1, 1]);
  });

  it.each([undefined, null, "id", 5, []])(
    "never crashes on arguments that are not an object at all (%j)",
    async (input) => {
      const provider = createFakeAiProvider([
        toolCallTurn([{ id: "odd", name: "lookup_home", input }]),
        textTurn("Sorry, I could not look that up."),
      ]);
      const { done } = await collect(provider);
      expect(sentResults(provider, 1)).toEqual([["odd", { error: "invalid_input" }]]);
      expect(provider.calls[1]?.messages[1]).toMatchObject({
        toolCalls: [{ id: "odd", input: {} }],
      });
      expect(done.outcome).toBe("answered");
    },
  );
});

describe("UT-ai-agent: a tool that is too slow", () => {
  it("gives a timeout result for that call only, after the tool time limit", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("h1", "hanging_read"), lookup("h2")]),
      textTurn("Here is what I could check."),
    ]);
    const pending = collect(provider);
    await vi.waitFor(() => expect(hangingStarted).toHaveBeenCalled());
    // The turn waits for the slow tool: no second round until the tool time limit has passed.
    expect(provider.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(TOOL_TIMEOUT_MS);
    const { done } = await pending;
    expect(sentResults(provider, 1)).toEqual([
      ["call-h1", expect.objectContaining({ error: "timeout" })],
      ["call-h2", { name: "Home h2" }],
    ]);
    expect(done.outcome).toBe("answered");
  });
});

// ---------------------------------------------------------------- the limit table (ADR-128 section 4.5)

describe("UT-ai-agent-limits: rounds used up", () => {
  it("makes the last round answer-only: no tools, an instruction, a note, outcome limit with round_cap", async () => {
    const toolRounds = Array.from({ length: MAX_MODEL_ROUNDS - 1 }, (_, index) =>
      toolRound(`h${index}`),
    );
    const provider = createFakeAiProvider([
      ...toolRounds,
      textTurn("From what I found, h0 looks best."),
    ]);
    const { done, text } = await collect(provider);
    expect(provider.calls).toHaveLength(MAX_MODEL_ROUNDS);
    for (const call of provider.calls.slice(0, -1)) {
      expect(call.tools.length).toBeGreaterThan(0);
      expect(call.system).toBe(SYSTEM);
    }
    const last = provider.calls.at(-1);
    expect(last?.tools).toEqual([]);
    expect(last?.system).toBe(`${SYSTEM}\n\n${ANSWER_ONLY_INSTRUCTION}`);
    expect(text).toBe("From what I found, h0 looks best.");
    expect(done).toMatchObject({
      outcome: "limit",
      limit: "round_cap",
      noticeKey: "ai.capNote",
      rounds: MAX_MODEL_ROUNDS,
    });
  });

  it("never calls the model more than the round cap, even when it keeps asking for tools", async () => {
    const provider = createFakeAiProvider([
      ...Array.from({ length: MAX_MODEL_ROUNDS - 1 }, (_, index) => toolRound(`h${index}`)),
      // The last round has no tools, but a provider can still send a call: it is ignored.
      toolCallTurn([lookup("late")], { text: "The answer from what I have." }),
    ]);
    const { done, text } = await collect(provider);
    expect(provider.calls).toHaveLength(MAX_MODEL_ROUNDS);
    expect(lookedUp).not.toHaveBeenCalledWith("late");
    expect(text).toBe("The answer from what I have.");
    expect(done).toMatchObject({ outcome: "limit", limit: "round_cap" });
  });
});

describe("UT-ai-agent-limits: the tool call cap", () => {
  it("makes the next round answer-only once the calls are used up, outcome limit with tool_cap", async () => {
    const provider = createFakeAiProvider([
      toolRound("a1", "a2", "a3"),
      toolRound("b1", "b2", "b3"),
      textTurn("Here is what I found."),
    ]);
    const { done } = await collect(provider);
    expect(MAX_PARALLEL_READ_CALLS * 2).toBe(MAX_TOOL_CALLS_PER_MESSAGE);
    expect(provider.calls).toHaveLength(3);
    expect(provider.calls[2]?.tools).toEqual([]);
    expect(done).toMatchObject({
      outcome: "limit",
      limit: "tool_cap",
      noticeKey: "ai.capNote",
      toolCallsPerRound: [3, 3],
    });
  });

  it("runs the calls that fit in the budget and gives each call past the cap an error result", async () => {
    const provider = createFakeAiProvider([
      toolRound("a1", "a2", "a3"),
      toolRound("b1", "b2"),
      toolRound("c1", "c2"),
      textTurn("Here is what I found."),
    ]);
    const { done } = await collect(provider);
    expect(lookedUp).toHaveBeenCalledTimes(MAX_TOOL_CALLS_PER_MESSAGE);
    expect(lookedUp).not.toHaveBeenCalledWith("c2");
    expect(sentResults(provider, 3).slice(-2)).toEqual([
      ["call-c1", { name: "Home c1" }],
      ["call-c2", expect.objectContaining({ error: "call_limit" })],
    ]);
    expect(provider.calls[3]?.tools).toEqual([]);
    expect(done).toMatchObject({
      outcome: "limit",
      limit: "tool_cap",
      toolCallsPerRound: [3, 2, 1],
    });
  });
});

describe("UT-ai-agent-limits: the answer-only round also fails", () => {
  it("gives the fixed fallback, not unchecked text, and still records which limit was hit", async () => {
    const provider = createFakeAiProvider([
      ...Array.from({ length: MAX_MODEL_ROUNDS - 1 }, (_, index) => toolRound(`h${index}`)),
      failureTurn("rejected"),
    ]);
    const { done, text } = await collect(provider);
    expect(text).toBe("");
    expect(done).toMatchObject({
      outcome: "fallback",
      noticeKey: "ai.fallback",
      fallbackReason: "provider_error",
      limit: "round_cap",
    });
  });

  it("gives the fixed fallback when the answer-only round says nothing, after one retry", async () => {
    const provider = createFakeAiProvider([
      toolRound("a1", "a2", "a3"),
      toolRound("b1", "b2", "b3"),
      textTurn(""),
      textTurn(""),
    ]);
    const { done, text } = await collect(provider);
    expect(text).toBe("");
    expect(provider.calls).toHaveLength(4);
    expect(done).toMatchObject({
      outcome: "fallback",
      fallbackReason: "provider_error",
      limit: "tool_cap",
    });
  });
});

describe("UT-ai-agent-limits: the time limit", () => {
  it("answers from the results it has when the limit passes during a model call", async () => {
    const timeLimit = new AbortController();
    const provider = createFakeAiProvider([
      toolRound("h1"),
      HANGING_TURN,
      textTurn("From what I found, h1."),
    ]);
    const pending = collect(provider, { timeLimit: timeLimit.signal });
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    timeLimit.abort();
    const { done, text } = await pending;
    expect(text).toBe("From what I found, h1.");
    expect(provider.calls[2]?.tools).toEqual([]);
    expect(provider.calls[2]?.system).toContain(ANSWER_ONLY_INSTRUCTION);
    expect(done).toMatchObject({
      outcome: "limit",
      limit: "time_limit",
      noticeKey: "ai.capNote",
      retried: false,
    });
  });

  it("gives the fallback when the limit passes and no tool has given a useful result", async () => {
    const timeLimit = new AbortController();
    const provider = createFakeAiProvider([HANGING_TURN]);
    const pending = collect(provider, { timeLimit: timeLimit.signal });
    await vi.waitFor(() => expect(provider.calls).toHaveLength(1));
    timeLimit.abort();
    const { done } = await pending;
    expect(provider.calls).toHaveLength(1);
    expect(done).toMatchObject({
      outcome: "fallback",
      fallbackReason: "time_limit",
      noticeKey: "ai.fallback",
    });
  });

  it("does not count a tool that only failed as a useful result", async () => {
    const timeLimit = new AbortController();
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("h1", "broken_read")]),
      HANGING_TURN,
    ]);
    const pending = collect(provider, { timeLimit: timeLimit.signal });
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    timeLimit.abort();
    const { done } = await pending;
    expect(done).toMatchObject({ outcome: "fallback", fallbackReason: "time_limit" });
  });

  it("does not call the model at all when the limit has already passed", async () => {
    const timeLimit = AbortSignal.abort();
    const provider = createFakeAiProvider([textTurn("Never asked.")]);
    const { done } = await collect(provider, { timeLimit });
    expect(provider.calls).toHaveLength(0);
    expect(done).toMatchObject({ outcome: "fallback", fallbackReason: "time_limit", rounds: 0 });
  });

  it("passes the limit to the model calls that may use tools, so they can be cancelled", async () => {
    const timeLimit = new AbortController();
    const provider = createFakeAiProvider([toolRound("h1"), HANGING_TURN, textTurn("Done.")]);
    const pending = collect(provider, { timeLimit: timeLimit.signal });
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    expect(provider.calls[1]?.signal?.aborted).toBe(false);
    timeLimit.abort();
    await pending;
    expect(provider.calls[1]?.signal?.aborted).toBe(true);
    // The answer-only round is not under the time limit, or it could never be answered.
    expect(provider.calls[2]?.signal).toBeUndefined();
  });
});

describe("UT-ai-agent-limits: cancelling", () => {
  it("ends at once with aborted when the caller's signal fires, and calls the model no more", async () => {
    const controller = new AbortController();
    const provider = createFakeAiProvider([toolRound("h1"), HANGING_TURN, textTurn("Never.")]);
    const pending = collect(provider, { signal: controller.signal });
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    controller.abort();
    const { done, events } = await pending;
    expect(provider.calls).toHaveLength(2);
    expect(done).toMatchObject({ outcome: "aborted", noticeKey: null, retried: false });
    expect(events.some((event) => event.type === "text_delta")).toBe(false);
  });

  it("passes the caller's signal to every model call, and none when there is none", async () => {
    const controller = new AbortController();
    const withSignal = createFakeAiProvider([toolRound("h1"), textTurn("Done.")]);
    await collect(withSignal, { signal: controller.signal });
    expect(withSignal.calls.every((call) => call.signal !== undefined)).toBe(true);
    controller.abort();
    expect(withSignal.calls[0]?.signal?.aborted).toBe(true);

    const without = createFakeAiProvider([textTurn("Done.")]);
    await collect(without);
    expect(without.calls[0]?.signal).toBeUndefined();
  });

  it("does not start a round when the caller has already cancelled", async () => {
    const provider = createFakeAiProvider([textTurn("Never asked.")]);
    const { done } = await collect(provider, { signal: AbortSignal.abort() });
    expect(provider.calls).toHaveLength(0);
    expect(done.outcome).toBe("aborted");
  });
});

describe("UT-ai-agent-limits: the provider fails mid-loop", () => {
  it("retries once for a transient failure and then answers", async () => {
    const provider = createFakeAiProvider([
      toolRound("h1"),
      failureTurn("unavailable"),
      textTurn("Home h1 is a good fit."),
    ]);
    const { done, text } = await collect(provider);
    expect(text).toBe("Home h1 is a good fit.");
    expect(provider.calls).toHaveLength(3);
    expect(provider.calls[2]?.messages).toEqual(provider.calls[1]?.messages);
    // The retry is not a new round.
    expect(done).toMatchObject({ outcome: "answered", retried: true, rounds: 2 });
  });

  it("gives the fixed fallback after the one retry also fails", async () => {
    const provider = createFakeAiProvider([
      failureTurn("timeout"),
      failureTurn("unavailable"),
      textTurn("Never asked."),
    ]);
    const { done, text } = await collect(provider);
    expect(text).toBe("");
    expect(provider.calls).toHaveLength(2);
    expect(done).toMatchObject({
      outcome: "fallback",
      noticeKey: "ai.fallback",
      fallbackReason: "provider_error",
      retried: true,
    });
  });

  it("allows one retry for the whole message, not one for each round", async () => {
    const provider = createFakeAiProvider([
      failureTurn("unavailable"),
      toolRound("h1"),
      failureTurn("unavailable"),
      textTurn("Never asked."),
    ]);
    const { done } = await collect(provider);
    expect(provider.calls).toHaveLength(3);
    expect(done).toMatchObject({ outcome: "fallback", fallbackReason: "provider_error" });
  });

  it.each(["rate_limited", "rejected"] as const)(
    "does not retry a failure that is not transient (%s)",
    async (kind) => {
      const provider = createFakeAiProvider([failureTurn(kind), textTurn("Never asked.")]);
      const { done } = await collect(provider);
      expect(provider.calls).toHaveLength(1);
      expect(done).toMatchObject({
        outcome: "fallback",
        fallbackReason: "provider_error",
        retried: false,
      });
    },
  );

  it("treats a cut-off stream as a failure: the half answer is never shown", async () => {
    const provider = createFakeAiProvider([
      cutOffTurn("Zzcut-off: the first home is in"),
      textTurn("The whole answer."),
    ]);
    const { done, text, events } = await collect(provider);
    expect(text).toBe("The whole answer.");
    expect(JSON.stringify(events)).not.toContain("Zzcut-off");
    expect(done).toMatchObject({ outcome: "answered", retried: true });
  });

  it("treats a stream with no stop and a stream with no content as failures", async () => {
    const noStop: AiEvent[] = [{ type: "text_delta", text: "half" }];
    const provider = createFakeAiProvider([noStop, textTurn(""), textTurn("Never asked.")]);
    const { done } = await collect(provider);
    expect(provider.calls).toHaveLength(2);
    expect(done).toMatchObject({
      outcome: "fallback",
      fallbackReason: "provider_error",
      retried: true,
    });
  });

  it("maps a stream that throws to a failure instead of crashing, and logs nothing it said", async () => {
    let streams = 0;
    const throwing: AiProvider = {
      name: "fake",
      stream() {
        streams += 1;
        return {
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.reject(new TypeError("Zzprovider message: fetch failed")),
          }),
        };
      },
    };
    const { done } = await collect(throwing);
    expect(streams).toBe(2);
    expect(done).toMatchObject({
      outcome: "fallback",
      fallbackReason: "provider_error",
      retried: true,
    });
    expect(JSON.stringify(logged.warn.mock.calls)).not.toContain("Zzprovider");
  });

  it("gives the fixed fallback when the provider refuses, with no retry and no text", async () => {
    const provider = createFakeAiProvider([refusalTurn(), textTurn("Never asked.")]);
    const { done, text } = await collect(provider);
    expect(text).toBe("");
    expect(provider.calls).toHaveLength(1);
    expect(done).toMatchObject({ outcome: "fallback", fallbackReason: "refused", retried: false });
  });

  it("passes on an answer cut short by the output cap, and says it was cut", async () => {
    const provider = createFakeAiProvider([truncatedTurn("The first home is in Velachery and")]);
    const { done, text } = await collect(provider);
    expect(text).toBe("The first home is in Velachery and");
    expect(done).toMatchObject({ outcome: "answered", truncated: true });
  });

  it("does not run a tool call that came with an answer cut short by the output cap", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("h1")], { text: "Cut" }).map((event) =>
        event.type === "stop" ? ({ type: "stop", reason: "length" } as const) : event,
      ),
    ]);
    const { done } = await collect(provider);
    expect(lookedUp).not.toHaveBeenCalled();
    expect(done).toMatchObject({ outcome: "answered", truncated: true });
  });

  it("sums the tokens of failed rounds and the retry too, because they cost money", async () => {
    const provider = createFakeAiProvider([
      textTurn("", { usage: { inputTokens: 40, outputTokens: 0 } }),
      textTurn("Done.", { usage: { inputTokens: 40, outputTokens: 5 } }),
    ]);
    const { done } = await collect(provider);
    expect(done.usage).toEqual({ inputTokens: 80, outputTokens: 5, cachedInputTokens: 0 });
  });
});

// ---------------------------------------------------------------- the fixed wording

describe("UT-ai-agent-wording: the loop points at approved wording, it writes none", () => {
  it("has the approved text for the status, the cap note and the fallback in en.json", () => {
    expect(AGENT_MESSAGE_KEYS.searching).toBe("ai.searching");
    expect(TOOL_CONTEXT.translate(AGENT_MESSAGE_KEYS.searching)).toBe("Searching…");
    expect(TOOL_CONTEXT.translate(AGENT_MESSAGE_KEYS.capNote)).toBe(
      "I couldn't check everything. Here is what I found.",
    );
    expect(TOOL_CONTEXT.translate(AGENT_MESSAGE_KEYS.fallback)).toBe(
      "I couldn't finish that. Try a simpler question, or use the search filters.",
    );
  });

  it("calls the product findsprop, in lowercase, in the instruction it adds to the prompt", () => {
    expect(ANSWER_ONLY_INSTRUCTION).toContain("findsprop");
    expect(ANSWER_ONLY_INSTRUCTION.replaceAll("findsprop", "")).not.toMatch(/finds?\s*prop/i);
    expect(ANSWER_ONLY_INSTRUCTION).not.toMatch(/key|secret|supabase|openai|database|table/i);
  });
});

// ---------------------------------------------------------------- what is logged (R-BE-10)

describe("UT-ai-agent-log: no message text is ever logged", () => {
  it("writes only counts, codes and tool names to the log, through a turn that hits every path", async () => {
    const timeLimit = new AbortController();
    const provider = createFakeAiProvider([
      toolCallTurn([lookup("Zzcustomer-id"), lookup("x", "Zztool-the-model-invented")], {
        text: "Zzmodel-text before a tool call",
      }),
      cutOffTurn("Zzpartial answer"),
      toolRound("h2", "h3"),
      HANGING_TURN,
      textTurn("Zzfinal answer"),
    ]);
    const pending = collect(provider, {
      timeLimit: timeLimit.signal,
      messages: [{ role: "user", text: "Zzcustomer: my phone is 90000 12345" }],
    });
    await vi.waitFor(() => expect(provider.calls).toHaveLength(4));
    timeLimit.abort();
    await pending;
    const everything = JSON.stringify([
      logged.info.mock.calls,
      logged.warn.mock.calls,
      logged.error.mock.calls,
    ]);
    for (const secret of ["Zz", "90000", "Home", "made-up database"]) {
      expect(everything).not.toContain(secret);
    }
    expect(logged.info).toHaveBeenCalled();
  });
});
