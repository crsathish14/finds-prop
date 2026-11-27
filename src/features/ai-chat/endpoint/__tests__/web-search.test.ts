import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { textTurn } from "@/server/ai";
import type { AiChatTool } from "../../tools/types";
import { chatRequest, createHarness, readEvents, say, SIGNED_IN } from "./harness";

// UT-ai-endpoint-web-search (ADR-218): the endpoint offers the web search on a message only to a signed-in customer and
// only while the admin's Web search switch is on, read on every message; the system prompt carries its rules only then;
// a switch that cannot be read is off; and the usage row says how many web searches the message ran. Made-up tools.

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

async function ask(options: { signedIn: boolean; isOn: () => Promise<boolean> }) {
  const harness = createHarness({ script: [textTurn("An answer.")] });
  harness.session = options.signedIn ? SIGNED_IN : null;
  const isOn = vi.fn(options.isOn);
  await readEvents(
    await handleAiChat(chatRequest(say("what is the stamp duty now?")), {
      ...harness.deps,
      webSearch: { tool: webTool, isOn },
    }),
  );
  await Promise.all(harness.kept);
  const sent = harness.provider.calls[0];
  return {
    isOn,
    tools: sent?.tools.map((tool) => tool.name) ?? [],
    system: sent?.system ?? "",
    usage: harness.usage,
  };
}

describe("UT-ai-endpoint-web-search: when the web search is offered", () => {
  it("offers it to a signed-in customer while the switch is on, with its rules in the prompt", async () => {
    const run = await ask({ signedIn: true, isOn: () => Promise.resolve(true) });
    expect(run.tools).toContain("search_web");
    expect(run.system).toContain("Trusted websites:");
    expect(run.isOn).toHaveBeenCalledTimes(1);
  });

  it("does not offer it while the switch is off", async () => {
    const run = await ask({ signedIn: true, isOn: () => Promise.resolve(false) });
    expect(run.tools).not.toContain("search_web");
    expect(run.system).not.toContain("Trusted websites:");
  });

  it("never offers it to a guest, and does not even read the switch for one", async () => {
    const run = await ask({ signedIn: false, isOn: () => Promise.resolve(true) });
    expect(run.tools).not.toContain("search_web");
    expect(run.system).not.toContain("Trusted websites:");
    expect(run.isOn).not.toHaveBeenCalled();
  });

  it("treats a switch that cannot be read as off, and still answers", async () => {
    const run = await ask({ signedIn: true, isOn: () => Promise.reject(new Error("made-up")) });
    expect(run.tools).not.toContain("search_web");
    expect(run.usage.at(-1)).toMatchObject({ outcome: "answered", webSearches: 0 });
  });
});
