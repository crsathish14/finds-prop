/**
 * The conformance suite (ADR-128 section 4.4): one set of scripted conversations that every provider adapter
 * must pass the same way. It runs against the fake (the reference) and against the OpenAI adapter over mocked
 * HTTP in normal CI; `openai.live.test.ts` runs the cases that can be provoked against the real API when the
 * owner supplies a key. A provider is accepted only when it passes the same cases.
 *
 * Each case is a list of rounds. A round says what the loop sends, how the fake plays it, how the OpenAI API
 * would answer it (as a mocked reply), and what any provider's stream must then look like in OUR events.
 * The checks only look at neutral events, never at provider fields, so they are the same for Gemini later.
 */
import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@/types/action";
import {
  cutOffTurn,
  failureTurn,
  HANGING_TURN,
  refusalTurn,
  textTurn,
  toolCallTurn,
  truncatedTurn,
  type AiCall,
  type AiEvent,
  type AiMessage,
  type AiProvider,
  type AiToolDefinition,
  type FakeTurn,
} from "../index";
import {
  brokenStreamReply,
  completed,
  errorReply,
  functionCallDone,
  HANGING_REPLY,
  incomplete,
  refusalDelta,
  streamReply,
  textDelta,
  textRound,
  type MockReply,
} from "./openai-mock";

// ---------------------------------------------------------------- fixtures

const SEARCH_HOMES: AiToolDefinition = {
  name: "search_homes",
  description: "Find homes that match what the customer asked for.",
  parameters: {
    type: "object",
    properties: { locality: { type: ["string", "null"] } },
    required: ["locality"],
    additionalProperties: false,
  },
};

const HOME_DETAILS: AiToolDefinition = {
  name: "get_home_details",
  description: "Read one home's details.",
  parameters: {
    type: "object",
    properties: { homeId: { type: "string" } },
    required: ["homeId"],
    additionalProperties: false,
  },
};

const PREPARE_ENQUIRY: AiToolDefinition = {
  name: "prepare_enquiry",
  description: "Prepare an enquiry for the customer to confirm. Call it alone.",
  parameters: {
    type: "object",
    properties: { homeId: { type: "string" } },
    required: ["homeId"],
    additionalProperties: false,
  },
};

const SYSTEM = "You are a test assistant for the conformance suite.";
const QUESTION: AiMessage = { role: "user", text: "Show me 2 BHK homes in Adyar" };

function callFor(
  messages: readonly AiMessage[],
  tools: readonly AiToolDefinition[] = ALL_TOOLS,
): AiCall {
  return { system: SYSTEM, messages, tools, maxOutputTokens: 1200 };
}

const ALL_TOOLS = [SEARCH_HOMES, HOME_DETAILS, PREPARE_ENQUIRY];

function assistantAsked(
  ...calls: { id: string; name: string; input: Record<string, unknown> }[]
): AiMessage {
  return { role: "assistant", text: "", toolCalls: calls };
}

function toolSaid(callId: string, content: string): AiMessage {
  return { role: "tool", callId, content };
}

// ---------------------------------------------------------------- reading a round

export function textOf(events: readonly AiEvent[]): string {
  return events.flatMap((event) => (event.type === "text_delta" ? [event.text] : [])).join("");
}

function toolCallsOf(events: readonly AiEvent[]) {
  return events.flatMap((event) =>
    event.type === "tool_call" ? [{ id: event.id, name: event.name, input: event.input }] : [],
  );
}

function stopOf(events: readonly AiEvent[]) {
  const last = events.at(-1);
  if (last?.type !== "stop") throw new Error("The round did not end with a stop event");
  return last;
}

function failureOf(events: readonly AiEvent[]) {
  const stop = stopOf(events);
  if (stop.reason !== "error")
    throw new Error(`The round did not fail; it ended with ${stop.reason}`);
  return stop.failure;
}

/** What every stream must satisfy, whatever the case: one stop, last; a failure in our words; no stray calls. */
export function expectWellFormed(events: readonly AiEvent[]): void {
  const stops = events.filter((event) => event.type === "stop");
  expect(stops).toHaveLength(1);
  const stop = stopOf(events);
  for (const event of events) {
    if (event.type === "text_delta") expect(event.text).not.toBe("");
  }
  expect(events.filter((event) => event.type === "usage").length).toBeLessThanOrEqual(1);
  if (stop.reason === "error") {
    expect(ERROR_CODES).toContain(stop.failure.code);
    expect(Object.keys(stop.failure).sort()).toEqual(["code", "kind", "transient"]);
  }
  // A tool call only ever comes from a round that ends by asking for tools.
  if (toolCallsOf(events).length > 0) expect(stop.reason).toBe("tool_use");
}

