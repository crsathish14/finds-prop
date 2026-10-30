// G-14 Hygiene: escape hatches, banned files and strings, TODO without an issue, expired waivers.
// Usage: node scripts/check-hygiene.mjs [--staged]
import fs from "node:fs";
import path from "node:path";
import {
  finding,
  globToRegExp,
  isMain,
  isTextFile,
  lineOf,
  listFiles,
  loadAllowlist,
  matchesAny,
  printFindings,
  readJson,
  readText,
  repoRoot,
} from "./lib/core.mjs";

const CODE_FOR_TODO = /\.(ts|tsx|mjs|js|css|sql|ya?ml)$/;
const TODO_DIRS = ["src/", "e2e/", "tests/", "supabase/", "scripts/", ".github/", ".claude/hooks/"];
const TODO_SKIP = ["scripts/check-hygiene.mjs", "scripts/__tests__/**", "scripts/policy/**"];
const TEST_FILE = /(\.test\.|\.spec\.|^e2e\/|\/__tests__\/)/;

// eslint-disable comments must name the rule and give a reason after " -- ".
const ESLINT_DISABLE = /eslint-disable(?:-next-line|-line)?([^\n*]*)/g;
const TS_COMMENT = /@ts-(ignore|nocheck|expect-error)([^\n]*)/g;
const TODO = /\b(TODO|FIXME|HACK|XXX)\b(?!\(#\d+\))/g;
const FOCUSED =
  /\b(?:it|test|describe|suite)\.(?:only|skip|todo)\s*\(|\b(?:xit|xdescribe|fit|fdescribe)\s*\(/g;

const BANNED_FILES = [
  {
    glob: "{,src/}middleware.{ts,js}",
    message: "middleware.ts is replaced by proxy.ts in Next.js 16 (R-FE-05)",
  },
  {
    glob: "{bun.lock,bun.lockb,bunfig.toml,pnpm-lock.yaml,yarn.lock,pnpm-workspace.yaml}",
    message: "npm is the only package manager (R-GEN-01)",
  },
  { glob: ".storybook/**", message: "The Design Lab replaces Storybook (ADR-020)" },
  {
    glob: "CLAUDE.local.md",
    message:
      "CLAUDE.local.md stops Claude Code reading AGENTS.md; use ~/.claude/CLAUDE.md for personal preferences",
  },
  { glob: ".env", message: "Environment files are never committed" },
  {
    glob: ".env.{local,development,production,test}{,.local}",
    message: "Environment files are never committed",
  },
];

export function checkHygiene({
  root = repoRoot,
  files = listFiles(root),
  today = new Date(),
} = {}) {
  const findings = [];
  const allow = loadAllowlist(root, today);
  findings.push(...allow.problems);
  const bannedStrings = readJson(root, "scripts/policy/banned-strings.json", []);
  const add = (file, line, rule, message) => {
    if (!allow.isAllowed(file, rule)) findings.push(finding(file, line, rule, message));
  };

  for (const file of files) {
    for (const banned of BANNED_FILES) {
      if (globToRegExp(banned.glob).test(file)) add(file, 0, "HYG-BANNED-FILE", banned.message);
    }
    if (file === "CLAUDE.md") {
      const content = fs.readFileSync(path.join(root, file), "utf8").trim();
      if (content !== "@AGENTS.md")
        add(
          file,
          0,
          "HYG-BANNED-FILE",
          "CLAUDE.md may only contain the single line @AGENTS.md (AGENTS.md is the one instruction source)",
        );
    }
    if (!isTextFile(file)) continue;
    const text = readText(root, file);
    if (text === null) continue;

    // banned strings, path scoped
    for (const rule of bannedStrings) {
      if (rule.include && !matchesAny(file, rule.include)) continue;
      if (rule.exclude && matchesAny(file, rule.exclude)) continue;
      const re = new RegExp(rule.pattern, "g");
      for (const match of text.matchAll(re))
        add(file, lineOf(text, match.index), `HYG-${rule.id}`, rule.message);
    }

    const isCode = /\.(ts|tsx|mjs|js|mts|cjs)$/.test(file);
    const isScanned = !matchesAny(file, TODO_SKIP);
    if (isCode && isScanned) {
      for (const match of text.matchAll(ESLINT_DISABLE)) {
        const tail = match[1] ?? "";
        const parts = tail.split(/\s--\s/);
        const rules = (parts[0] ?? "").trim();
        const reason = (parts[1] ?? "").replace(/\*\/\s*$/, "").trim();
        const line = lineOf(text, match.index);
        if (!rules)
          add(
            file,
            line,
            "HYG-ESLINT-DISABLE",
            "name the rule you disable; blanket eslint-disable is not allowed",
          );
        else if (reason.length < 10)
          add(
            file,
            line,
            "HYG-ESLINT-DISABLE",
            "add a reason of at least 10 characters after ' -- '",
          );
      }
      for (const match of text.matchAll(TS_COMMENT)) {
        const line = lineOf(text, match.index);
        if (match[1] === "ignore" || match[1] === "nocheck")
          add(file, line, "HYG-TS-COMMENT", `@ts-${match[1]} is banned (R-GEN-02)`);
        else if ((match[2] ?? "").replace(/\*\/\s*$/, "").trim().length < 10)
          add(
            file,
            line,
            "HYG-TS-COMMENT",
            "@ts-expect-error needs a description of at least 10 characters (R-GEN-02)",
          );
      }
      if (TEST_FILE.test(file)) {
        for (const match of text.matchAll(FOCUSED))
          add(
            file,
            lineOf(text, match.index),
            "HYG-TEST-FOCUS",
            "focused, skipped or todo test (R-TEST-02)",
          );
      }
    }
    if (isScanned && CODE_FOR_TODO.test(file) && TODO_DIRS.some((dir) => file.startsWith(dir))) {
      for (const match of text.matchAll(TODO))
        add(
          file,
          lineOf(text, match.index),
          "HYG-TODO",
          `${match[1]} needs an issue number, for example ${match[1]}(#123) (plan 13)`,
        );
    }
  }
  return findings;
}

if (isMain(import.meta.url)) {
  const staged = process.argv.includes("--staged");
  const files = listFiles(repoRoot, { staged });
  process.exit(printFindings("check-hygiene", checkHygiene({ files })));
}
