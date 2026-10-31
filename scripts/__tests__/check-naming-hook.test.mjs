import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkNaming } from "../../.claude/hooks/check-naming.mjs";
import { repoRoot } from "../lib/core.mjs";

let root;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "findsprop-naming-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true });
  const write = (relative, code) => fs.writeFileSync(path.join(root, relative), code);
  write("src/bad.ts", "export const names = items.map((t) => t.name);\n");
  write("src/shorthand.mjs", "export function run(err, ctx) { return [err, ctx]; }\n");
  write("src/good.ts", "export const names = items.map((item) => item.name);\n");
  write("src/view.tsx", "export function View() { return <p className='a'>x</p>; }\n");
  write("src/notes.md", "t i m\n");
  write("node_modules/pkg/index.mjs", "export const x = 1;\n");
});

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("check-naming hook (R-GEN-11)", () => {
  it("reports a single-letter name with file, line and column", async () => {
    const problems = await checkNaming("src/bad.ts", root);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^src\/bad\.ts:1:\d+ .*'t'/);
  });

  it("reports cryptic shorthand too", async () => {
    const problems = await checkNaming("src/shorthand.mjs", root);
    expect(problems.join("\n")).toContain("'err'");
    expect(problems.join("\n")).toContain("'ctx'");
  });

  it("accepts words, and accepts an absolute path", async () => {
    expect(await checkNaming("src/good.ts", root)).toEqual([]);
    expect(await checkNaming(path.join(root, "src", "good.ts"), root)).toEqual([]);
  });

  it("parses JSX files without complaint when the names are fine", async () => {
    expect(await checkNaming("src/view.tsx", root)).toEqual([]);
  });

  it("ignores other file types, vendored code and paths outside the project", async () => {
    expect(await checkNaming("src/notes.md", root)).toEqual([]);
    expect(await checkNaming("node_modules/pkg/index.mjs", root)).toEqual([]);
    expect(await checkNaming("../elsewhere/file.ts", root)).toEqual([]);
  });
});

describe("check-naming hook as Claude runs it", () => {
  const hook = path.join(repoRoot, ".claude", "hooks", "check-naming.mjs");
  const run = (input) =>
    spawnSync("node", [hook], {
      input: JSON.stringify(input),
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    });

  it("exits 2 and tells Claude what to rename", () => {
    const result = run({
      tool_name: "Write",
      tool_input: { file_path: path.join(root, "src", "bad.ts") },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("R-GEN-11");
    expect(result.stderr).toContain("src/bad.ts");
  });

  it("exits 0 and stays quiet for a clean file", () => {
    const result = run({
      tool_name: "Edit",
      tool_input: { file_path: path.join(root, "src", "good.ts") },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("never blocks on bad input or a missing file", () => {
    expect(run({ tool_input: {} }).status).toBe(0);
    expect(run({ tool_input: { file_path: path.join(root, "src", "missing.ts") } }).status).toBe(0);
    expect(spawnSync("node", [hook], { input: "not json", encoding: "utf8" }).status).toBe(0);
  });
});
