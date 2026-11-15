import { describe, expect, it } from "vitest";
import { evalCaseSchema, type EvalCase } from "../case-schema";
import { selectCases } from "../eval-run";

// UT-ai-eval-select (AI-P8-T01): narrowing a real-model run. A mistake stops the run before any money is spent.

function caseOf(id: string, set: "golden" | "red_team"): EvalCase {
  return evalCaseSchema.parse({
    id,
    set,
    category: "search",
    language: "en",
    title: "a case",
    messages: [{ role: "user", text: "hello there" }],
    scriptKind: set === "golden" ? "resists" : "misbehaves",
    script: [{ text: "x" }],
    expect: { handling: set === "golden" ? "answered" : "safe" },
  });
}

const ALL = [
  caseOf("G-test-01", "golden"),
  caseOf("G-test-02", "golden"),
  caseOf("R-test-01", "red_team"),
  caseOf("R-test-02", "red_team"),
];

describe("UT-ai-eval-select", () => {
  it("runs everything when nothing is asked", () => {
    expect(selectCases(ALL, {})).toHaveLength(4);
    expect(selectCases(ALL, { set: " ", only: "", limit: undefined })).toHaveLength(4);
  });

  it("narrows to one set, to some ids, and to a first few", () => {
    expect(selectCases(ALL, { set: "red_team" }).map((each) => each.id)).toEqual([
      "R-test-01",
      "R-test-02",
    ]);
    expect(selectCases(ALL, { only: "G-test-02, R-test-01" }).map((each) => each.id)).toEqual([
      "G-test-02",
      "R-test-01",
    ]);
    expect(selectCases(ALL, { limit: "3" })).toHaveLength(3);
    expect(selectCases(ALL, { set: "golden", limit: "1" }).map((each) => each.id)).toEqual([
      "G-test-01",
    ]);
  });

  it("stops on a mistake in the words instead of running something else", () => {
    expect(() => selectCases(ALL, { set: "gold" })).toThrow(/golden or red_team/u);
    expect(() => selectCases(ALL, { only: "G-test-01,G-nope-01" })).toThrow(/G-nope-01/u);
    expect(() => selectCases(ALL, { limit: "two" })).toThrow(/whole number/u);
    expect(() => selectCases(ALL, { limit: "0" })).toThrow(/whole number/u);
    expect(() => selectCases(ALL, { set: "golden", only: "R-test-01" })).toThrow(/no case/u);
  });
});
