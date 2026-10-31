import { afterAll, describe, expect, it } from "vitest";
import { checkHarness } from "../check-harness.mjs";
import { cleanupTrees, makeTree, rules } from "./helpers.mjs";

afterAll(cleanupTrees);

const BLOCK = "<!-- BEGIN:nextjs-agent-rules -->\ngenerated\n<!-- END:nextjs-agent-rules -->\n";
const PKG = JSON.stringify({ scripts: { check: "x", "check:db": "x", doctor: "x" } });
const GOOD = {
  "package.json": PKG,
  "AGENTS.md": `# Find Prop\n${BLOCK}\nRun \`npm run check\`. Read \`docs/engineering/frontend.md\`. Rule R-FE-01 and gate G-02 apply.\n`,
  "docs/engineering/frontend.md": "| R-FE-01 | rule | G-02 | src |\n",
  "docs/engineering/quality-gates.md": "| G-02 | Lint | x |\n",
};

const run = (files, base = GOOD) => {
  const tree = { ...base, ...files };
  const root = makeTree(tree, { withPolicy: false });
  return checkHarness({ root, files: Object.keys(tree) });
};

describe("G-16 check-harness", () => {
  it("passes a consistent harness", () => {
    expect(run({})).toEqual([]);
  });

  it("fails when AGENTS.md is over 150 lines, not counting the Next.js block", () => {
    const long = `# x\n${BLOCK}${"line\n".repeat(160)}`;
    expect(rules(run({ "AGENTS.md": long }))).toContain("H-SIZE");
    const withBigBlock = `# x\n<!-- BEGIN:nextjs-agent-rules -->\n${"gen\n".repeat(200)}<!-- END:nextjs-agent-rules -->\nshort\n`;
    expect(run({ "AGENTS.md": withBigBlock })).toEqual([]);
  });

  it("fails when a nested AGENTS.md is over 40 lines", () => {
    expect(rules(run({ "src/features/AGENTS.md": "line\n".repeat(45) }))).toContain("H-SIZE");
  });

  it("fails when the Next.js markers are damaged", () => {
    expect(
      rules(run({ "AGENTS.md": "# x\n<!-- BEGIN:nextjs-agent-rules -->\nno end\n" })),
    ).toContain("H-MARKERS");
  });

  it("fails when an instruction file names a path that does not exist", () => {
    expect(rules(run({ "AGENTS.md": `# x\nRead \`docs/engineering/missing.md\`.\n` }))).toContain(
      "H-PATH",
    );
  });

  it("ignores runtime-only paths, globs and placeholders", () => {
    expect(
      run({
        "AGENTS.md":
          "# x\nUse `.next/dev/lock`, `node_modules/next/dist/docs/`, `.env.local`, `src/**/x.ts`, `<name>.md`.\n",
      }),
    ).toEqual([]);
  });

  it("fails when an npm script is mentioned but missing", () => {
    expect(rules(run({ "AGENTS.md": "# x\nRun `npm run nonexistent`.\n" }))).toContain("H-SCRIPT");
  });

  it("fails when a rule or gate ID is cited but not defined, and when a rule has two homes", () => {
    expect(rules(run({ "AGENTS.md": "# x\nSee R-FE-99.\n" }))).toContain("H-RULE-REF");
    expect(rules(run({ "AGENTS.md": "# x\nSee G-99.\n" }))).toContain("H-GATE-REF");
    expect(
      rules(run({ "docs/engineering/backend.md": "| R-FE-01 | again | G-02 | src |\n" })),
    ).toContain("H-RULE-DUP");
  });

  it("fails when AGENTS.md is missing", () => {
    const root = makeTree({ "package.json": PKG }, { withPolicy: false });
    expect(rules(checkHarness({ root, files: ["package.json"] }))).toContain("H-MISSING");
  });
});

describe("G-16 check-harness: skills, ADRs, adapter", () => {
  const skill = (name, extra = "disable-model-invocation: true\n") =>
    `---\nname: ${name}\ndescription: Does a thing\n${extra}---\nBody\n`;

  it("accepts a user-invoked skill and rejects one that models may trigger", () => {
    expect(run({ ".claude/skills/new-slice/SKILL.md": skill("new-slice") })).toEqual([]);
    expect(rules(run({ ".claude/skills/new-slice/SKILL.md": skill("new-slice", "") }))).toContain(
      "H-SKILL",
    );
    expect(rules(run({ ".claude/skills/new-slice/SKILL.md": skill("other") }))).toContain(
      "H-SKILL",
    );
  });

  it("enforces ADR names, numbers and status", () => {
    const adr = (status) => `# ADR-001\n\n- Status: ${status}\n`;
    expect(run({ "docs/adr/001-one-app.md": adr("Accepted") })).toEqual([]);
    expect(rules(run({ "docs/adr/001-one-app.md": adr("Maybe") }))).toContain("H-ADR");
    expect(rules(run({ "docs/adr/one-app.md": adr("Accepted") }))).toContain("H-ADR");
    expect(
      rules(run({ "docs/adr/001-a.md": adr("Accepted"), "docs/adr/001-b.md": adr("Accepted") })),
    ).toContain("H-ADR");
  });

  it("validates settings.json, hook scripts and their tests", () => {
    expect(rules(run({ ".claude/settings.json": "{ not json" }))).toContain("H-SETTINGS");
    const settings = JSON.stringify({
      hooks: {
        PreToolUse: [
          { hooks: [{ command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-bash.mjs"' }] },
        ],
      },
    });
    expect(rules(run({ ".claude/settings.json": settings }))).toContain("H-HOOK");
    expect(
      rules(run({ ".claude/settings.json": settings, ".claude/hooks/guard-bash.mjs": "x" })),
    ).toContain("H-HOOK");
    expect(
      run({
        ".claude/settings.json": settings,
        ".claude/hooks/guard-bash.mjs": "x",
        "scripts/__tests__/guard-bash.test.mjs": "x",
      }),
    ).toEqual([]);
  });

  it("rejects an unpinned MCP server and a CLAUDE.md with its own rules", () => {
    expect(
      rules(
        run({ ".mcp.json": '{"mcpServers":{"n":{"args":["-y","next-devtools-mcp@latest"]}}}' }),
      ),
    ).toContain("H-MCP");
    expect(
      run({ ".mcp.json": '{"mcpServers":{"n":{"args":["-y","next-devtools-mcp@1.2.3"]}}}' }),
    ).toEqual([]);
    expect(rules(run({ "CLAUDE.md": "# my rules\n" }))).toContain("H-CLAUDE");
    expect(run({ "CLAUDE.md": "@AGENTS.md\n" })).toEqual([]);
  });

  it("rejects a lefthook command that points at a missing script", () => {
    expect(
      rules(
        run({
          "lefthook.yml": "pre-commit:\n  commands:\n    x:\n      run: node scripts/missing.mjs\n",
        }),
      ),
    ).toContain("H-LEFTHOOK");
  });
});
