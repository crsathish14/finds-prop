// Claude Code PreToolUse hook for Edit and Write (L-03, docs/engineering/security.md).
// Deny: secrets files, the lockfile by hand, generated folders, and migrations that already
// exist on the base branch. Ask: gate, harness and security-critical files (class C2 paths).
// The pure decide() function is unit tested (scripts/__tests__/guard-edit.test.mjs).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SECRET_FILE = /(^|\/)\.env(\.(?!example$)[\w.-]+)?$/;
const GENERATED = /^(node_modules|\.next|\.git)(\/|$)/;

/** Files whose change alters a gate, the harness, or security-critical behaviour. */
const PROTECTED = [
  /^\.github\//,
  /^\.claude\//,
  /^\.mcp\.json$/,
  /(^|\/)AGENTS\.md$/,
  /^docs\/engineering\//,
  /^eslint\.config\.mjs$/,
  /^lefthook\.yml$/,
  /^commitlint\.config\.mjs$/,
  /^knip\.json$/,
  /^tsconfig\.json$/,
  /^package\.json$/,
  /^scripts\//,
  /^supabase\/config\.toml$/,
  /^next\.config\.ts$/,
  /^src\/proxy\.ts$/,
  /^src\/server\/env\.ts$/,
  /^src\/server\/supabase\/admin\.server\.ts$/,
  /^\.gitleaks\.toml$/,
  /^\.npmrc$/,
  /^(vitest|playwright)(\.integration)?\.config\.m?ts$/,
];

/**
 * Owner decision, 14 Nov 2026: the AI chat tasks (docs/ai-chat-phase-plan.md) change these
 * otherwise protected files without a prompt: the environment schema (P1-T01), the rule pages for
 * security, backend and frontend, and their own `scripts/ai-*` folders. Gate files (CI, hooks,
 * lint, test and TypeScript config, AGENTS.md, package.json) stay protected.
 */
const AI_CHAT_ALLOWED = [
  /^src\/server\/env\.ts$/,
  /^docs\/engineering\/(security|backend|frontend)\.md$/,
  /^scripts\/ai-[\w-]+\//,
];

const deny = (reason) => ({ decision: "deny", reason });
const ask = (reason) => ({ decision: "ask", reason });
const none = { decision: "none", reason: "" };

export function toRelative(filePath, root) {
  const normal = String(filePath ?? "").replace(/\\/g, "/");
  const normalRoot = String(root ?? "")
    .replace(/\\/g, "/")
    .replace(/\/$/, "");
  const lowerPath = normal.toLowerCase();
  const lowerRoot = normalRoot.toLowerCase();
  if (normalRoot && lowerPath.startsWith(`${lowerRoot}/`))
    return normal.slice(normalRoot.length + 1);
  return normal.replace(/^\.\//, "");
}

/**
 * @param {string} filePath  path from the tool call (absolute or relative)
 * @param {{ root?: string, existsOnBase?: (rel: string) => boolean|null }} context
 *   existsOnBase returns true/false, or null when the base branch cannot be consulted.
 */
export function decide(filePath, context = {}) {
  const rel = toRelative(filePath, context.root);
  if (!rel) return none;
  if (SECRET_FILE.test(rel))
    return deny(
      "Env files hold secrets and are off limits (R-AI-08). Change .env.example for names, and ask the owner for values.",
    );
  if (rel === "package-lock.json")
    return deny("Edit package.json and let npm update package-lock.json (R-DEP-03).");
  if (GENERATED.test(rel)) return deny("Generated or tool-owned folder; do not edit it by hand.");
  if (/^supabase\/migrations\/[^/]+\.sql$/.test(rel)) {
    const existing = context.existsOnBase ? context.existsOnBase(rel) : null;
    if (existing === true)
      return deny(
        "This migration already exists on the base branch. Migrations are forward-only: add a new migration instead (R-DB-02).",
      );
    if (existing === null)
      return ask(
        "Could not check whether this migration is already on the base branch. Confirm it is new (R-DB-02).",
      );
    return none;
  }
  if (AI_CHAT_ALLOWED.some((re) => re.test(rel))) return none;
  if (PROTECTED.some((re) => re.test(rel)))
    return ask(
      `${rel} is a protected path (gates, harness or security-critical code). This is a class C2 change and needs a "Gate-change:" line in the PR.`,
    );
  return none;
}

function existsOnBase(cwd, rel) {
  for (const ref of ["origin/develop", "develop"]) {
    try {
      execFileSync("git", ["cat-file", "-e", `${ref}:${rel}`], { cwd, stdio: "ignore" });
      return true;
    } catch {
      try {
        execFileSync("git", ["rev-parse", "--verify", "--quiet", ref], { cwd, stdio: "ignore" });
        return false; // the ref exists and the file is not on it
      } catch {
        // try the next ref
      }
    }
  }
  return null;
}

function main() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      process.stderr.write("guard-edit: could not read the hook input; blocking to stay safe.\n");
      process.exit(2);
    }
    const cwd = input?.cwd ?? process.cwd();
    const root = process.env.CLAUDE_PROJECT_DIR ?? cwd;
    const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
    const { decision, reason } = decide(filePath, {
      root,
      existsOnBase: (rel) => existsOnBase(root, rel),
    });
    if (decision === "deny") {
      process.stderr.write(`Blocked by guard-edit: ${reason}\n`);
      process.exit(2);
    }
    if (decision === "ask") {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "ask",
            permissionDecisionReason: reason,
          },
        }),
      );
    }
    process.exit(0);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