// ---------------------------------------------------------------- the cases

export interface ConformanceRound {
  /** What the loop sends in this round. */
  readonly call: AiCall;
  /** The same round for the fake provider. */
  readonly fake: FakeTurn;
  /** The same round as the OpenAI API answers it. A function, because a reply can be read only once. */
  readonly openai: () => MockReply;
  /** Cancel the call right after it starts, as the loop's deadline does. */
  readonly abortAfterStart?: boolean;
  /** What the stream must be, in our events. */
  readonly check: (events: readonly AiEvent[]) => void;
}

export interface ConformanceCase {
  readonly name: string;
  readonly rounds: readonly ConformanceRound[];
}

const LONG_ANSWER = Array.from(
  { length: 40 },
  (_unused, index) => `Home ${index + 1} has two bedrooms and a balcony.`,
).join(" ");

const SEARCH_CALL = { id: "call_1", name: "search_homes", input: { locality: "Adyar" } };
const DETAILS_CALL = { id: "call_2", name: "get_home_details", input: { homeId: "home-1" } };

export const CONFORMANCE_CASES: readonly ConformanceCase[] = [
  {
    name: "one tool call: the call arrives whole, then usage, then tool_use",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: toolCallTurn([SEARCH_CALL]),
        openai: () =>
          streamReply([
            functionCallDone("call_1", "search_homes", '{"locality":"Adyar"}'),
            completed(),
          ]),
        check: (events) => {
          expect(toolCallsOf(events)).toEqual([SEARCH_CALL]);
          expect(events.some((event) => event.type === "usage")).toBe(true);
          expect(stopOf(events)).toEqual({ type: "stop", reason: "tool_use" });
        },
      },
    ],
  },
  {
    name: "two tool calls in a row: each round asks once, then the answer follows",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: toolCallTurn([SEARCH_CALL]),
        openai: () =>
          streamReply([
            functionCallDone("call_1", "search_homes", '{"locality":"Adyar"}'),
            completed(),
          ]),
        check: (events) => {
          expect(toolCallsOf(events)).toEqual([SEARCH_CALL]);
          expect(stopOf(events).reason).toBe("tool_use");
        },
      },
      {
        call: callFor([
          QUESTION,
          assistantAsked(SEARCH_CALL),
          toolSaid("call_1", '{"homes":["home-1"]}'),
        ]),
        fake: toolCallTurn([DETAILS_CALL]),
        openai: () =>
          streamReply([
            functionCallDone("call_2", "get_home_details", '{"homeId":"home-1"}'),
            completed(),
          ]),
        check: (events) => {
          expect(toolCallsOf(events)).toEqual([DETAILS_CALL]);
          expect(stopOf(events).reason).toBe("tool_use");
        },
      },
      {
        call: callFor([
          QUESTION,
          assistantAsked(SEARCH_CALL),
          toolSaid("call_1", '{"homes":["home-1"]}'),
          assistantAsked(DETAILS_CALL),
          toolSaid("call_2", '{"title":"2 BHK in Adyar"}'),
        ]),
        fake: textTurn("I found a 2 BHK in Adyar."),
        openai: () => streamReply(textRound("I found a 2 BHK in Adyar.")),
        check: (events) => {
          expect(toolCallsOf(events)).toEqual([]);
          expect(textOf(events)).toBe("I found a 2 BHK in Adyar.");
          expect(stopOf(events)).toEqual({ type: "stop", reason: "end" });
        },
      },
    ],
  },
  {
    name: "parallel read calls: every call is delivered, in the order given, with its own id",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: toolCallTurn([
          { id: "call_a", name: "get_home_details", input: { homeId: "home-1" } },
          { id: "call_b", name: "get_home_details", input: { homeId: "home-2" } },
          { id: "call_c", name: "get_home_details", input: { homeId: "home-3" } },
        ]),
        openai: () =>
          streamReply([
            functionCallDone("call_a", "get_home_details", '{"homeId":"home-1"}'),
            functionCallDone("call_b", "get_home_details", '{"homeId":"home-2"}'),
            functionCallDone("call_c", "get_home_details", '{"homeId":"home-3"}'),
            completed(),
          ]),
        check: (events) => {
          expect(toolCallsOf(events).map((toolCall) => toolCall.id)).toEqual([
            "call_a",
            "call_b",
            "call_c",
          ]);
          expect(toolCallsOf(events).map((toolCall) => toolCall.input)).toEqual([
            { homeId: "home-1" },
            { homeId: "home-2" },
            { homeId: "home-3" },
          ]);
          expect(stopOf(events).reason).toBe("tool_use");
        },
      },
      {
        call: callFor([
          QUESTION,
          assistantAsked(
            { id: "call_a", name: "get_home_details", input: { homeId: "home-1" } },
            { id: "call_b", name: "get_home_details", input: { homeId: "home-2" } },
            { id: "call_c", name: "get_home_details", input: { homeId: "home-3" } },
          ),
          toolSaid("call_a", '{"title":"one"}'),
          toolSaid("call_b", '{"title":"two"}'),
          toolSaid("call_c", '{"title":"three"}'),
        ]),
        fake: textTurn("Here are the three homes."),
        openai: () => streamReply(textRound("Here are the three homes.")),
        check: (events) => {
          expect(textOf(events)).toBe("Here are the three homes.");
          expect(stopOf(events).reason).toBe("end");
        },
      },
    ],
  },
  {
    name: "a mixed round: a propose call and read calls all arrive, none dropped, in order",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: toolCallTurn([
          { id: "call_a", name: "get_home_details", input: { homeId: "home-1" } },
          { id: "call_b", name: "prepare_enquiry", input: { homeId: "home-1" } },
          { id: "call_c", name: "search_homes", input: { locality: null } },
        ]),
        openai: () =>
          streamReply([
            functionCallDone("call_a", "get_home_details", '{"homeId":"home-1"}'),
            functionCallDone("call_b", "prepare_enquiry", '{"homeId":"home-1"}'),
            functionCallDone("call_c", "search_homes", '{"locality":null}'),
            completed(),
          ]),
        check: (events) => {
          expect(toolCallsOf(events).map((toolCall) => toolCall.name)).toEqual([
            "get_home_details",
            "prepare_enquiry",
            "search_homes",
          ]);
          expect(toolCallsOf(events)[2]?.input).toEqual({ locality: null });
          expect(stopOf(events).reason).toBe("tool_use");
        },
      },
    ],
  },
  {
    name: "a tool error: the error result goes back to the model, which answers in text",
    rounds: [
      {
        call: callFor([
          QUESTION,
          assistantAsked(SEARCH_CALL),
          toolSaid("call_1", '{"error":"that information is not available right now"}'),
        ]),
        fake: textTurn("I could not check that right now."),
        openai: () => streamReply(textRound("I could not check that right now.")),
        check: (events) => {
          expect(textOf(events)).toBe("I could not check that right now.");
          expect(toolCallsOf(events)).toEqual([]);
          expect(stopOf(events).reason).toBe("end");
        },
      },
    ],
  },
  {
    name: "a refusal: the stream ends with refusal and none of the refusal text is passed on",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: refusalTurn(),
        openai: () => streamReply([refusalDelta("I can't help with that."), completed()]),
        check: (events) => {
          expect(textOf(events)).toBe("");
          expect(toolCallsOf(events)).toEqual([]);
          expect(stopOf(events)).toEqual({ type: "stop", reason: "refusal" });
        },
      },
    ],
  },
  {
    name: "a long answer: the text streams in order, in several pieces, and ends normally",
    rounds: [
      {
        call: callFor([QUESTION], []),
        fake: textTurn(LONG_ANSWER, { usage: { inputTokens: 800, outputTokens: 400 } }),
        openai: () => streamReply(textRound(LONG_ANSWER, { input: 800, output: 400 })),
        check: (events) => {
          expect(textOf(events)).toBe(LONG_ANSWER);
          expect(events.filter((event) => event.type === "text_delta").length).toBeGreaterThan(10);
          expect(events.find((event) => event.type === "usage")).toMatchObject({
            inputTokens: 800,
            outputTokens: 400,
          });
          expect(stopOf(events)).toEqual({ type: "stop", reason: "end" });
        },
      },
    ],
  },
  {
    name: "an answer cut by the token cap ends with length and keeps the text it had",
    rounds: [
      {
        call: callFor([QUESTION], []),
        fake: truncatedTurn("Home 1 has two bedrooms and a bal"),
        openai: () =>
          streamReply([
            textDelta("Home 1 has two bedrooms and a bal"),
            incomplete("max_output_tokens"),
          ]),
        check: (events) => {
          expect(textOf(events)).toBe("Home 1 has two bedrooms and a bal");
          expect(stopOf(events)).toEqual({ type: "stop", reason: "length" });
        },
      },
    ],
  },
  {
    name: "a cut-off stream: the text it had is kept and the round fails as interrupted",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: cutOffTurn("Here are some"),
        openai: () => brokenStreamReply([textDelta("Here are some")]),
        check: (events) => {
          expect(textOf(events)).toBe("Here are some");
          expect(failureOf(events)).toEqual({
            kind: "interrupted",
            code: "UPSTREAM_FAILED",
            transient: true,
          });
        },
      },
    ],
  },
  {
    name: "a stream that closes with no final event is a cut-off stream too",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: cutOffTurn("Here are some"),
        openai: () => streamReply([textDelta("Here are some")]),
        check: (events) => {
          expect(textOf(events)).toBe("Here are some");
          expect(failureOf(events).kind).toBe("interrupted");
        },
      },
    ],
  },
  {
    name: "a timeout: when the caller's deadline passes the round fails as a timeout, with no tool call",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: HANGING_TURN,
        openai: () => HANGING_REPLY,
        abortAfterStart: true,
        check: (events) => {
          expect(toolCallsOf(events)).toEqual([]);
          expect(failureOf(events)).toEqual({
            kind: "timeout",
            code: "UPSTREAM_FAILED",
            transient: true,
          });
        },
      },
    ],
  },
  {
    name: "invalid arguments: text that is not JSON arrives as undefined, for the loop to reject",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: toolCallTurn([{ id: "call_1", name: "search_homes", input: undefined }]),
        openai: () =>
          streamReply([functionCallDone("call_1", "search_homes", "{not json"), completed()]),
        check: (events) => {
          expect(toolCallsOf(events)).toEqual([
            { id: "call_1", name: "search_homes", input: undefined },
          ]);
          expect(stopOf(events).reason).toBe("tool_use");
        },
      },
    ],
  },
  {
    name: "invalid arguments: valid JSON of the wrong shape passes through unchanged, for the loop to reject",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: toolCallTurn([{ id: "call_1", name: "search_homes", input: ["Adyar", 2] }]),
        openai: () =>
          streamReply([functionCallDone("call_1", "search_homes", '["Adyar",2]'), completed()]),
        check: (events) => {
          expect(toolCallsOf(events)).toEqual([
            { id: "call_1", name: "search_homes", input: ["Adyar", 2] },
          ]);
        },
      },
    ],
  },
  {
    name: "a provider that says slow down: RATE_LIMITED, not retried at once",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: failureTurn("rate_limited"),
        openai: () => errorReply(429, "rate_limit_exceeded"),
        check: (events) => {
          expect(failureOf(events)).toEqual({
            kind: "rate_limited",
            code: "RATE_LIMITED",
            transient: false,
          });
        },
      },
    ],
  },
  {
    name: "a provider that is down: UPSTREAM_FAILED, worth one retry",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: failureTurn("unavailable"),
        openai: () => errorReply(503, "server_error"),
        check: (events) => {
          expect(failureOf(events)).toEqual({
            kind: "unavailable",
            code: "UPSTREAM_FAILED",
            transient: true,
          });
        },
      },
    ],
  },
  {
    name: "a request or key the provider rejects: INTERNAL, because the fault is ours",
    rounds: [
      {
        call: callFor([QUESTION]),
        fake: failureTurn("rejected"),
        openai: () => errorReply(401, "invalid_api_key"),
        check: (events) => {
          expect(failureOf(events)).toEqual({
            kind: "rejected",
            code: "INTERNAL",
            transient: false,
          });
        },
      },
    ],
  },
];

