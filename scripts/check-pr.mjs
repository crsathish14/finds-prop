// G-17 Pull request checks, run in CI on pull_request events.
//  - conventional title (it becomes the squash commit message)
//  - the PR template headings are present and filled in
//  - exactly one change class is ticked; verification is ticked or "Not run, and why" is given
//  - `Gate-change:` is present, and is not "none" when gate or harness files changed
//  - `New dependency:` is not "none" when dependencies were added
//  - a PR into main comes from develop
// PR text is untrusted: it is read as data from the event file and never passed to a shell.
import fs from "node:fs";
import { finding, git, globToRegExp, isMain, printFindings, repoRoot } from "./lib/core.mjs";
import { checkDeps } from "./check-deps.mjs";

const TITLE =
  /^(feat|fix|chore|docs|test|refactor|perf|build|ci|revert|style)(\([a-z0-9-]+\))?!?: \S.{2,}$/;

const REQUIRED_HEADINGS = [
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

/** Files whose change can weaken a gate or alter how every future session behaves. */
export const GATE_FILES = [
  ".github/**",
  ".claude/**",
  ".mcp.json",
  "AGENTS.md",
  "**/AGENTS.md",
  "docs/engineering/**",
  "eslint.config.mjs",
  "lefthook.yml",
  "commitlint.config.mjs",
  "knip.json",
  "tsconfig.json",
  "vitest.config.mts",
  "vitest.integration.config.ts",
  "playwright.config.mts",
  "scripts/**",
  ".gitleaks.toml",
  ".npmrc",
  ".prettierrc.json",
  "supabase/config.toml",
];

export function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

export function section(body, heading) {
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "im");
  const match = re.exec(body);
  if (!match) return null;
  const rest = body.slice(match.index + match[0].length);
  const next = /^##\s+/m.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

export function checkPr({
  title,
  body,
  baseRef,
  headRef,
  changedFiles = [],
  actor = "",
  addedDependencies = [],
}) {
  const findings = [];
  const add = (rule, message) => findings.push(finding("pull request", 0, rule, message));

  if (!TITLE.test(title ?? ""))
    add(
      "PR-TITLE",
      `title "${title ?? ""}" must be a conventional commit, for example "feat(search): add radius filter"`,
    );
  if (baseRef === "main" && headRef !== "develop")
    add(
      "PR-BRANCH",
      `a pull request into main must come from develop (this one comes from ${headRef})`,
    );

  if (actor.endsWith("[bot]")) return findings;

  const text = stripComments(body ?? "");
  for (const heading of REQUIRED_HEADINGS) {
    if (section(text, heading) === null)
      add("PR-TEMPLATE", `missing section "## ${heading}" from the pull request template`);
  }

  const classes = ["C0", "C1", "C2"].filter((changeClass) =>
    new RegExp(`\\[x\\]\\s*${changeClass}\\b`, "i").test(section(text, "Change class") ?? ""),
  );
  if (classes.length !== 1)
    add("PR-CLASS", `tick exactly one change class (C0, C1 or C2); found ${classes.length}`);

  const verification = section(text, "Verification") ?? "";
  const ticked = /\[x\]\s*npm run/i.test(verification);
  const notRun = /Not run, and why:\s*(\S.{9,})/i.test(verification);
  if (!ticked && !notRun)
    add(
      "PR-VERIFY",
      'tick the commands you ran, or explain under "Not run, and why:" (at least 10 characters)',
    );

  const gate = /^Gate-change:\s*(.*)$/im.exec(section(text, "Gate-change") ?? "");
  const gateFiles = changedFiles.filter((file) =>
    GATE_FILES.some((pattern) => globToRegExp(pattern).test(file)),
  );
  if (!gate || !gate[1]?.trim())
    add(
      "PR-GATE",
      'add a line "Gate-change: none" or "Gate-change: <what changed and why no check is weakened>"',
    );
  else if (gateFiles.length > 0 && /^none\b/i.test(gate[1].trim())) {
    add(
      "PR-GATE",
      `gate or harness files changed (${gateFiles.slice(0, 5).join(", ")}${gateFiles.length > 5 ? ", ..." : ""}) so Gate-change cannot be "none"`,
    );
  }

  if (addedDependencies.length > 0) {
    const deps = section(text, "Dependencies") ?? "";
    const match = /New dependency:\s*(.*)/i.exec(deps);
    if (!match || /^none\b/i.test(match[1]?.trim() ?? "none")) {
      add(
        "PR-DEPENDENCY",
        `dependencies were added (${addedDependencies.join(", ")}) but "New dependency:" says none; give need, size, maintenance, licence and alternatives (R-DEP-01)`,
      );
    }
  }
  return findings;
}

if (isMain(import.meta.url)) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    console.log("check-pr: not a pull_request event; nothing to check");
    process.exit(0);
  }
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const pr = event.pull_request;
  if (!pr) {
    console.log("check-pr: not a pull_request event; nothing to check");
    process.exit(0);
  }
  const baseRef = pr.base?.ref ?? "";
  const changedFiles = (
    git(repoRoot, ["diff", "--name-only", `origin/${baseRef}...HEAD`], { allowFail: true }) ?? ""
  )
    .split("\n")
    .filter(Boolean);
  const baseManifestText = git(repoRoot, ["show", `origin/${baseRef}:package.json`], {
    allowFail: true,
  });
  const { diff } = checkDeps({
    baseManifest: baseManifestText ? JSON.parse(baseManifestText) : null,
  });
  const addedDependencies = diff ? diff.added.map((addedPackage) => addedPackage.name) : [];
  const findings = checkPr({
    title: pr.title,
    body: pr.body,
    baseRef,
    headRef: pr.head?.ref ?? "",
    changedFiles,
    actor: pr.user?.login ? `${pr.user.login}${pr.user.type === "Bot" ? "[bot]" : ""}` : "",
    addedDependencies,
  });
  process.exit(printFindings("check-pr", findings));
}
