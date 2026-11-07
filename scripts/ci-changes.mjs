// Decides which of the three expensive CI jobs (db, integration, build) a change needs, so the others
// are skipped and cost no minutes. Run by the `changes` job in .github/workflows/ci.yml.
//
//   node scripts/ci-changes.mjs
//
// It reads the event from the environment GitHub sets (GITHUB_EVENT_NAME, GITHUB_BASE_REF,
// GITHUB_REF_NAME, GITHUB_SHA) and, for a push, the commit before it from CI_BEFORE_SHA. The changed
// files come from git. It prints what it decided and why, and writes `db=true|false`,
// `integration=true|false` and `build=true|false` to the file named by GITHUB_OUTPUT.
//
// Fail-safe: anything it cannot work out (no base, a commit that is gone, a git error) runs every job.
// So does a change to the workflow or the package list, and anything aimed at `main` (docs/engineering/
// quality-gates.md, section 7). The path lists live in scripts/lib/ci-paths.mjs, shared with the local
// runner. It reads only the file names, never their content, and prints no secret.
import fs from "node:fs";
import { CI_JOB_IDS, selectCiJobs } from "./lib/ci-paths.mjs";
import { git, isMain, repoRoot } from "./lib/core.mjs";

const NO_COMMIT = /^0+$/;

/** The reason every job must run regardless of the files, or undefined. */
export function everythingReason(environment) {
  const event = environment.GITHUB_EVENT_NAME;
  if (event === "pull_request" && environment.GITHUB_BASE_REF === "main") {
    return "the change is aimed at main";
  }
  if (event === "push" && environment.GITHUB_REF_NAME === "main") return "this is a push to main";
  if (event !== "pull_request" && event !== "push") return `the event is ${event ?? "unknown"}`;
  return undefined;
}

/** The two revisions to compare, or null when there is nothing safe to compare. */
export function revisionsToCompare(environment) {
  const head = environment.GITHUB_SHA;
  if (!head) return null;
  if (environment.GITHUB_EVENT_NAME === "pull_request") {
    const base = environment.GITHUB_BASE_REF;
    // Three dots: the changes on this side since it left the base, not what the base gained since.
    return base ? { range: `origin/${base}...${head}` } : null;
  }
  const before = environment.CI_BEFORE_SHA;
  if (!before || NO_COMMIT.test(before)) return null;
  return { range: `${before}..${head}` };
}

/** The changed files (repo-relative, forward slashes), or null when git cannot say. */
export function changedFiles(root, environment) {
  const revisions = revisionsToCompare(environment);
  if (!revisions) return null;
  const output = git(root, ["diff", "--name-only", "--no-renames", revisions.range], {
    allowFail: true,
  });
  if (output === null) return null;
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function decide(environment, files) {
  return selectCiJobs(files, { everything: everythingReason(environment) });
}

export function formatDecision(decision, files) {
  const lines = [`changed files: ${files === null ? "unknown" : files.length}`];
  for (const id of CI_JOB_IDS) {
    lines.push(`${id}: ${decision[id].run ? "run" : "skip"} (${decision[id].why})`);
  }
  return lines.join("\n");
}

export function outputLines(decision) {
  return CI_JOB_IDS.map((id) => `${id}=${decision[id].run}`);
}

if (isMain(import.meta.url)) {
  let files = null;
  try {
    files = changedFiles(repoRoot, process.env);
  } catch {
    files = null;
  }
  const decision = decide(process.env, files);
  console.log(formatDecision(decision, files));
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${outputLines(decision).join("\n")}\n`);
  } else {
    console.log(outputLines(decision).join("\n"));
  }
}
