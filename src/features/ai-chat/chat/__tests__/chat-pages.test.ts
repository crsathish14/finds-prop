import { describe, expect, it } from "vitest";
import type { AssistantEntry, ChatEntry, ChatReference } from "../chat-model";
import {
  buildAnswerGroups,
  describeCards,
  groupIndexOfAnswer,
  pageIndexOfAnswer,
  resolveCardsAnswer,
} from "../chat-pages";

const home = (slug: string): ChatReference => ({ kind: "home", homeId: `id-${slug}`, slug });
const project = (slug: string): ChatReference => ({ kind: "project", slug });

const user = (id: string): ChatEntry => ({ id, role: "user", text: "Hello", masked: false });
function answer(
  id: string,
  references: ChatReference[],
  extra: Partial<AssistantEntry> = {},
): ChatEntry {
  return { id, role: "assistant", text: "Words", notes: [], references, replaced: false, ...extra };
}

describe("buildAnswerGroups: the pages of the cards page", () => {
  it("makes one group for each answer that brought cards, oldest first", () => {
    const groups = buildAnswerGroups([
      user("u1"),
      answer("a1", [home("a"), home("b")]),
      user("u2"),
      answer("a2", [project("p")]),
    ]);
    expect(groups.map((group) => group.id)).toEqual(["a1", "a2"]);
    expect(groups[0]?.pages).toEqual([[home("a"), home("b")]]);
  });

  it("leaves out an answer with no cards and an answer a fixed line replaced", () => {
    const groups = buildAnswerGroups([
      answer("a1", []),
      answer("a2", [home("a")], { replaced: true }),
      answer("a3", [home("b")]),
    ]);
    expect(groups.map((group) => group.id)).toEqual(["a3"]);
  });

  it("puts a Show more answer on the next page of the answer it continues", () => {
    const groups = buildAnswerGroups([
      answer("a1", [home("a")]),
      answer("a2", [home("b")], { moreOf: "a1" }),
      answer("a3", [home("c")], { moreOf: "a1" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.answerIds).toEqual(["a1", "a2", "a3"]);
    expect(groups[0]?.pages).toEqual([[home("a")], [home("b")], [home("c")]]);
  });

  it("starts a group of its own when the answer it continues is gone", () => {
    const groups = buildAnswerGroups([answer("a2", [home("b")], { moreOf: "missing" })]);
    expect(groups.map((group) => group.id)).toEqual(["a2"]);
  });

  it("counts the answer in flight, once it has cards", () => {
    const groups = buildAnswerGroups([answer("a1", [home("a")])], {
      id: "live",
      references: [project("p")],
      replaced: false,
    });
    expect(groups.map((group) => group.id)).toEqual(["a1", "live"]);
    expect(buildAnswerGroups([], { id: "live", references: [], replaced: false })).toEqual([]);
  });

  it("finds the group and the page an answer belongs to", () => {
    const groups = buildAnswerGroups([
      answer("a1", [home("a")]),
      answer("a2", [home("b")], { moreOf: "a1" }),
      answer("a3", [home("c")]),
    ]);
    expect(groupIndexOfAnswer(groups, "a2")).toBe(0);
    expect(groupIndexOfAnswer(groups, "a3")).toBe(1);
    expect(groupIndexOfAnswer(groups, "nope")).toBe(-1);
    const first = groups[0];
    expect(first && pageIndexOfAnswer(first, "a2")).toBe(1);
  });
});

describe("describeCards: how many, and what to call them", () => {
  it("calls homes, projects and a mixed list by their own word", () => {
    expect(describeCards([home("a"), home("b")])).toEqual({ count: 2, kind: "homes" });
    expect(describeCards([project("a")])).toEqual({ count: 1, kind: "projects" });
    expect(describeCards([home("a"), project("b"), home("c")])).toEqual({
      count: 3,
      kind: "properties",
    });
  });
});

describe("resolveCardsAnswer: whose cards the page shows", () => {
  const answers = [
    { id: "a1", hasCards: true },
    { id: "a2", hasCards: false },
    { id: "a3", hasCards: true },
    { id: "a4", hasCards: false },
  ];

  it("shows the answer's own cards when it has some", () => {
    expect(resolveCardsAnswer(answers, "a3")).toBe("a3");
  });

  it("keeps the cards before it for an answer with none", () => {
    expect(resolveCardsAnswer(answers, "a2")).toBe("a1");
    expect(resolveCardsAnswer(answers, "a4")).toBe("a3");
  });

  it("shows the first cards that come when the answer is before every card", () => {
    expect(
      resolveCardsAnswer(
        [
          { id: "a1", hasCards: false },
          { id: "a2", hasCards: true },
        ],
        "a1",
      ),
    ).toBe("a2");
  });

  it("starts on the last answer with cards when nothing is in view, and never goes blank", () => {
    expect(resolveCardsAnswer(answers, null)).toBe("a3");
    expect(resolveCardsAnswer(answers, "gone")).toBe("a3");
    expect(resolveCardsAnswer([{ id: "a1", hasCards: false }], "a1")).toBeNull();
    expect(resolveCardsAnswer([], null)).toBeNull();
  });
});
