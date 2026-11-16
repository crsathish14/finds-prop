import { describe, expect, it } from "vitest";
import { textTurn, toolCallTurn } from "@/server/ai";
import { TOOL_CONTEXT } from "../../tools/__tests__/fixtures";
import { chatRequest, createHarness, eventTypes, HOME_ID, readEvents, say } from "./harness";

const { handleAiChat } = await import("../handler");

// UT-ai-empty-answer: an answer with no words left after the check (only a card marker) gets the fixed reply,
// never a card with a name and nothing said.

const HOME_CALL = toolCallTurn([{ id: "call-1", name: "lookup_home", input: { id: "any" } }]);

describe("UT-ai-empty-answer: an answer with no words", () => {
  it("replaces an answer that is only a card marker with the fixed reply, and sends no card", async () => {
    const harness = createHarness({ script: [HOME_CALL, textTurn(`[[home:${HOME_ID}]]`)] });
    const response = await handleAiChat(chatRequest(say("compare the selected one")), harness.deps);
    const events = await readEvents(response);
    expect(eventTypes(events)).not.toContain("card");
    expect(events.at(-2)).toMatchObject({
      type: "replace",
      key: "ai.fallback",
      text: TOOL_CONTEXT.translate("ai.fallback"),
    });
    expect(events.at(-1)).toEqual({ type: "done", outcome: "fallback" });
  });

  it("keeps a normal answer with words and its card", async () => {
    const harness = createHarness({
      script: [HOME_CALL, textTurn(`Here is the flat. [[home:${HOME_ID}]]`)],
    });
    const events = await readEvents(
      await handleAiChat(chatRequest(say("show me a flat")), harness.deps),
    );
    expect(eventTypes(events)).toContain("card");
    expect(eventTypes(events)).not.toContain("replace");
  });
});
