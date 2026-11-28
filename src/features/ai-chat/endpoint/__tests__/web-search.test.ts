import { describe, expect, it } from "vitest";
import { z } from "zod";
import { textTurn } from "@/server/ai";
import type { AiChatTool } from "../../tools/types";
import { chatRequest, createHarness, readEvents, say, SIGNED_IN } from "./harness";

// UT-ai-endpoint-web-search (ADR-218): the endpoint offers the web search on a message only to a signed-in customer and
// only when the deps carry it (FLAG_AI_WEB_SEARCH on); the system prompt carries its rules only then; and the usage row
// says how many web searches the message ran. Made-up tools.

const { handleAiChat } = await import("../handler");

const webTool: AiChatTool<{ query: string }, { status: string }> = {
  name: "search_web",
  kind: "read",
  callGroup: "web",
  description: "A made-up web search for the endpoint tests.",
  input: z.object({ query: z.string() }),
  output: z.object({ status: z.string() }),
  run: () => Promise.resolve({ output: { status: "nothing_found" }, references: [] }),
};

async function ask(options: { signedIn: boolean; served: boolean }) {
  const harness = createHarness({ script: [textTurn("An answer.")] });
  harness.session = options.signedIn ? SIGNED_IN : null;
  await readEvents(
    await handleAiChat(chatRequest(say("what is the stamp duty now?")), {
      ...harness.deps,
      ...(options.served ? { webSearch: { tool: webTool } } : {}),
    }),
  );
  await Promise.all(harness.kept);
  const sent = harness.provider.calls[0];
  return {
    tools: sent?.tools.map((tool) => tool.name) ?? [],
    system: sent?.system ?? "",
    usage: harness.usage,
  };
}

describe("UT-ai-endpoint-web-search: when the web search is offered", () => {
  it("offers it to a signed-in customer when the server has it, with its rules in the prompt", async () => {
    const run = await ask({ signedIn: true, served: true });
    expect(run.tools).toContain("search_web");
    expect(run.system).toContain("Trusted websites:");
  });

  it("does not offer it when the server has none (FLAG_AI_WEB_SEARCH off), and still answers", async () => {
    const run = await ask({ signedIn: true, served: false });
    expect(run.tools).not.toContain("search_web");
    expect(run.system).not.toContain("Trusted websites:");
    expect(run.usage.at(-1)).toMatchObject({ outcome: "answered", webSearches: 0 });
  });

  it("never offers it to a guest", async () => {
    const run = await ask({ signedIn: false, served: true });
    expect(run.tools).not.toContain("search_web");
    expect(run.system).not.toContain("Trusted websites:");
  });
});
