import { describe, expect, it } from "vitest";
import { checkPr, section, stripComments } from "../check-pr.mjs";

const HEADINGS = [
  "What and why",
  "Traceability",
  "Change class",
  "Verification",
  "Security checklist",
  "Design system",
  "Dependencies",
  "Migrations",
  "Docs",
  "AI assistance",
  "Gate-change",
];

function body({
  cls = "C1",
  verification = "- [x] npm run check",
  gate = "Gate-change: none",
  deps = "New dependency: none",
  omit = [],
} = {}) {
  const parts = {
    "What and why": "Adds the radius filter.",
    Traceability: "- Requirements (FR and BR IDs): FR-PUB-06",
    "Change class": `- [ ] C0   - [${cls === "C1" ? "x" : " "}] C1   - [${cls === "C2" ? "x" : " "}] C2`,
    Verification: `${verification}\nNot run, and why:`,
    "Security checklist": "- [ ] Not applicable (no server code)",
    "Design system": "- [x] Not applicable",
    Dependencies: deps,
    Migrations: "- [x] Not applicable",
    Docs: "- [x] Not applicable",
    "AI assistance": "- [x] No",
    "Gate-change": `${gate}\n<!-- If you changed lint, CI, hooks: write Gate-change: <what and why> -->`,
  };
  return HEADINGS.filter((heading) => !omit.includes(heading))
    .map((heading) => `## ${heading}\n${parts[heading]}`)
    .join("\n\n");
}

const ok = {
  title: "feat(search): add radius filter",
  baseRef: "develop",
  headRef: "feat/radius",
  changedFiles: ["src/features/search/queries.ts"],
  actor: "crsathish14",
};
const run = (overrides = {}) =>
  checkPr({ ...ok, body: body(), ...overrides }).map((finding) => finding.rule);

describe("G-17 check-pr", () => {
  it("passes a complete pull request", () => {
    expect(run()).toEqual([]);
  });

  it("requires a conventional title", () => {
    expect(run({ title: "Added a filter" })).toContain("PR-TITLE");
    expect(run({ title: "feat: x" })).toContain("PR-TITLE");
    expect(run({ title: "fix(db)!: drop legacy column" })).toEqual([]);
    expect(run({ title: "chore(deps): bump zod from 4.6.6 to 4.6.7" })).toEqual([]);
  });

  it("requires every template heading", () => {
    for (const heading of HEADINGS)
      expect(run({ body: body({ omit: [heading] }) }), heading).toContain("PR-TEMPLATE");
  });

  it("requires exactly one change class", () => {
    expect(run({ body: body({ cls: "C2" }) })).toEqual([]);
    const none = body().replace("[x] C1", "[ ] C1");
    expect(run({ body: none })).toContain("PR-CLASS");
    const two = body().replace("[ ] C0", "[x] C0");
    expect(run({ body: two })).toContain("PR-CLASS");
  });

  it("requires verification or an explanation", () => {
    expect(run({ body: body({ verification: "- [ ] npm run check" }) })).toContain("PR-VERIFY");
    expect(
      run({
        body: body({ verification: "- [ ] npm run check" }).replace(
          "Not run, and why:",
          "Not run, and why: Docker is not installed on this machine",
        ),
      }),
    ).toEqual([]);
  });

  it("requires a Gate-change line, and not 'none' when gate files changed", () => {
    expect(run({ body: body({ gate: "" }) })).toContain("PR-GATE");
    expect(run({ changedFiles: ["eslint.config.mjs"] })).toContain("PR-GATE");
    expect(run({ changedFiles: ["src/server/AGENTS.md"] })).toContain("PR-GATE");
    expect(run({ changedFiles: [".claude/settings.json"] })).toContain("PR-GATE");
    expect(
      run({
        changedFiles: ["scripts/check-env.mjs"],
        body: body({ gate: "Gate-change: tightens the env check; no check is weakened" }),
      }),
    ).toEqual([]);
  });

  it("does not count the template's own comment as a Gate-change answer", () => {
    expect(run({ body: body({ gate: "" }) })).toContain("PR-GATE");
  });

  it("requires a dependency note when dependencies were added", () => {
    expect(run({ addedDependencies: ["lodash"] })).toContain("PR-DEPENDENCY");
    expect(
      run({
        addedDependencies: ["lodash"],
        body: body({
          deps: "New dependency: lodash. Need: debounce. Size 70KB. MIT. Alternative: native",
        }),
      }),
    ).toEqual([]);
  });

  it("requires pull requests into main to come from develop", () => {
    expect(run({ baseRef: "main", headRef: "feat/x" })).toContain("PR-BRANCH");
    expect(run({ baseRef: "main", headRef: "develop" })).toEqual([]);
  });

  it("skips body checks for bots but still checks the title", () => {
    expect(run({ actor: "dependabot[bot]", body: "", title: "chore(deps): bump x" })).toEqual([]);
    expect(run({ actor: "dependabot[bot]", body: "", title: "Bump x" })).toEqual(["PR-TITLE"]);
  });

  it("strips HTML comments and reads sections", () => {
    expect(stripComments("a<!-- hidden -->b")).toBe("ab");
    expect(section("## A\none\n\n## B\ntwo", "A")).toBe("one");
    expect(section("## A\none", "Z")).toBeNull();
  });
});
