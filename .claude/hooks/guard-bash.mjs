// Claude Code PreToolUse hook for Bash commands (L-03, docs/engineering/security.md).
// Reads the hook JSON on stdin. Exit 2 with a reason on stderr blocks the command and tells the
// agent why. A JSON "ask" decision escalates to the human. Anything else: no opinion.
// The pure decide() function is unit tested (scripts/__tests__/guard-bash.test.mjs).
import { execFileSync } from "node:child_process";
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
    .map((s) => s.trim())
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
    let i = 1;
    while (tokens[i]?.startsWith("-")) flags.push(tokens[i++]);
    return {
      wrapper: first,
      noInstall: flags.includes("--no-install") || flags.includes("--offline"),
      tokens: tokens.slice(i),
    };
  }
  if (first === "npm" && tokens[1] === "exec") {
    let i = 2;
    while (tokens[i]?.startsWith("-")) i++;
    return { wrapper: "npm exec", noInstall: false, tokens: tokens.slice(i) };
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
  let i = 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "-C" || t === "-c" || t === "--git-dir" || t === "--work-tree") i += 2;
    else if (t.startsWith("-")) i += 1;
    else break;
  }
  return { sub: tokens[i] ?? "", rest: tokens.slice(i + 1) };
}

function evaluateGit(tokens, branch) {
  const { sub, rest } = gitSubcommand(tokens);
  const all = tokens.join(" ");
  if (/\s--no-verify\b/.test(` ${all}`) || (sub === "commit" && rest.includes("-n")))
    return deny("--no-verify skips the hooks and gates (R-AI-04). Fix the failure instead.");
  const onProtected = PROTECTED_BRANCHES.has(branch ?? "");
  if (sub === "push") {
    const force = rest.some(
      (t) =>
        t === "--force" ||
        t === "-f" ||
        t.startsWith("--force-with-lease") ||
        t === "--mirror" ||
        t === "--delete" ||
        /^\+\S/.test(t),
    );
    if (force)
      return deny(
        "Force-pushing, deleting remote branches and mirror pushes are not allowed (R-GIT-01).",
      );
    const targets = rest.filter((t) => !t.startsWith("-")).slice(1); // after the remote name
    const toProtected =
      targets.some((t) => /(^|[:/])(main|develop)$/.test(t)) ||
      (rest.filter((t) => !t.startsWith("-")).length <= 1 && onProtected);
    if (toProtected)
      return deny(
        "Do not push to main or develop; push a feature branch and open a pull request (R-GIT-01).",
      );
    return ask("Pushing publishes work to the remote. Confirm.");
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
  if (sub === "clean" && rest.some((t) => /^-\w*f/.test(t) || t === "--force"))
    return deny("git clean -f deletes untracked files and cannot be undone.");
  return none;
}

function evaluateSupabase(tokens) {
  const args = tokens.slice(1);
  const joined = args.join(" ");
  if (
    args.some(
      (t) =>
        t === "--linked" ||
        t === "--db-url" ||
        t.startsWith("--db-url=") ||
        t === "--project-ref" ||
        t.startsWith("--project-ref=") ||
        t === "--project-id" ||
        t.startsWith("--project-id="),
    )
  ) {
    return deny(
      "Commands against a linked project or a database URL touch a shared environment. CI applies migrations; agents never do (R-DB-01).",
    );
  }
  const sub = args.find((t) => !t.startsWith("-")) ?? "";
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

function evaluateGh(tokens) {
  const args = tokens.slice(1);
  const area = args[0] ?? "";
  const action = args[1] ?? "";
  if (area === "release")
    return deny("Releases are made by the release workflow, not by an agent.");
  if (area === "pr" && ["merge", "close", "reopen"].includes(action))
    return deny("Merging and closing pull requests is a human decision (R-AI-12).");
  if (area === "workflow" && action === "run")
    return deny("Run workflows through git events, not by hand.");
  if (area === "repo" && ["delete", "edit", "archive", "rename", "create"].includes(action))
    return deny("Repository settings are changed by the owner.");
  if (area === "secret" || area === "variable")
    return deny("Secrets and variables are managed by the owner.");
  if (area === "api") {
    const method = args.find(
      (t, i) =>
        (args[i - 1] === "-X" || args[i - 1] === "--method") &&
        /^(POST|PUT|PATCH|DELETE)$/i.test(t),
    );
    const writes =
      Boolean(method) ||
      args.some(
        (t) =>
          t === "-f" || t === "-F" || t === "--field" || t === "--raw-field" || t === "--input",
      );
    if (writes) return deny("gh api with a write method changes GitHub state and is not allowed.");
  }
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
    (name === "rm" && args.some((t) => /^-[a-zA-Z]*[rR]/.test(t) || t === "--recursive")) ||
    ((name === "rmdir" || name === "rd" || name === "del" || name === "erase") &&
      args.some((t) => /^\/[sS]$/.test(t))) ||
    (name === "remove-item" && args.some((t) => /^-recurse$/i.test(t))) ||
    ((name === "ri" || name === "rm") && args.some((t) => /^-recurse$/i.test(t)));
  if (!recursive) return none;
  const targets = args.filter((t) => !t.startsWith("-") && !/^\/[a-zA-Z]$/.test(t));
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

function evaluateNpm(tokens) {
  const args = tokens.slice(1);
  const sub = args.find((t) => !t.startsWith("-")) ?? "";
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
 * @param {{ branch?: string|null }} ctx
 * @returns {{ decision: "deny"|"ask"|"none", reason: string }}
 */
export function decide(command, ctx = {}) {
  if (typeof command !== "string" || command.trim() === "") return none;
  if (DOWNLOAD_TO_SHELL.test(command)) return deny("Do not run downloaded code through a shell.");
  const results = [];
  for (const segment of splitSegments(command)) {
    const tokens = words(segment);
    if (tokens.length === 0) continue;
    const { wrapper, noInstall, tokens: inner } = unwrap(tokens);
    const name = commandName(inner[0]);
    const push = (r) => results.push(r);

    // secrets: env files and the process environment
    if (SECRET_ENV_FILE.test(segment))
      push(
        deny(
          "Env files hold secrets and are off limits (R-AI-08). Read .env.example, or run npm run doctor.",
        ),
      );
    if (
      ["printenv"].includes(name) ||
      (name === "env" && inner.slice(1).every((t) => t.startsWith("-"))) ||
      (name === "set" && inner.length === 1) ||
      /^(get-childitem|gci|dir|ls)\s+env:/i.test(segment)
    ) {
      push(deny("Dumping the environment can reveal secrets (R-AI-08)."));
    }
    if (/^(echo|printf|write-output|write-host)$/.test(name) && SECRET_VARIABLE.test(segment))
      push(deny("Do not print variables that may hold secrets (R-AI-08)."));

    if (name === "git") push(evaluateGit(inner, ctx.branch));
    else if (name === "supabase") push(evaluateSupabase(inner));
    else if (name === "gh") push(evaluateGh(inner));
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
    results.find((r) => r.decision === "deny") ?? results.find((r) => r.decision === "ask") ?? none
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
    const { decision, reason } = decide(command, { branch: currentBranch(cwd) });
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
