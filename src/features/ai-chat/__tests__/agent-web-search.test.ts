import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AI_TOOL_GROUP_CALL_LIMITS } from "@/config/ai";
import { MAX_WEB_SEARCH_CALLS_PER_MESSAGE } from "@/config/web-search";
import {
  createFakeAiProvider,
  textTurn,
  toolCallTurn,
  type AiProvider,
  type FakeAiProvider,
} from "@/server/ai";
import { TOOL_CONTEXT } from "../tools/__tests__/fixtures";
import type { AiChatTool, AnyAiChatTool, ToolContext } from "../tools/types";
import type { AgentDone, AgentEvent } from "../agent-types";

// UT-ai-agent-web-search (ADR-218): what the loop does for the web search. A tool is told which tools gave a result in
// the EARLIER rounds of the message (never the same round, so a web search cannot run beside the site lookup it must
// follow); what a tool's own paid call spent is added to the message's usage; and one web search per message, past
// which a call is refused with `web_limit`. The tools here are made-up stand-ins.

vi.mock("@/server/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { runAgent } = await import("../agent");

const input = z.object({ id: z.string() });
const output = z.object({ name: z.string() });
const seen: { name: string; earlier: readonly string[] }[] = [];
const SPENT = { inputTokens: 5000, cachedInputTokens: 100, outputTokens: 80, webSearches: 1 };

function readTool(
  name: string,
  options: { group?: "web"; fails?: boolean; spends?: boolean } = {},
): AiChatTool<{ id: string }, { name: string }> {
  return {
    name,
    kind: "read",
    ...(options.group === undefined ? {} : { callGroup: options.group }),
    description: `A made-up read for the web search loop tests: ${name}.`,
    input,
    output,
    async run(value, context: ToolContext) {
      seen.push({ name, earlier: context.earlierResults ?? [] });
      if (options.spends === true) context.spend?.(SPENT);
      if (options.fails === true) throw new Error("made-up failure");
      return { output: { name: `${name} ${value.id}` }, references: [] };
    },
  };
}

const TOOLS: readonly AnyAiChatTool[] = [
  readTool("find_content"),
  readTool("broken_read", { fails: true }),
  readTool("web_find", { group: "web", spends: true }),
];

const call = (name: string, id: string) => ({ id: `call-${name}-${id}`, name, input: { id } });

async function collect(provider: AiProvider) {
  const events: AgentEvent[] = [];
  for await (const event of runAgent({
    provider,
    tools: TOOLS,
    system: "A made-up system prompt.",
    messages: [{ role: "user", text: "Zzcustomer: what is the stamp duty now?" }],
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

beforeEach(() => {
  seen.length = 0;
});

describe("UT-ai-agent-web-search: the loop and the web search", () => {
  it("allows one web search per message, in config and in the group caps", () => {
    expect(MAX_WEB_SEARCH_CALLS_PER_MESSAGE).toBe(1);
    expect(AI_TOOL_GROUP_CALL_LIMITS.web).toBe(1);
  });

  it("tells a tool only the tools that gave a result in earlier rounds, never one that failed or ran beside it", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([call("find_content", "a"), call("broken_read", "b"), call("web_find", "w")]),
      toolCallTurn([call("web_find", "x")]),
      textTurn("Here is what I found."),
    ]);
    await collect(provider);
    expect(seen.find((entry) => entry.name === "web_find")?.earlier).toEqual([]);
    expect(results(provider, 2).get("call-web_find-x")).toMatchObject({ error: "web_limit" });
  });

  it("gives the second round the tools that answered in the first", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([call("find_content", "a"), call("broken_read", "b")]),
      toolCallTurn([call("web_find", "w")]),
      textTurn("Here is what I found."),
    ]);
    await collect(provider);
    expect(seen.at(-1)).toEqual({ name: "web_find", earlier: ["find_content"] });
  });

  it("adds what the web search spent to the message's usage, beside the model's own tokens", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([call("find_content", "a")], { usage: { inputTokens: 100, outputTokens: 10 } }),
      toolCallTurn([call("web_find", "w")], { usage: { inputTokens: 200, outputTokens: 20 } }),
      textTurn("Done.", { usage: { inputTokens: 300, outputTokens: 30 } }),
    ]);
    const done = await collect(provider);
    expect(done.usage).toEqual({
      inputTokens: 600 + SPENT.inputTokens,
      outputTokens: 60 + SPENT.outputTokens,
      cachedInputTokens: SPENT.cachedInputTokens,
      webSearches: 1,
    });
  });
});
