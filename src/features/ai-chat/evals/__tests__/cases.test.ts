import { describe, expect, it } from "vitest";
import { evalCaseSchema, EVAL_LANGUAGES, type EvalCategory } from "../case-schema";
import { CaseFileError, checkToolNames, loadCases, parseCaseFile } from "../cases";

// UT-ai-eval-cases (AI-P8-T01): the case files are valid, cover what ADR-128 section 9 asks for, and a bad file
// fails loudly with the file and the case named. The cases themselves are customer test data and made-up homes.

const valid = {
  id: "G-test-01",
  set: "golden",
  category: "search",
  language: "en",
  title: "a case",
  messages: [{ role: "user", text: "3 BHK in Velachery" }],
  scriptKind: "resists",
  script: [{ text: "Here you go." }],
  expect: { handling: "answered" },
};

function withChange(change: Record<string, unknown>, id = "G-test-01") {
  return { ...valid, id, ...change };
}

describe("UT-ai-eval-cases: the real files", () => {
  const cases = loadCases();

  it("hold about 60 golden and 40 red-team cases, with no id twice", () => {
    expect(cases.golden.length).toBeGreaterThanOrEqual(60);
    expect(cases.redTeam.length).toBeGreaterThanOrEqual(40);
    const ids = cases.all.map((evalCase) => evalCase.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(["golden", "redTeam"] as const)(
    "write %s cases in English, Tamil and Tanglish",
    (set) => {
      for (const language of EVAL_LANGUAGES)
        expect(
          cases[set].filter((evalCase) => evalCase.language === language).length,
          `${set} has no ${language} case`,
        ).toBeGreaterThanOrEqual(5);
    },
  );

  it("cover search, compare, builder, EMI, refusals, off-topic, internals probes, other people, competitors and injected listings", () => {
    const covered = new Set<EvalCategory>(cases.all.map((evalCase) => evalCase.category));
    for (const category of [
      "search",
      "compare",
      "builder",
      "emi",
      "advice",
      "off_topic",
      "internals_probe",
      "other_people",
      "competitor",
      "injected_listing",
      "personal_data",
      "forged_history",
      "propose",
      "site_link",
    ] as const)
      expect(covered.has(category), `no case for ${category}`).toBe(true);
  });

  it("put every case in the file of its set, and every red-team case's attack is something a customer typed", () => {
    expect(cases.golden.every((evalCase) => evalCase.set === "golden")).toBe(true);
    expect(cases.redTeam.every((evalCase) => evalCase.set === "red_team")).toBe(true);
  });

  it("give every red-team category at least one case the input check refuses and one the output check must catch", () => {
    const refusedByInput = cases.redTeam.filter(
      (evalCase) => evalCase.expect.handling === "refused_by_input",
    );
    const caughtByOutput = cases.redTeam.filter((evalCase) => evalCase.scriptKind === "misbehaves");
    expect(refusedByInput.length).toBeGreaterThanOrEqual(10);
    expect(caughtByOutput.length).toBeGreaterThanOrEqual(10);
  });

  it("name only tools that exist", () => {
    checkToolNames(cases.all, [
      "search_properties",
      "get_property",
      "list_localities",
      "search_projects",
      "get_project",
      "get_builder",
      "compare_properties",
      "calculate_emi",
      "propose_enquiry",
      "propose_site_visit",
    ]);
  });
});

describe("UT-ai-eval-cases: a bad file fails loudly", () => {
  it("accepts a valid case, with the defaults filled in", () => {
    const [parsed] = parseCaseFile("golden.json", [valid], "golden");
    expect(parsed?.expect.facts).toEqual([]);
    expect(parsed?.session).toBe("visitor");
  });

  it("refuses a file that is not a list of cases, and an empty one", () => {
    expect(() => parseCaseFile("golden.json", { cases: [] }, "golden")).toThrow(CaseFileError);
    expect(() => parseCaseFile("golden.json", [], "golden")).toThrow(CaseFileError);
    expect(() => parseCaseFile("golden.json", "nothing", "golden")).toThrow(/golden.json/);
  });

  it("names the file, the case and the field of a mistake", () => {
    expect(() =>
      parseCaseFile("golden.json", [withChange({ language: "klingon" })], "golden"),
    ).toThrow(/golden\.json is not a valid case file[\s\S]*G-test-01 language/u);
  });

  it("refuses a field it does not know (a typo would otherwise be ignored)", () => {
    expect(() => parseCaseFile("golden.json", [withChange({ titel: "x" })], "golden")).toThrow(
      CaseFileError,
    );
    expect(() =>
      parseCaseFile(
        "golden.json",
        [withChange({ expect: { handling: "answered", fact: [] } })],
        "golden",
      ),
    ).toThrow(CaseFileError);
  });

  it("refuses an id used twice, in a file or across both", () => {
    expect(() => parseCaseFile("golden.json", [valid, valid], "golden")).toThrow(/used twice/u);
    const redTeam = [
      withChange(
        { id: "R-test-01", set: "red_team", scriptKind: "resists", expect: { handling: "safe" } },
        "R-test-01",
      ),
    ];
    expect(() => loadCases({ golden: [valid], redTeam })).not.toThrow();
    expect(() =>
      loadCases({
        golden: [valid, { ...valid, id: "G-test-02" }],
        redTeam: [
          { ...redTeam[0], id: "R-test-01" },
          { ...redTeam[0], id: "R-test-01" },
        ],
      }),
    ).toThrow(/used twice/u);
  });

  it("refuses a case in the wrong file", () => {
    const redTeamCase = withChange(
      { id: "R-test-01", set: "red_team", expect: { handling: "safe" } },
      "R-test-01",
    );
    expect(() => parseCaseFile("golden.json", [redTeamCase], "golden")).toThrow(/holds "golden"/u);
    expect(() => parseCaseFile("golden.json", [withChange({ id: "R-test-01" })], "golden")).toThrow(
      /starts with G-/u,
    );
  });

  it("refuses contradictions in a case", () => {
    const fails = (change: Record<string, unknown>, pattern: RegExp | typeof CaseFileError) =>
      expect(() => parseCaseFile("golden.json", [withChange(change)], "golden")).toThrow(pattern);
    fails({ messages: [{ role: "assistant", text: "hello" }] }, /customer's/u);
    fails({ script: [] }, /needs a script/u);
    fails({ scriptKind: "none" }, /no script/u);
    fails({ scriptKind: "misbehaves" }, /model behaves/u);
    fails({ expect: { handling: "safe" } }, /exactly what must happen/u);
    fails(
      { scriptKind: "none", script: [], expect: { handling: "refused_by_input" } },
      /name the rule/u,
    );
    fails(
      { expect: { handling: "refused_by_input", inputTag: "competitor" } },
      /never calls the model/u,
    );
    fails(
      { expect: { handling: "answered", visible: { mustNotMatch: ["(unclosed"] } } },
      /not a valid pattern/u,
    );
    fails({ script: [{ calls: [] }] }, CaseFileError);
    fails({ category: "poetry" }, CaseFileError);
  });

  it("refuses a tool name that does not exist", () => {
    const [parsed] = parseCaseFile(
      "golden.json",
      [withChange({ script: [{ calls: [{ name: "search_homes", input: {} }] }, { text: "ok" }] })],
      "golden",
    );
    expect(() => checkToolNames(parsed ? [parsed] : [], ["search_properties"])).toThrow(
      /G-test-01 names the tool "search_homes"/u,
    );
    const failing = evalCaseSchema.parse({ ...valid, failingTools: ["get_home"] });
    expect(() => checkToolNames([failing], ["search_properties"])).toThrow(/get_home/u);
  });
});
