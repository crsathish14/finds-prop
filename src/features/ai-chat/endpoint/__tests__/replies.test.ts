import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import type { Translate } from "@/lib/format";
import type { AgentDone } from "../../agent-types";
import { pickReplies, REPLY_MESSAGE_KEYS } from "../replies";

/** UT-ai-replies (ADR-175): which reply buttons the server offers under an answer, and that none is ever model-written. */

const translate = createTranslator({ locale: "en", messages: en }) as unknown as Translate;

const HOME = { kind: "home", homeId: "k3x9a2bd", slug: "velachery-flat" } as const;
const SECOND_HOME = { kind: "home", homeId: "m4y8b3ce", slug: "velachery-lake-flat" } as const;
const PROJECT = { kind: "project", slug: "kadal-vista" } as const;

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

const keys = (agent: AgentDone) => pickReplies(agent, translate).map((reply) => reply.key);

describe("UT-ai-replies: pickReplies", () => {
  it("offers enquire, EMI and similar homes for one home the customer looked at in detail", () => {
    expect(keys(done({ toolsRan: ["get_property"] }))).toEqual([
      "enquireHome",
      "workOutEmi",
      "similarHomes",
    ]);
  });

  it("never offers an enquiry under search results (ADR-204): one home gets EMI and similar homes", () => {
    expect(keys(done({}))).toEqual(["workOutEmi", "similarHomes"]);
    expect(keys(done({ references: [HOME, HOME] }))).toEqual(["workOutEmi", "similarHomes"]);
  });

  it("offers compare and show more for several homes, and no enquiry, even after a detail lookup", () => {
    expect(keys(done({ references: [HOME, SECOND_HOME] }))).toEqual(["compareHomes", "showMore"]);
    expect(
      keys(
        done({ references: [HOME, SECOND_HOME], toolsRan: ["search_properties", "get_property"] }),
      ),
    ).toEqual(["compareHomes", "showMore"]);
  });

  it("offers enquire and a site visit for one project looked at in detail, and nothing for one search result", () => {
    expect(keys(done({ references: [PROJECT], toolsRan: ["get_project"] }))).toEqual([
      "enquireProject",
      "siteVisit",
    ]);
    expect(keys(done({ references: [PROJECT], toolsRan: ["search_projects"] }))).toEqual([]);
  });

  it("offers nothing when nothing was found, for several projects, or for a mix of homes and projects", () => {
    expect(keys(done({ references: [], toolsRan: [] }))).toEqual([]);
    expect(keys(done({ references: [PROJECT, { kind: "project", slug: "kadal-bay" }] }))).toEqual(
      [],
    );
    expect(keys(done({ references: [HOME, PROJECT] }))).toEqual([]);
  });

  it("offers nothing beside a confirm card, for an EMI sum, for a comparison, or for a shortened answer", () => {
    const offers = [{} as AgentDone["offers"][number]];
    expect(keys(done({ offers, toolsRan: ["propose_enquiry"] }))).toEqual([]);
    expect(keys(done({ toolsRan: ["get_property", "calculate_emi"] }))).toEqual([]);
    expect(
      keys(done({ references: [HOME, SECOND_HOME], toolsRan: ["compare_properties"] })),
    ).toEqual([]);
    expect(keys(done({ outcome: "limit" }))).toEqual([]);
  });

  it("takes every button's words from en.json, in at most three buttons, short enough to be a chip", () => {
    for (const references of [[HOME], [HOME, SECOND_HOME], [PROJECT]] as const) {
      const replies = pickReplies(
        done({ references: [...references], toolsRan: ["get_property", "get_project"] }),
        translate,
      );
      expect(replies.length).toBeGreaterThan(0);
      expect(replies.length).toBeLessThanOrEqual(3);
      for (const reply of replies) {
        expect(reply.text.length).toBeGreaterThan(0);
        expect(reply.text.length).toBeLessThanOrEqual(40);
        expect(reply.text).not.toMatch(/^ai\./u);
      }
    }
    for (const key of Object.values(REPLY_MESSAGE_KEYS)) {
      expect(Object.keys(en.ai.replies)).toContain(key.replace("ai.replies.", ""));
    }
  });

  it("never words a button as something already done: none says sent, booked or submitted", () => {
    for (const [name, text] of Object.entries(en.ai.replies)) {
      if (name === "label") continue;
      expect(text, name).not.toMatch(/\b(sent|booked|submitted|confirmed)\b/iu);
    }
  });
});

describe("UT-ai-replies: what the chat remembers (ADR-206)", () => {
  const withMemory = (agent: AgentDone, memory: Parameters<typeof pickReplies>[2]) =>
    pickReplies(agent, translate, memory).map((reply) => reply.key);

  it("offers Show more only while the search has matches it has not shown", () => {
    const several = done({ references: [HOME, SECOND_HOME] });
    expect(withMemory(several, { more: true })).toEqual(["compareHomes", "showMore"]);
    expect(withMemory(several, { more: false })).toEqual(["compareHomes"]);
  });

  it("offers Show more under several projects of a search that has more", () => {
    const projects = done({
      references: [PROJECT, { kind: "project", slug: "kadal-bay" }],
      toolsRan: ["search_projects"],
    });
    expect(withMemory(projects, { more: true })).toEqual(["showMore"]);
    expect(withMemory(projects, { more: false })).toEqual([]);
  });

  it("offers an enquiry or a site visit once for each home or project", () => {
    const offered = (key: string) => key === "home:k3x9a2bd" || key === "project:kadal-vista";
    expect(withMemory(done({ toolsRan: ["get_property"] }), { offered })).toEqual([
      "workOutEmi",
      "similarHomes",
    ]);
    expect(
      withMemory(done({ references: [PROJECT], toolsRan: ["get_project"] }), { offered }),
    ).toEqual([]);
  });
});
