import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { AiEvent, FakeTurn } from "@/server/ai";
import { ROLE_SECTION } from "../../prompts/sections";
import { SYSTEM_PROMPT_CANARY } from "../../prompts/version";
import type { AnyAiChatTool } from "../../tools/types";
import { compileScript, indiaDayAfter } from "../script";

// UT-ai-eval-script (AI-P8-T01): a case's script becomes the fake provider's turns.

const SEARCH: AnyAiChatTool = {
  name: "search_properties",
  kind: "read",
  description: "a stand-in",
  input: z.object({
    bhk: z.number().nullable(),
    locality: z.string().nullable(),
    sort: z.string().nullable(),
  }),
  output: z.object({}),
  async run() {
    return { output: {}, references: [] };
  },
};

function eventsOf(turn: FakeTurn | undefined): readonly AiEvent[] {
  return turn === undefined || typeof turn === "string" ? [] : turn;
}

const textOf = (turn: FakeTurn | undefined) =>
  eventsOf(turn)
    .map((event) => (event.type === "text_delta" ? event.text : ""))
    .join("");

describe("UT-ai-eval-script", () => {
  it("fills the filters a script leaves out with null", () => {
    const [turn] = compileScript(
      [{ calls: [{ name: "search_properties", input: { bhk: 3 } }] }],
      [SEARCH],
    );
    const call = eventsOf(turn).find((event) => event.type === "tool_call");
    expect(call).toMatchObject({
      name: "search_properties",
      input: { bhk: 3, locality: null, sort: null },
    });
  });

  it("gives every call its own id across rounds", () => {
    const turns = compileScript(
      [
        {
          calls: [
            { name: "search_properties", input: {} },
            { name: "search_properties", input: {} },
          ],
        },
        { calls: [{ name: "search_properties", input: {} }] },
      ],
      [SEARCH],
    );
    const ids = turns.flatMap((turn) =>
      eventsOf(turn).flatMap((event) => (event.type === "tool_call" ? [event.id] : [])),
    );
    expect(ids).toEqual(["call-1", "call-2", "call-3"]);
  });

  it("plays text, a refusal and a failure", () => {
    const [text, refusal, failure] = compileScript(
      [{ text: "Hello there." }, { refusal: true }, { failure: "unavailable" }],
      [],
    );
    expect(textOf(text)).toBe("Hello there.");
    expect(eventsOf(refusal).at(-1)).toMatchObject({ type: "stop", reason: "refusal" });
    expect(eventsOf(failure).at(-1)).toMatchObject({ type: "stop", reason: "error" });
  });

  it("fills the markers in text and in the values of a call", () => {
    const now = new Date("2026-11-15T20:00:00Z");
    const [turn, answer] = compileScript(
      [
        {
          calls: [{ name: "search_properties", input: { locality: "visit {{day+10}}" } }],
          text: "{{canary}}",
        },
        { text: "{{prompt-copy}} on {{day+0}}" },
      ],
      [SEARCH],
      now,
    );
    expect(textOf(turn)).toBe(SYSTEM_PROMPT_CANARY);
    expect(eventsOf(turn).find((event) => event.type === "tool_call")).toMatchObject({
      input: { locality: "visit 2026-11-26" },
    });
    expect(textOf(answer)).toBe(
      `${ROLE_SECTION.split(/\s+/u).slice(0, 14).join(" ")} on 2026-11-16`,
    );
  });

  it("counts the day in India time, which is ahead of UTC", () => {
    expect(indiaDayAfter(new Date("2026-11-15T20:00:00Z"), 0)).toBe("2026-11-16");
    expect(indiaDayAfter(new Date("2026-11-15T10:00:00Z"), 365)).toBe("2027-11-15");
  });
});