// ---------------------------------------------------------------- running them

export interface ConformanceDriver {
  /** A provider ready to play exactly these rounds, and how many of them it has not played. */
  readonly build: (rounds: readonly ConformanceRound[]) => {
    provider: AiProvider;
    remaining: () => number;
  };
}

async function collectRound(provider: AiProvider, round: ConformanceRound): Promise<AiEvent[]> {
  const controller = new AbortController();
  const iterator = provider
    .stream(round.abortAfterStart ? { ...round.call, signal: controller.signal } : round.call)
    [Symbol.asyncIterator]();
  const events: AiEvent[] = [];
  let pending = iterator.next();
  if (round.abortAfterStart) {
    // Let the request reach the provider (or its mock) and wait there, then pass the deadline.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    controller.abort();
  }
  for (;;) {
    const result = await pending;
    if (result.done) return events;
    events.push(result.value);
    pending = iterator.next();
  }
}

/** Registers every case as a named test for one provider. */
export function defineConformanceSuite(providerLabel: string, driver: ConformanceDriver): void {
  describe(`UT-ai-conformance (${providerLabel}): the provider contract of ADR-128 section 4.4`, () => {
    for (const conformanceCase of CONFORMANCE_CASES) {
      it(conformanceCase.name, async () => {
        const { provider, remaining } = driver.build(conformanceCase.rounds);
        for (const conformanceRound of conformanceCase.rounds) {
          const events = await collectRound(provider, conformanceRound);
          expectWellFormed(events);
          conformanceRound.check(events);
        }
        expect(remaining()).toBe(0);
      });
    }
  });
}
