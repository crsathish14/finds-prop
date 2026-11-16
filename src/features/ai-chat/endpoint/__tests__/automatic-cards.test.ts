import { describe, expect, it } from "vitest";
import type { AgentDone } from "../../agent-types";
import { showsAutomaticCards } from "../turn";

/** UT-ai-automatic-cards: when the records a turn's tools returned get a card without a marker. */

const HOME = { kind: "home", homeId: "k3x9a2bd", slug: "velachery-flat" } as const;

function done(overrides: Partial<AgentDone>): AgentDone {
  return {
    type: "done",
    outcome: "answered",
    noticeKey: null,
    limit: null,
    fallbackReason: null,
    truncated: false,
    rounds: 2,
    retried: false,
    toolCallsPerRound: [1],
    toolsRan: ["search_properties"],
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
    references: [HOME],
    toolResults: [],
    offers: [],
    ...overrides,
  };
}

describe("UT-ai-automatic-cards: showsAutomaticCards", () => {
  it("is on for a search that returned a record", () => {
    expect(showsAutomaticCards(done({}))).toBe(true);
  });

  it("is off when no tool returned a record (a refusal, a decline, an empty search)", () => {
    expect(showsAutomaticCards(done({ references: [], toolsRan: [] }))).toBe(false);
  });

  it("is off for an EMI answer", () => {
    expect(showsAutomaticCards(done({ toolsRan: ["get_property", "calculate_emi"] }))).toBe(false);
  });

  it("is off when the turn ended with a proposal (the confirm card is shown instead)", () => {
    const offers = [{} as AgentDone["offers"][number]];
    expect(showsAutomaticCards(done({ offers, toolsRan: ["propose_enquiry"] }))).toBe(false);
  });
});
