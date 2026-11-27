import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createFakeAiProvider, textTurn, toolCallTurn } from "@/server/ai";
import messages from "@/i18n/messages/en.json";
import { TOOL_CONTEXT } from "../tools/__tests__/fixtures";
import { STATUS_MESSAGE_KEYS, type AiChatTool } from "../tools/types";
import type { AgentEvent } from "../agent-types";

// UT-ai-status-lines (ADR-217): the line the chat window shows comes from the tools a round runs, and a step a tool
// reports while it runs is passed on at once. The tools and words are made up apart from the approved lines.

vi.mock("@/server/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { runAgent } = await import("../agent");
const { statusLineFor } = await import("../status-lines");

const input = z.object({ id: z.string() });
const output = z.object({ name: z.string() });

/** A stand-in home search that reports the widening steps while it runs. */
const widening: AiChatTool<z.infer<typeof input>, z.infer<typeof output>> = {
  name: "search_properties",
  kind: "read",
  description: "Searches made-up homes.",
  input,
  output,
  async run(_input, context) {
    context.status?.(STATUS_MESSAGE_KEYS.nearby);
    await new Promise((resolve) => setTimeout(resolve, 5));
    context.status?.(STATUS_MESSAGE_KEYS.wider);
    return { output: { name: "A home" }, references: [] };
  },
};

describe("UT-ai-status-lines: which line shows", () => {
  it("names homes, articles, builders and the web, and keeps Searching for anything else", () => {
    expect(statusLineFor(["search_properties"])).toBe("ai.status.homes");
    expect(statusLineFor(["search_projects"])).toBe("ai.status.homes");
    expect(statusLineFor(["search_content"])).toBe("ai.status.articles");
    expect(statusLineFor(["research_builder"])).toBe("ai.status.builders");
    expect(statusLineFor(["search_web"])).toBe("ai.status.web");
    expect(statusLineFor(["calculate_emi"])).toBe("ai.searching");
    expect(statusLineFor(["calculate_emi", "get_builder"])).toBe("ai.status.builders");
  });

  it("uses the owner's approved words, in English", () => {
    expect(messages.ai.status).toEqual({
      homes: "Searching our homes…",
      articles: "Reading our articles…",
      builders: "Checking builder details…",
      web: "Searching the web…",
      nearby: "Searching nearby…",
      wider: "Extending the range…",
      widest: "Extending the range further…",
    });
  });
});

describe("UT-ai-status-lines: the steps of a running tool", () => {
  it("passes on the round's line, then each step the tool reports, before the answer", async () => {
    const provider = createFakeAiProvider([
      toolCallTurn([{ id: "call-1", name: "search_properties", input: { id: "x" } }]),
      textTurn("Here is a home nearby."),
    ]);
    const events: AgentEvent[] = [];
    for await (const event of runAgent({
      provider,
      tools: [widening],
      system: "You are a test.",
      messages: [{ role: "user", text: "homes in Velachery" }],
      context: TOOL_CONTEXT,
    })) {
      events.push(event);
    }
    const lines = events.flatMap((event) => (event.type === "status" ? [event.messageKey] : []));
    expect(lines).toEqual(["ai.status.homes", "ai.status.nearby", "ai.status.wider"]);
    expect(events.findIndex((event) => event.type === "text_delta")).toBeGreaterThan(
      events.findLastIndex((event) => event.type === "status"),
    );
  });
});
