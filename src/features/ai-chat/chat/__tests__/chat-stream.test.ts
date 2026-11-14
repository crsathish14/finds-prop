import { describe, expect, it } from "vitest";
import { encodeChatEvent, type ChatStreamEvent } from "../../endpoint/events";
import { limitResponse, serverErrorResponse } from "../../endpoint/responses";
import { readChatEvents, readChatFailure, type ChatEvent } from "../chat-stream";

function streamOf(...chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of readChatEvents(body)) events.push(event);
  return events;
}

const translate = ((key: string, values?: Record<string, unknown>) =>
  `${key}${values ? JSON.stringify(values) : ""}`) as never;

describe("reading the chat stream (AI-P5-T02)", () => {
  it("reads the events the endpoint writes, in order", async () => {
    const sent: ChatStreamEvent[] = [
      { type: "start", requestId: "r1" },
      { type: "status", text: "Searching…" },
      { type: "text", text: "I found two homes. " },
      { type: "card", reference: { kind: "home", homeId: "aaaaaaaa", slug: "two-bhk" } },
      { type: "card", reference: { kind: "project", slug: "kadal-vista" } },
      { type: "notice", key: "ai.disclaimer", text: "General information." },
      { type: "done", outcome: "answered" },
    ];
    const bytes = sent.flatMap((event) => [...encodeChatEvent(event)]);
    expect(await collect(streamOf(new Uint8Array(bytes)))).toEqual(sent);
  });

  it("joins a line that arrives in pieces, wherever it is cut, even inside a multi-byte character", async () => {
    const line = encodeChatEvent({ type: "text", text: "From ₹1.25 Cr, ₹48,000 a month." });
    for (let cut = 1; cut < line.length; cut += 1) {
      const events = await collect(streamOf(line.slice(0, cut), line.slice(cut)));
      expect(events).toEqual([{ type: "text", text: "From ₹1.25 Cr, ₹48,000 a month." }]);
    }
  });

  it("reads a last line that has no newline", async () => {
    expect(await collect(streamOf('{"type":"done","outcome":"answered"}'))).toEqual([
      { type: "done", outcome: "answered" },
    ]);
  });

  it("ignores a line that is not an event of the closed set", async () => {
    const events = await collect(
      streamOf(
        "not json\n",
        '{"type":"tool_call","name":"search"}\n',
        '{"type":"card","reference":{"kind":"home"}}\n',
        '{"type":"text","text":"ok"}\n',
        "\n",
      ),
    );
    expect(events).toEqual([{ type: "text", text: "ok" }]);
  });
});

describe("reading the endpoint's refusals (AI-P5-T02)", () => {
  it("maps each state of the endpoint to the screen the chat shows", async () => {
    const gate = limitResponse("ai_chat_trial", undefined, "r", translate);
    expect(await readChatFailure(gate)).toEqual({ state: "sign_in_required" });
    const burst = limitResponse("ai_chat_burst", 44.2, "r", translate);
    expect(await readChatFailure(burst)).toEqual({ state: "too_many_messages", seconds: 45 });
    for (const scope of ["ai_chat_user_day", "ai_chat_trial_ip"] as const) {
      expect(await readChatFailure(limitResponse(scope, 3600, "r", translate))).toEqual({
        state: "daily_limit",
      });
    }
    const budget = limitResponse("ai_chat_global_day", 3600, "r", translate);
    expect(await readChatFailure(budget)).toEqual({ state: "unavailable" });
    expect(await readChatFailure(serverErrorResponse("r", translate))).toEqual({ state: "error" });
  });

  it("treats anything else as the error with Try again", async () => {
    expect(await readChatFailure(new Response("<html>", { status: 502 }))).toEqual({
      state: "error",
    });
    expect(await readChatFailure(Response.json({ error: { code: "VALIDATION" } }))).toEqual({
      state: "error",
    });
    expect(await readChatFailure(Response.json({ unexpected: true }))).toEqual({ state: "error" });
  });
});
