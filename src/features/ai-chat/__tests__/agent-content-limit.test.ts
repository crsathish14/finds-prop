import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MAX_CONTENT_TOOL_CALLS_PER_MESSAGE, MAX_TOOL_CALLS_PER_MESSAGE } from "@/config/ai";
import {
  createFakeAiProvider,
  textTurn,
  toolCallTurn,
  type AiProvider,
  type FakeAiProvider,
} from "@/server/ai";
import { TOOL_CONTEXT } from "../tools/__tests__/fixtures";
import type { AiChatTool, AnyAiChatTool } from "../tools/types";
import type { AgentDone, AgentEvent } from "../agent-types";

// UT-ai-agent-content-limit (ADR-143 section 6.3): of the 6 tool calls of one customer message, at most 2 may be
// content calls (`search_content`, `get_content_item`: the tools of the `content` group). The loop counts them across
// rounds, refuses the third with `content_limit` (and does not spend the message's total on it), and leaves every other
// tool alone. The tools here are made-up stand-ins.

vi.mock("@/server/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { runAgent } = await import("../agent");

const input = z.object({ id: z.string() });
const output = z.object({ name: z.string() });
const ran = vi.fn();

function readTool(name: string, group?: "content"): AiChatTool<{ id: string }, { name: string }> {
  return {
    name,
    kind: "read",
    ...(group === undefined ? {} : { callGroup: group }),
    description: `A made-up read for the content limit tests: ${name}.`,
    input,
    output,
    async run(value) {
      ran(name, value.id);
      return { output: { name: `${name} ${value.id}` }, references: [] };
    },
  };
}

const TOOLS: readonly AnyAiChatTool[] = [
  readTool("find_content", "content"),
  readTool("read_content", "content"),
  readTool("find_home"),
];

const call = (name: string, id: string) => ({ id: `call-${name}-${id}`, name, input: { id } });

async function collect(provider: AiProvider) {
  const events: AgentEvent[] = [];
  for await (const event of runAgent({
    provider,
    tools: TOOLS,
    system: "A made-up system prompt.",
    messages: [{ role: "user", text: "Zzcustomer: how are registration charges worked out?" }],
    context: TOOL_CONTEXT,
  })) {
    events.push(event);
  }
  const done = events.at(-1);
  if (done?.type !== "done") throw new Error("The loop did not end with a done event");
  return done as AgentDone;
}

function results(provider: FakeAiProvider, index: number): Map<string, Record<string, unknown>> {
  const sent = provider.calls[index];
  if (sent === undefined) throw new Error(`The provider was not called ${index + 1} times`);
  return new Map(
    sent.messages.flatMap((message): [string, Record<string, unknown>][] =>
      message.role === "tool"
        ? [[message.callId, JSON.parse(message.content) as Record<string, unknown>]]
        : [],
    ),
  );
}

beforeEach(() => vi.clearAllMocks());

describe("UT-ai-agent-content-limit: two of the six calls", () => {
  it("is two in config, and fits inside the message's total", () => {
    expect(MAX_CONTENT_TOOL_CALLS_PER_MESSAGE).toBe(2);
    expect(MAX_CONTENT_TOOL_CALLS_PER_MESSAGE).toBeLessThan(MAX_TOOL_CALLS_PER_MESSAGE);
  });

  it("refuses the third content call of one round with content_limit, and still runs a home search beside them", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([
        call("find_content", "a"),
        call("find_content", "b"),
        call("find_content", "c"),
      ]),
      textTurn("Here is what I found."),
    ]);
    const done = await collect(provider);
    expect(ran).toHaveBeenCalledTimes(2);
    expect(ran).not.toHaveBeenCalledWith("find_content", "c");
    expect(results(provider, 1).get("call-find_content-c")).toMatchObject({
      error: "content_limit",
    });
    // The refused call did not use up the message's calls.
    expect(done.toolCallsPerRound).toEqual([2]);
    expect(done.outcome).toBe("answered");
  });

  it("counts the content calls of every round together, so a search and a read use the two, and the next one is refused", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([call("find_content", "a")]),
      toolCallTurn([call("read_content", "b")]),
      toolCallTurn([call("find_content", "c"), call("find_home", "h")]),
      textTurn("Here is what I found."),
    ]);
    const done = await collect(provider);
    expect(ran.mock.calls).toEqual([
      ["find_content", "a"],
      ["read_content", "b"],
      ["find_home", "h"],
    ]);
    const last = results(provider, 3);
    expect(last.get("call-find_content-c")).toMatchObject({ error: "content_limit" });
    expect(last.get("call-find_home-h")).toEqual({ name: "find_home h" });
    expect(done.toolCallsPerRound).toEqual([1, 1, 1]);
  });

  it("does not limit a tool outside the group: six home searches in two rounds still run", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([call("find_home", "1"), call("find_home", "2"), call("find_home", "3")]),
      toolCallTurn([call("find_home", "4"), call("find_home", "5"), call("find_home", "6")]),
      textTurn("Here is what I found."),
    ]);
    await collect(provider);
    expect(ran).toHaveBeenCalledTimes(6);
  });

  it("tells the model what to do next, in the error result and nothing else about why", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([
        call("find_content", "a"),
        call("find_content", "b"),
        call("read_content", "c"),
      ]),
      textTurn("Here is what I found."),
    ]);
    await collect(provider);
    const refused = results(provider, 1).get("call-read_content-c");
    expect(refused).toEqual({
      error: "content_limit",
      hint: expect.stringContaining("Answer from what you already have"),
    });
  });
});
