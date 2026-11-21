import { describe, expect, it } from "vitest";
import type { AgentDone } from "../../agent-types";
import { showsAutomaticCards, showsAutomaticSources } from "../turn";

/** UT-ai-automatic-sources: when the articles and questions a turn's content tools returned get a source link (ADR-143 section 6.5). */

const HOME = { kind: "home", homeId: "k3x9a2bd", slug: "velachery-flat" } as const;
const ARTICLE = {
  kind: "article",
  id: "a1000000-0000-4000-8000-000000000001",
  slug: "registration-charges",
  title: "Registration charges explained",
  opened: false,
} as const;

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
    toolsRan: ["search_content"],
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
    references: [ARTICLE],
    toolResults: [],
    offers: [],
    ...overrides,
  };
}

describe("UT-ai-automatic-sources: showsAutomaticSources", () => {
  it("is on for a search that returned an article or a question", () => {
    expect(showsAutomaticSources(done({}))).toBe(true);
  });

  it("is off when no content tool returned a record (a no-match search, a refusal, a property search)", () => {
    expect(showsAutomaticSources(done({ references: [], toolsRan: [] }))).toBe(false);
    expect(
      showsAutomaticSources(done({ references: [HOME], toolsRan: ["search_properties"] })),
    ).toBe(false);
  });

  it("is off when the turn ended with a proposal", () => {
    const offers = [{} as AgentDone["offers"][number]];
    expect(showsAutomaticSources(done({ offers }))).toBe(false);
  });

  it("does not turn a content answer into a card, and keeps the cards of a mixed one", () => {
    expect(showsAutomaticCards(done({}))).toBe(false);
    const mixed = done({
      references: [HOME, ARTICLE],
      toolsRan: ["search_content", "search_properties"],
    });
    expect(showsAutomaticCards(mixed)).toBe(true);
    expect(showsAutomaticSources(mixed)).toBe(true);
  });
});
