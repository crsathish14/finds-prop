import { describe, expect, it } from "vitest";
import { z } from "zod";
import { textTurn, toolCallTurn } from "@/server/ai";
import type { AiChatTool } from "../../tools/types";
import { chatRequest, createHarness, readEvents, say, SIGNED_IN } from "./harness";

// UT-ai-endpoint-sign-in (ADR-171): the endpoint tells the tools whether the customer is signed in, from the verified
// session only, and nothing else about them. The tools that list homes and projects use it to refuse a customer who is
// not signed in (their own tests: tools/__tests__/sign-in-required.test.ts).

const { handleAiChat } = await import("../handler");

function recordingTool(
  seen: Record<string, unknown>[],
): AiChatTool<{ id: string }, { ok: boolean }> {
  return {
    name: "lookup_home",
    kind: "read",
    description: "Records what it was given, for the endpoint tests.",
    input: z.object({ id: z.string() }),
    output: z.object({ ok: z.boolean() }),
    async run(_input, context) {
      seen.push({ ...context });
      return { output: { ok: true }, references: [] };
    },
  };
}

const CALL = toolCallTurn([{ id: "call-1", name: "lookup_home", input: { id: "any" } }]);

describe("UT-ai-endpoint-sign-in: what the tools are told about the customer", () => {
  it("says a customer who is not signed in is not", async () => {
    const seen: Record<string, unknown>[] = [];
    const harness = createHarness({ script: [CALL, textTurn("Please sign in to search.")] });
    await readEvents(
      await handleAiChat(chatRequest(say("find me a flat")), {
        ...harness.deps,
        tools: [recordingTool(seen)],
      }),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]?.["signedIn"]).toBe(false);
  });

  it("says a signed-in customer is, and gives the tool no id, phone or session", async () => {
    const seen: Record<string, unknown>[] = [];
    const harness = createHarness({ script: [CALL, textTurn("Here you go.")] });
    harness.session = SIGNED_IN;
    await readEvents(
      await handleAiChat(chatRequest(say("find me a flat")), {
        ...harness.deps,
        tools: [recordingTool(seen)],
      }),
    );
    expect(seen[0]?.["signedIn"]).toBe(true);
    // The search memory (ADR-206) holds listing ids only; nothing names the customer.
    expect(Object.keys(seen[0] ?? {}).sort()).toEqual([
      "locale",
      "search",
      "signedIn",
      "translate",
    ]);
    expect(JSON.stringify(seen[0])).not.toContain(SIGNED_IN.userId);
  });
});
