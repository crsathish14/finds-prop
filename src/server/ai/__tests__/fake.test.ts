import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  chooseAiProvider,
  createFakeAiProvider,
  cutOffTurn,
  failureTurn,
  FAKE_INVENTED_LINK,
  FAKE_INVENTED_PHONE,
  FAKE_INVENTED_PRICE,
  FAKE_PROMPT_CANARY,
  HANGING_TURN,
  inventedLinkTurn,
  inventedPhoneTurn,
  inventedPriceTurn,
  leakedCanaryTurn,
  refusalTurn,
  textTurn,
  toolCallTurn,
  truncatedTurn,
  type AiCall,
  type AiEvent,
  type FakeTurn,
} from "../index";

const call: AiCall = {
  system: "You are a test assistant.",
  messages: [{ role: "user", text: "Show me homes in Adyar" }],
  tools: [],
  maxOutputTokens: 1200,
};

async function play(script: readonly FakeTurn[], request: AiCall = call): Promise<AiEvent[]> {
  const events: AiEvent[] = [];
  for await (const event of createFakeAiProvider(script).stream(request)) events.push(event);
  return events;
}

function textOf(events: readonly AiEvent[]): string {
  return events.flatMap((event) => (event.type === "text_delta" ? [event.text] : [])).join("");
}

