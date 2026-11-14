// Claude Code PreToolUse hook for Bash commands (L-03, docs/engineering/security.md).
// Reads the hook JSON on stdin. Exit 2 with a reason on stderr blocks the command and tells the
// agent why. A JSON "ask" decision escalates to the human. Anything else: no opinion.
// The pure decide() function is unit tested (scripts/__tests__/guard-bash.test.mjs).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROTECTED_BRANCHES = new Set(["main", "develop"]);
const SAFE_TO_DELETE = new Set([
  "node_modules",
  ".next",
  "coverage",
  "dist",
  "build",
  "out",
  ".turbo",
  "test-results",
  "playwright-report",
  "blob-report",
]);
const LOCAL_TOOLS = new Set([
  "eslint",
  "prettier",
  "vitest",
  "playwright",
  "tsc",
  "next",
  "commitlint",
  "knip",
  "lefthook",
  "jscpd",
  "squawk",
  "supabase",
]);
const SHELL_TARGETS = "sh|bash|zsh|iex|Invoke-Expression|python\\d?|node";
const DOWNLOAD_TO_SHELL = new RegExp(
  `\\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\\b[^|\\n]*\\|\\s*(${SHELL_TARGETS})\\b`,
  "i",
);
const SECRET_ENV_FILE = /(^|[\\/\s"'=:])\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s"'])/i;
const SECRET_VARIABLE =
  /\$\{?env:?\w*(KEY|SECRET|TOKEN|PASSWORD)\w*|\$\{?\w*(KEY|SECRET|TOKEN|PASSWORD)\w*\}?/i;

const deny = (reason) => ({ decision: "deny", reason });
const ask = (reason) => ({ decision: "ask", reason });
const none = { decision: "none", reason: "" };

export function splitSegments(command) {
  return command
    .split(/&&|\|\||;|\||\r?\n/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function words(segment) {
  let tokens = segment.split(/\s+/).filter(Boolean);
  // drop leading VAR=value assignments and sudo-like wrappers
  while (tokens[0] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens = tokens.slice(1);
  if (tokens[0] === "sudo") tokens = tokens.slice(1);
  return tokens;
}

/** `npx -y pkg args`, `npm exec -- pkg args` -> { wrapper, tokens } with tokens starting at pkg. */
export function unwrap(tokens) {
  const first = (tokens[0] ?? "").toLowerCase().replace(/\.(cmd|exe)$/, "");
  if (first === "npx" || first === "pnpx" || first === "bunx") {
    const flags = [];
    let index = 1;
    while (tokens[index]?.startsWith("-")) flags.push(tokens[index++]);
    return {
      wrapper: first,
      noInstall: flags.includes("--no-install") || flags.includes("--offline"),
      tokens: tokens.slice(index),
    };
  }
  if (first === "npm" && tokens[1] === "exec") {
    let index = 2;
    while (tokens[index]?.startsWith("-")) index++;
    return { wrapper: "npm exec", noInstall: false, tokens: tokens.slice(index) };
  }
  return { wrapper: null, noInstall: false, tokens };
}

function commandName(token = "") {
  return path
    .basename(token.replace(/\\/g, "/"))
    .toLowerCase()
    .replace(/\.(cmd|exe|ps1)$/, "");
}

function gitSubcommand(tokens) {
  let index = 1;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === "-C" || token === "-c" || token === "--git-dir" || token === "--work-tree")
      index += 2;
    else if (token.startsWith("-")) index += 1;
    else break;
  }
  return { sub: tokens[index] ?? "", rest: tokens.slice(index + 1) };
}

function evaluateGit(tokens, branch) {
  const { sub, rest } = gitSubcommand(tokens);
  const all = tokens.join(" ");
  if (/\s--no-verify\b/.test(` ${all}`) || (sub === "commit" && rest.includes("-n")))
    return deny("--no-verify skips the hooks and gates (R-AI-04). Fix the failure instead.");
  const onProtected = PROTECTED_BRANCHES.has(branch ?? "");
  if (sub === "push") {
    const force = rest.some(
      (token) =>
        token === "--force" ||
        token === "-f" ||
        token.startsWith("--force-with-lease") ||
        token === "--mirror" ||
        token === "--delete" ||
        /^\+\S/.test(token),
    );
    if (force)
      return deny(
        "Force-pushing, deleting remote branches and mirror pushes are not allowed (R-GIT-01).",
      );
    const targets = rest.filter((token) => !token.startsWith("-")).slice(1); // after the remote name
    const toProtected =
      targets.some((token) => /(^|[:/])(main|develop)$/.test(token)) ||
      (rest.filter((token) => !token.startsWith("-")).length <= 1 && onProtected);
    if (toProtected)
      return deny(
        "Do not push to main or develop; push a feature branch and open a pull request (R-GIT-01).",
      );
    // A feature-branch push is allowed (owner decision, 12 Nov 2026): force, delete and main or
    // develop were refused above, and merging stays a human step on GitHub.
    return none;
  }
  if (["commit", "merge", "rebase", "cherry-pick", "revert", "am"].includes(sub) && onProtected) {
    return deny(
      `You are on ${branch}. Create a feat/, fix/, chore/ or docs/ branch first; never commit to develop or main (R-GIT-01).`,
    );
  }
  if (sub === "reset" && rest.includes("--hard"))
    return onProtected
      ? deny(`git reset --hard on ${branch} is not allowed.`)
      : ask("git reset --hard discards uncommitted work. Confirm.");
  if (sub === "clean" && rest.some((token) => /^-\w*f/.test(token) || token === "--force"))
    return deny("git clean -f deletes untracked files and cannot be undone.");
  return none;
}

function evaluateSupabase(tokens) {
  const args = tokens.slice(1);
  const joined = args.join(" ");
  if (
    args.some(
      (token) =>
        token === "--linked" ||
        token === "--db-url" ||
        token.startsWith("--db-url=") ||
        token === "--project-ref" ||
        token.startsWith("--project-ref=") ||
        token === "--project-id" ||
        token.startsWith("--project-id="),
    )
  ) {
    return deny(
      "Commands against a linked project or a database URL touch a shared environment. CI applies migrations; agents never do (R-DB-01).",
    );
  }
  const sub = args.find((token) => !token.startsWith("-")) ?? "";
  if (
    [
      "link",
      "login",
      "logout",
      "projects",
      "orgs",
      "secrets",
      "branches",
      "domains",
      "vanity-subdomains",
      "ssl-enforcement",
      "network-bans",
      "network-restrictions",
      "postgres-config",
      "sso",
      "snippets",
    ].includes(sub)
  ) {
    return deny(
      `supabase ${sub} acts on an account or a shared project and is not allowed (R-DB-01).`,
    );
  }
  if (sub === "functions" && /\b(deploy|delete)\b/.test(joined))
    return deny("Deploying functions is a CI action.");
  if (sub === "db" && /\b(push|pull|remote|dump)\b/.test(joined))
    return deny(
      "supabase db push, pull, remote and dump are not allowed from an agent session (R-DB-01).",
    );
  if (sub === "gen" && !args.includes("--local"))
    return deny(
      "Generate types against the local stack only: supabase gen types typescript --local.",
    );
  return none;
}

/**
 * Owner decision, 14 Nov 2026: the AI chat pull requests may be merged by the agent once CI is
 * green. Everything else about merging stays refused. The allowance is narrow on purpose: one
 * numbered pull request, one strategy flag, base `develop`, an AI chat branch, open and not a
 * draft, no merge conflict, the `all-checks-passed` check green, and no stop file. If the pull
 * request cannot be read the answer is deny.
 */
const MERGE_HEAD = /^(feat|fix|chore|docs|test)\/ai-/;

function evaluateMerge(rest, context) {
  const flags = rest.filter((token) => token.startsWith("-"));
  const numbers = rest.filter((token) => !token.startsWith("-"));
  const strategies = flags.filter((flag) => flag === "--merge" || flag === "--squash");
  if (
    flags.length !== strategies.length ||
    strategies.length !== 1 ||
    numbers.length !== 1 ||
    !/^\d+$/.test(numbers[0])
  ) {
    return deny(
      "Merge with exactly: gh pr merge <number> --merge (or --squash). No other flags, no --admin, no --auto (R-AI-12).",
    );
  }
  if (context.stopRequested)
    return deny("The AI-RUN-STOP file exists, so the owner has stopped the automatic run.");
  const info = context.pullRequest ? context.pullRequest(numbers[0]) : null;
  if (!info) return deny("Could not read the pull request, so it is not merged (fail closed).");
  if (info.state !== "OPEN" || info.isDraft)
    return deny("Only an open pull request that is not a draft can be merged.");
  if (info.base !== "develop") return deny("Only pull requests into develop can be merged.");
  if (!MERGE_HEAD.test(info.head ?? ""))
    return deny(
      "Only AI chat branches (feat/ai-…, fix/ai-…, chore/ai-…, docs/ai-…, test/ai-…) may be merged by an agent (R-AI-12).",
    );
  if (info.mergeable === "CONFLICTING") return deny("The pull request has a merge conflict.");
  if (!info.checksPassed)
    return deny("The all-checks-passed check is not green yet. Wait for CI; never merge red.");
  return none;
}

function evaluateGh(tokens, context = {}) {
  const args = tokens.slice(1);
  const area = args[0] ?? "";
  const action = args[1] ?? "";
  if (area === "release")
    return deny("Releases are made by the release workflow, not by an agent.");
  if (area === "pr" && action === "merge") return evaluateMerge(args.slice(2), context);
  if (area === "pr" && ["close", "reopen"].includes(action))
    return deny("Closing and reopening pull requests is a human decision (R-AI-12).");
  if (area === "workflow" && action === "run")
    return deny("Run workflows through git events, not by hand.");
  if (area === "repo" && ["delete", "edit", "archive", "rename", "create"].includes(action))
    return deny("Repository settings are changed by the owner.");
  if (area === "secret" || area === "variable")
    return deny("Secrets and variables are managed by the owner.");
  if (area === "api") {
    const method = args.find(
      (token, index) =>
        (args[index - 1] === "-X" || args[index - 1] === "--method") &&
        /^(POST|PUT|PATCH|DELETE)$/i.test(token),
    );
    const writes =
      Boolean(method) ||
      args.some(
        (token) =>
          token === "-f" ||
          token === "-F" ||
          token === "--field" ||
          token === "--raw-field" ||
          token === "--input",
      );
    if (writes) return deny("gh api with a write method changes GitHub state and is not allowed.");
  }
  // Opening a pull request is allowed (owner decision, 12 Nov 2026); merging is denied above.
  if (area === "pr" && action === "create") return none;
  if (
    (area === "pr" || area === "issue") &&
    ["create", "edit", "comment", "review", "ready", "lock", "transfer"].includes(action)
  )
    return ask(`gh ${area} ${action} writes to GitHub. Confirm.`);
  return none;
}

function evaluateRemoval(name, tokens) {
  const args = tokens.slice(1);
  const recursive =
    (name === "rm" &&
      args.some((token) => /^-[a-zA-Z]*[rR]/.test(token) || token === "--recursive")) ||
    ((name === "rmdir" || name === "rd" || name === "del" || name === "erase") &&
      args.some((token) => /^\/[sS]$/.test(token))) ||
    (name === "remove-item" && args.some((token) => /^-recurse$/i.test(token))) ||
    ((name === "ri" || name === "rm") && args.some((token) => /^-recurse$/i.test(token)));
  if (!recursive) return none;
  const targets = args.filter((token) => !token.startsWith("-") && !/^\/[a-zA-Z]$/.test(token));
  if (targets.length === 0) return deny("Recursive delete with no target.");
  for (const target of targets) {
    const cleaned = target.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
    const top = cleaned.split("/")[0] ?? "";
    if (
      !SAFE_TO_DELETE.has(top) ||
      cleaned.includes("..") ||
      path.isAbsolute(cleaned) ||
      cleaned === "" ||
      cleaned === "." ||
      cleaned === "*"
    ) {
      return deny(
        `Recursive delete of "${target}" is not allowed. Only build output may be deleted: ${[...SAFE_TO_DELETE].join(", ")}.`,
      );
    }
  }
  return none;
}

/** Owner decision, 14 Nov 2026: the AI chat plan task P1-T01 adds `openai`, at one exact version. */
const OPENAI_OPERAND = /^openai@\d+\.\d+\.\d+$/;
const OPENAI_FLAGS = new Set(["--save-exact", "-E", "--ignore-scripts", "--save"]);

function isOpenAiInstall(sub, args) {
  if (!["install", "i", "add"].includes(sub)) return false;
  const flags = args.filter((token) => token.startsWith("-"));
  const operands = args.filter((token) => !token.startsWith("-")).slice(1);
  return (
    operands.length === 1 &&
    OPENAI_OPERAND.test(operands[0]) &&
    flags.every((flag) => OPENAI_FLAGS.has(flag))
  );
}

function evaluateNpm(tokens) {
  const args = tokens.slice(1);
  const sub = args.find((token) => !token.startsWith("-")) ?? "";
  if (isOpenAiInstall(sub, args)) return none;
  if (
    sub === "publish" ||
    sub === "unpublish" ||
    sub === "deprecate" ||
    sub === "dist-tag" ||
    sub === "owner" ||
    sub === "access" ||
    sub === "token" ||
    sub === "login" ||
    sub === "adduser"
  ) {
    return deny(`npm ${sub} acts on the registry or an account and is not allowed.`);
  }
  if (
    [
      "install",
      "i",
      "add",
      "uninstall",
      "remove",
      "rm",
      "un",
      "update",
      "up",
      "upgrade",
      "link",
      "pkg",
      "config",
      "set",
    ].includes(sub)
  ) {
    return ask(
      `npm ${sub} changes dependencies or configuration. Follow the add-dependency playbook and confirm (R-DEP-01).`,
    );
  }
  return none;
}

/**
 * @param {string} command  the Bash command line
 * @param {{ branch?: string|null, stopRequested?: boolean, pullRequest?: (number: string) => object|null }} context
 *   `pullRequest` returns { state, isDraft, base, head, mergeable, checksPassed } or null.
 * @returns {{ decision: "deny"|"ask"|"none", reason: string }}
 */
export function decide(command, context = {}) {
  if (typeof command !== "string" || command.trim() === "") return none;
  if (DOWNLOAD_TO_SHELL.test(command)) return deny("Do not run downloaded code through a shell.");
  const results = [];
  for (const segment of splitSegments(command)) {
    const tokens = words(segment);
    if (tokens.length === 0) continue;
    const { wrapper, noInstall, tokens: inner } = unwrap(tokens);
    const name = commandName(inner[0]);
    const push = (result) => results.push(result);

    // secrets: env files and the process environment
    if (SECRET_ENV_FILE.test(segment))
      push(
        deny(
          "Env files hold secrets and are off limits (R-AI-08). Read .env.example, or run npm run doctor.",
        ),
      );
    if (
      ["printenv"].includes(name) ||
      (name === "env" && inner.slice(1).every((token) => token.startsWith("-"))) ||
      (name === "set" && inner.length === 1) ||
      /^(get-childitem|gci|dir|ls)\s+env:/i.test(segment)
    ) {
      push(deny("Dumping the environment can reveal secrets (R-AI-08)."));
    }
    if (/^(echo|printf|write-output|write-host)$/.test(name) && SECRET_VARIABLE.test(segment))
      push(deny("Do not print variables that may hold secrets (R-AI-08)."));

    if (name === "git") push(evaluateGit(inner, context.branch));
    else if (name === "supabase") push(evaluateSupabase(inner));
    else if (name === "gh") push(evaluateGh(inner, context));
    else if (name === "vercel") push(deny("Deployments run in CI, not from an agent session."));
    else if (name === "npm") push(evaluateNpm(inner));
    else if (["rm", "rmdir", "rd", "del", "erase", "remove-item", "ri"].includes(name))
      push(evaluateRemoval(name, inner));
    else if (
      ["curl", "wget", "iwr", "irm", "invoke-webrequest", "invoke-restmethod"].includes(name)
    ) {
      if (!/https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(segment))
        push(
          ask(
            "Fetching an external URL: only documentation hosts are expected. Confirm (R-AI-09).",
          ),
        );
    } else if (name === "docker" || name === "docker-compose")
      push(ask("Docker commands can remove containers and volumes. Confirm."));

    if (wrapper && !noInstall && name && !LOCAL_TOOLS.has(name))
      push(
        ask(
          `${wrapper} would download and run "${name}". Add it as a reviewed dependency first (R-DEP-01).`,
        ),
      );
  }
  return (
    results.find((result) => result.decision === "deny") ??
    results.find((result) => result.decision === "ask") ??
    none
  );
}

function currentBranch(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function readPullRequest(cwd, number) {
  try {
    const raw = execFileSync(
      "gh",
      [
        "pr",
        "view",
        number,
        "--json",
        "baseRefName,headRefName,state,isDraft,mergeable,statusCheckRollup",
      ],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 30000 },
    );
    const data = JSON.parse(raw);
    const gate = (data.statusCheckRollup ?? []).find((check) => check.name === "all-checks-passed");
    return {
      state: data.state,
      isDraft: data.isDraft,
      base: data.baseRefName,
      head: data.headRefName,
      mergeable: data.mergeable,
      checksPassed: gate?.conclusion === "SUCCESS",
    };
  } catch {
    return null;
  }
}

/** The stop file lives in the main checkout, so every worktree sees the same one. */
function stopFileExists(cwd) {
  try {
    const common = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return existsSync(path.join(path.dirname(common), "AI-RUN-STOP"));
  } catch {
    return true; // cannot tell, so treat it as stopped
  }
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
      process.stderr.write("guard-bash: could not read the hook input; blocking to stay safe.\n");
      process.exit(2);
    }
    const command = input?.tool_input?.command;
    const cwd = input?.cwd ?? process.cwd();
    const isMerge = /\bgh\s+pr\s+merge\b/.test(String(command));
    const { decision, reason } = decide(command, {
      branch: currentBranch(cwd),
      stopRequested: isMerge ? stopFileExists(cwd) : false,
      pullRequest: (number) => readPullRequest(cwd, number),
    });
    if (decision === "deny") {
      process.stderr.write(`Blocked by guard-bash: ${reason}\n`);
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
