/**
 * MANUAL, THE OWNER RUNS THIS. The real-key run of the conformance suite (AI-P1-T03, ADR-128 section 4.4).
 *
 * It calls the real OpenAI API, so it costs a few cents and needs the owner's own key. It does nothing, and
 * makes no network call, unless BOTH `OPENAI_API_KEY` and `AI_MODEL` are set in the environment of the
 * command that runs it. In normal CI and in `npm run check` neither is set, so this file registers no
 * tests. Agents never run it and never see the key. Steps: `docs/runbooks/ai-spike.md` ("Conformance run").
 *
 * Only the cases that a real model can be made to show are here: a model cannot be told to refuse, to cut
 * its own stream or to write invalid JSON. Those cases (refusal, mixed round, cut-off stream, invalid
 * arguments, error mapping) run against mocked HTTP in `openai.conformance.test.ts`. A passing live run
 * plus a passing mocked run is what accepts the provider; only after it may parallel calls be switched on.
 */
import { describe, expect, it } from "vitest";
import { env } from "@/server/env";
import {
  createOpenAiProvider,
  type AiCall,
  type AiEvent,
  type AiMessage,
  type AiToolDefinition,
} from "../index";

const SEARCH_HOMES: AiToolDefinition = {
  name: "search_homes",
  description:
    "Find homes for sale in a locality. Always use this to answer a question about homes.",
  parameters: {
    type: "object",
    properties: { locality: { type: "string" } },
    required: ["locality"],
    additionalProperties: false,
  },
};

const SYSTEM =
  "You help people find homes. For any question about homes in a place, call search_homes first. " +
  "Answer in one or two short sentences from the tool result only.";
const QUESTION: AiMessage = {
  role: "user",
  text: "Are there any homes for sale in Adyar, Chennai?",
};

async function collect(provider: { stream(call: AiCall): AsyncIterable<AiEvent> }, call: AiCall) {
  const events: AiEvent[] = [];
  for await (const event of provider.stream(call)) events.push(event);
  return events;
}

const liveKey = env.OPENAI_API_KEY;
const liveModel = env.AI_MODEL;

describe.runIf(liveKey !== undefined && liveModel !== undefined)(
  "LIVE-ai-openai: the conformance cases a real model can show (manual, real key)",
  () => {
    // Built when a test starts: vitest still reads this block when the key is missing, and the adapter needs one.
    let cached: ReturnType<typeof createOpenAiProvider> | undefined;
    const liveProvider = () =>
      (cached ??= createOpenAiProvider({ apiKey: liveKey ?? "", model: liveModel ?? "" }));
    const call: AiCall = {
      system: SYSTEM,
      messages: [QUESTION],
      tools: [SEARCH_HOMES],
      maxOutputTokens: 400,
    };

    it("one tool call: the model calls the tool, with an object for arguments, and the round ends with tool_use", async () => {
      const events = await collect(liveProvider(), call);
      const toolCalls = events.filter((event) => event.type === "tool_call");
      expect(toolCalls.length).toBeGreaterThanOrEqual(1);
      expect(toolCalls[0]).toMatchObject({ name: "search_homes" });
      expect(typeof (toolCalls[0] as { input: unknown }).input).toBe("object");
      expect(events.at(-1)).toEqual({ type: "stop", reason: "tool_use" });
    });

    it("parallel calls are off: the model is asked for one call, and any extra ones still arrive with their own ids", async () => {
      const events = await collect(liveProvider(), {
        ...call,
        messages: [{ role: "user", text: "Compare homes in Adyar, Velachery and Anna Nagar." }],
      });
      const ids = events.flatMap((event) => (event.type === "tool_call" ? [event.id] : []));
      expect(ids.length).toBeGreaterThanOrEqual(1);
      expect(new Set(ids).size).toBe(ids.length);
      // The result of this check is the evidence for switching parallel calls on later; it is not a pass condition.
    });

    it("two in a row and a tool result: the result goes back by id and the model answers in text", async () => {
      const first = await collect(liveProvider(), call);
      const asked = first.flatMap((event) => (event.type === "tool_call" ? [event] : []));
      expect(asked.length).toBeGreaterThanOrEqual(1);
      const second = await collect(liveProvider(), {
        ...call,
        messages: [
          QUESTION,
          {
            role: "assistant",
            text: "",
            toolCalls: asked.map((toolCall) => ({
              id: toolCall.id,
              name: toolCall.name,
              input: (toolCall.input ?? {}) as Record<string, unknown>,
            })),
          },
          ...asked.map((toolCall): AiMessage => ({
            role: "tool",
            callId: toolCall.id,
            content: '{"homes":[{"title":"2 BHK in Adyar","priceText":"example"}]}',
          })),
        ],
      });
      expect(second.filter((event) => event.type === "text_delta").length).toBeGreaterThan(0);
      expect(second.find((event) => event.type === "usage")).toBeDefined();
      expect(second.at(-1)).toMatchObject({ type: "stop" });
    });

    it("a tool error: the error result goes back and the model answers without crashing the round", async () => {
      const first = await collect(liveProvider(), call);
      const asked = first.flatMap((event) => (event.type === "tool_call" ? [event] : []));
      const second = await collect(liveProvider(), {
        ...call,
        messages: [
          QUESTION,
          {
            role: "assistant",
            text: "",
            toolCalls: asked.map((toolCall) => ({
              id: toolCall.id,
              name: toolCall.name,
              input: (toolCall.input ?? {}) as Record<string, unknown>,
            })),
          },
          ...asked.map((toolCall): AiMessage => ({
            role: "tool",
            callId: toolCall.id,
            content: '{"error":"that information is not available right now"}',
          })),
        ],
      });
      expect(second.at(-1)).toMatchObject({ type: "stop" });
      expect(second.at(-1)).not.toMatchObject({ reason: "error" });
    });

    it("a long answer cut by the token cap ends with length", async () => {
      const events = await collect(liveProvider(), {
        system: "Write long, detailed answers.",
        messages: [{ role: "user", text: "Describe in detail what to check when buying a home." }],
        tools: [],
        maxOutputTokens: 16,
      });
      expect(events.at(-1)).toEqual({ type: "stop", reason: "length" });
    });

    it("a timeout: a call cancelled at once fails as a timeout", async () => {
      const controller = new AbortController();
      controller.abort();
      const events = await collect(liveProvider(), { ...call, signal: controller.signal });
      expect(events.at(-1)).toMatchObject({
        type: "stop",
        reason: "error",
        failure: { kind: "timeout" },
      });
    });

    it("a key the provider rejects fails as rejected (INTERNAL), the fault being ours", async () => {
      const wrongKey = createOpenAiProvider({
        apiKey: "sk-invalid-key-for-the-conformance-run",
        model: liveModel ?? "",
      });
      const events = await collect(wrongKey, call);
      expect(events.at(-1)).toMatchObject({
        type: "stop",
        reason: "error",
        failure: { kind: "rejected", code: "INTERNAL" },
      });
    });
  },
);