describe("UT-ai-fake: the scriptable fake provider (ADR-128 4.4, the conformance reference)", () => {
  it("streams a text answer in several deltas, then usage, then one stop of 'end'", async () => {
    const events = await play([textTurn("Here are three homes in Adyar that fit your budget.")]);
    const deltas = events.filter((event) => event.type === "text_delta");
    expect(deltas.length).toBeGreaterThan(1);
    expect(textOf(events)).toBe("Here are three homes in Adyar that fit your budget.");
    expect(events.map((event) => event.type).slice(-2)).toEqual(["usage", "stop"]);
    expect(events.at(-1)).toEqual({ type: "stop", reason: "end" });
  });

  it("scripts one tool call, ending with 'tool_use'", async () => {
    const events = await play([
      toolCallTurn([{ id: "call_1", name: "search_properties", input: { locality: "Adyar" } }]),
    ]);
    expect(events.filter((event) => event.type === "tool_call")).toEqual([
      { type: "tool_call", id: "call_1", name: "search_properties", input: { locality: "Adyar" } },
    ]);
    expect(events.at(-1)).toEqual({ type: "stop", reason: "tool_use" });
  });

  it("scripts parallel tool calls in the order given, each with its own id", async () => {
    const events = await play([
      toolCallTurn([
        { id: "a", name: "get_property", input: { id: "1" } },
        { id: "b", name: "get_property", input: { id: "2" } },
        { id: "c", name: "list_localities", input: {} },
      ]),
    ]);
    const calls = events.flatMap((event) => (event.type === "tool_call" ? [event.id] : []));
    expect(calls).toEqual(["a", "b", "c"]);
  });

  it("scripts a mixed round of a read call and a propose call", async () => {
    const events = await play([
      toolCallTurn([
        { id: "a", name: "get_property", input: { id: "1" } },
        { id: "b", name: "propose_enquiry", input: { id: "1" } },
      ]),
    ]);
    expect(events.flatMap((event) => (event.type === "tool_call" ? [event.name] : []))).toEqual([
      "get_property",
      "propose_enquiry",
    ]);
  });

  it("carries arguments that are wrong on purpose, so the loop's own validation can be tested", async () => {
    const events = await play([
      toolCallTurn([
        { id: "bad_shape", name: "search_properties", input: { locality: 42 } },
        { id: "not_json", name: "search_properties", input: undefined },
      ]),
    ]);
    const inputs = events.flatMap((event) => (event.type === "tool_call" ? [event.input] : []));
    expect(inputs).toEqual([{ locality: 42 }, undefined]);
  });

  it("keeps the text a model wrote before asking for a tool, so a test can check it is never shown", async () => {
    const events = await play([
      toolCallTurn([{ id: "a", name: "search_properties", input: {} }], {
        text: "Let me look that up.",
      }),
    ]);
    expect(textOf(events)).toBe("Let me look that up.");
  });

  it("scripts a refusal with no text", async () => {
    const events = await play([refusalTurn()]);
    expect(textOf(events)).toBe("");
    expect(events.at(-1)).toEqual({ type: "stop", reason: "refusal" });
  });

  it("scripts a long answer that runs out of tokens", async () => {
    const events = await play([truncatedTurn("A very long answer that was cut")]);
    expect(events.at(-1)).toEqual({ type: "stop", reason: "length" });
  });

  it("scripts an invented phone number", async () => {
    expect(textOf(await play([inventedPhoneTurn()]))).toContain(FAKE_INVENTED_PHONE);
  });

  it("scripts an invented link", async () => {
    expect(textOf(await play([inventedLinkTurn()]))).toContain(FAKE_INVENTED_LINK);
  });

  it("scripts an invented price", async () => {
    expect(textOf(await play([inventedPriceTurn()]))).toContain(FAKE_INVENTED_PRICE);
  });

  it("scripts a prompt leak with the default canary or the real one", async () => {
    expect(textOf(await play([leakedCanaryTurn()]))).toContain(FAKE_PROMPT_CANARY);
    expect(textOf(await play([leakedCanaryTurn("REAL-CANARY-1")]))).toContain("REAL-CANARY-1");
  });

  it("uses only fictional contact details", () => {
    expect(FAKE_INVENTED_LINK).toContain(".example.test");
    expect(FAKE_INVENTED_PHONE).toMatch(/^\+91 9000/);
  });

  it.each([
    ["rate_limited", "RATE_LIMITED"],
    ["timeout", "UPSTREAM_FAILED"],
    ["unavailable", "UPSTREAM_FAILED"],
    ["refused", "UPSTREAM_FAILED"],
    ["rejected", "INTERNAL"],
  ] as const)(
    "scripts a %s failure that ends the stream with code %s and no text",
    async (kind, code) => {
      const events = await play([failureTurn(kind)]);
      expect(events).toEqual([
        { type: "stop", reason: "error", failure: { kind, code, transient: expect.any(Boolean) } },
      ]);
    },
  );

  it("scripts a stream that is cut off: some text, then an 'interrupted' failure", async () => {
    const events = await play([cutOffTurn("The first home is a two-bed")]);
    expect(textOf(events)).toBe("The first home is a two-bed");
    expect(events.at(-1)).toMatchObject({
      type: "stop",
      reason: "error",
      failure: { kind: "interrupted" },
    });
  });

  it("plays a stream written by hand, even one that never says stop", async () => {
    const events = await play([[{ type: "text_delta", text: "half" }]]);
    expect(events).toEqual([{ type: "text_delta", text: "half" }]);
  });

  it("reports the usage it was scripted with, or a default", async () => {
    const scripted = await play([
      textTurn("hi", { usage: { inputTokens: 7, outputTokens: 3, cachedInputTokens: 2 } }),
    ]);
    expect(scripted.find((event) => event.type === "usage")).toEqual({
      type: "usage",
      inputTokens: 7,
      outputTokens: 3,
      cachedInputTokens: 2,
    });
    const defaulted = await play([textTurn("hi")]);
    expect(defaulted.find((event) => event.type === "usage")).toMatchObject({
      inputTokens: 100,
      outputTokens: 1,
    });
  });

  describe("timeouts", () => {
    it("a hanging round waits until the caller aborts, then ends with a 'timeout' failure", async () => {
      const controller = new AbortController();
      const provider = createFakeAiProvider([HANGING_TURN]);
      const events: AiEvent[] = [];
      const reading = (async () => {
        for await (const event of provider.stream({ ...call, signal: controller.signal }))
          events.push(event);
      })();
      await Promise.resolve();
      expect(events).toEqual([]);
      controller.abort();
      await reading;
      expect(events).toEqual([
        {
          type: "stop",
          reason: "error",
          failure: { kind: "timeout", code: "UPSTREAM_FAILED", transient: true },
        },
      ]);
    });

    it("a hanging round with no signal, or one already aborted, times out at once instead of hanging a test", async () => {
      expect((await play([HANGING_TURN])).at(-1)).toMatchObject({
        reason: "error",
        failure: { kind: "timeout" },
      });
      const aborted = new AbortController();
      aborted.abort();
      expect(
        (await play([HANGING_TURN], { ...call, signal: aborted.signal })).at(-1),
      ).toMatchObject({
        failure: { kind: "timeout" },
      });
    });

    it("a stream that is aborted part-way stops with a 'timeout' failure and sends nothing more", async () => {
      const controller = new AbortController();
      const provider = createFakeAiProvider([
        textTurn("A long answer that arrives in many small pieces."),
      ]);
      const events: AiEvent[] = [];
      for await (const event of provider.stream({ ...call, signal: controller.signal })) {
        events.push(event);
        if (events.length === 1) controller.abort();
      }
      expect(events.at(-1)).toMatchObject({
        type: "stop",
        reason: "error",
        failure: { kind: "timeout" },
      });
      expect(events.filter((event) => event.type === "text_delta")).toHaveLength(1);
    });
  });

  describe("the script", () => {
    it("plays one turn per call, in order, and counts what is left", async () => {
      const provider = createFakeAiProvider([textTurn("first"), textTurn("second")]);
      expect(provider.remainingTurns).toBe(2);
      const first: AiEvent[] = [];
      for await (const event of provider.stream(call)) first.push(event);
      expect(provider.remainingTurns).toBe(1);
      const second: AiEvent[] = [];
      for await (const event of provider.stream(call)) second.push(event);
      expect(textOf(first)).toBe("first");
      expect(textOf(second)).toBe("second");
      expect(provider.remainingTurns).toBe(0);
    });

    it("fails loudly when called after the script has run out", async () => {
      const provider = createFakeAiProvider([]);
      await expect(
        (async () => {
          for await (const event of provider.stream(call)) void event;
        })(),
      ).rejects.toThrow(/after its script ran out/);
    });

    it("records every call so a test can check what the loop sent, including an answer-only round with no tools", async () => {
      const provider = createFakeAiProvider([textTurn("a"), textTurn("b")]);
      const messages: AiCall["messages"] = [{ role: "user", text: "hello" }];
      for await (const event of provider.stream({ ...call, messages })) void event;
      for await (const event of provider.stream({ ...call, messages, tools: [] })) void event;
      expect(provider.calls).toHaveLength(2);
      expect(provider.calls[0]?.messages).toEqual(messages);
      expect(provider.calls[1]?.tools).toEqual([]);
    });

    it("keeps its own copy of the messages, so a later change by the caller does not rewrite the record", async () => {
      const provider = createFakeAiProvider([textTurn("a")]);
      const messages: AiCall["messages"][number][] = [{ role: "user", text: "hello" }];
      for await (const event of provider.stream({ ...call, messages })) void event;
      messages.push({ role: "user", text: "later" });
      expect(provider.calls[0]?.messages).toHaveLength(1);
    });
  });

  describe("chooseAiProvider", () => {
    it("returns the fake by name, with its script", async () => {
      const provider = chooseAiProvider("fake", { script: [textTurn("scripted")] });
      expect(provider.name).toBe("fake");
      const events: AiEvent[] = [];
      for await (const event of provider.stream(call)) events.push(event);
      expect(textOf(events)).toBe("scripted");
    });

    it("refuses a provider that is not wired yet, and never falls back to the fake", () => {
      expect(() => chooseAiProvider("openai")).toThrow(ActionError);
      expect(() => chooseAiProvider("gemini")).toThrow(ActionError);
      expect(() => chooseAiProvider("")).toThrow(ActionError);
    });

    it("fails with INTERNAL, whose message is for logs and never for the customer", () => {
      try {
        chooseAiProvider("openai");
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(ActionError);
        expect((error as ActionError).code).toBe("INTERNAL");
      }
    });
  });
});
