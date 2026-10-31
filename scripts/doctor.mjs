// L-02 doctor: tells a new developer or agent what is missing. OK, WARN or FAIL per item with a fix.
// Exit code 1 only when something blocks work (FAIL). Never prints the value of any variable.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isMain, repoRoot } from "./lib/core.mjs";

const results = [];
const add = (level, item, detail, fix = "") => results.push({ level, item, detail, fix });

function run(cmd, args, options = {}) {
  const spawned = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    cwd: repoRoot,
    timeout: 20_000,
    ...options,
  });
  return spawned.error || spawned.status !== 0 ? null : (spawned.stdout ?? "").trim();
}

const major = (version) => Number.parseInt(String(version).replace(/^v/, ""), 10);

export function doctor() {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const wantedNode = String(pkg.engines?.node ?? ">=22").match(/\d+/)?.[0] ?? "22";

  // Node and npm
  if (major(process.version) >= Number(wantedNode)) add("OK", "Node", process.version);
  else
    add(
      "FAIL",
      "Node",
      `${process.version}, need ${pkg.engines?.node}`,
      "Install the Node version in .nvmrc",
    );
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua && !ua.startsWith("npm/"))
    add("FAIL", "Package manager", ua.split(" ")[0], "Use npm only (R-GEN-01)");
  else add("OK", "Package manager", "npm");

  // dependencies
  if (fs.existsSync(path.join(repoRoot, "node_modules")))
    add("OK", "Dependencies", "node_modules present");
  else add("FAIL", "Dependencies", "node_modules is missing", "Run npm ci");

  // Docker and the Supabase CLI
  const docker = run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  if (docker) add("OK", "Docker", `running (${docker})`);
  else
    add(
      "INFO",
      "Docker",
      "not running (optional, ADR-034)",
      "Without it check:db and test:integration cannot run here; CI runs them. Say so in PRs",
    );
  const supa = run("supabase", ["--version"]);
  if (supa) add("OK", "Supabase CLI", supa);
  else
    add(
      "WARN",
      "Supabase CLI",
      "not found on PATH",
      "The owner needs it for `supabase link` and `db push` to the dev project (ADR-034): scoop install supabase, or run `npx supabase@2.122.0 <command>`. CI has its own copy",
    );

  // secret scanning
  const gitleaks = run("gitleaks", ["version"]);
  if (gitleaks) add("OK", "gitleaks", gitleaks);
  else
    add(
      "WARN",
      "gitleaks",
      "not installed",
      "Install it (winget install gitleaks or scoop install gitleaks) so the pre-commit secret scan runs; CI scans anyway",
    );

  // git
  const inGit = run("git", ["rev-parse", "--is-inside-work-tree"]) === "true";
  if (!inGit) add("FAIL", "Git", "not a git repository", "Run git init or clone the repository");
  else {
    const autocrlf = run("git", ["config", "--get", "core.autocrlf"]);
    if (autocrlf === "true")
      add(
        "FAIL",
        "Git line endings",
        "core.autocrlf=true converts files to CRLF",
        "Run: git config core.autocrlf false (the repo uses LF, see .gitattributes)",
      );
    else
      add(
        "OK",
        "Git line endings",
        `core.autocrlf=${autocrlf ?? "unset"}; .gitattributes enforces LF`,
      );
    const hooksPath = path.join(repoRoot, ".git", "hooks", "pre-commit");
    if (fs.existsSync(hooksPath)) add("OK", "Git hooks", "pre-commit hook installed");
    else
      add(
        "WARN",
        "Git hooks",
        "pre-commit hook not installed",
        "Run npm run prepare (installs lefthook hooks)",
      );
  }

  // path
  const hasSpace = repoRoot.includes(" ");
  const inOneDrive = /onedrive/i.test(repoRoot);
  if (hasSpace || inOneDrive) {
    add(
      "WARN",
      "Repository path",
      `${hasSpace ? "contains a space" : ""}${hasSpace && inOneDrive ? " and " : ""}${inOneDrive ? "is inside OneDrive" : ""}`,
      "Quote paths in scripts. OneDrive can slow or lock node_modules and .next: pause sync during installs, or move the repo (RISK-27)",
    );
  } else add("OK", "Repository path", "no spaces, not in OneDrive");

  // local environment file (names only, never values)
  if (fs.existsSync(path.join(repoRoot, ".env.local"))) add("OK", ".env.local", "present");
  else
    add(
      "WARN",
      ".env.local",
      "missing",
      "Copy .env.example to .env.local and fill in the local values",
    );

  // agent adapter
  if (fs.existsSync(path.join(repoRoot, "CLAUDE.local.md")))
    add(
      "WARN",
      "CLAUDE.local.md",
      "exists",
      "It stops Claude Code reading AGENTS.md; delete it and use ~/.claude/CLAUDE.md",
    );
  const claude = run("claude", ["--version"]);
  if (claude) add("OK", "Claude Code", claude.split("\n")[0] ?? claude);
  else add("OK", "Claude Code", "not installed here (optional)");

  return results;
}

if (isMain(import.meta.url)) {
  const out = doctor();
  const widest = Math.max(...out.map((row) => row.item.length));
  for (const row of out) {
    console.log(`${row.level.padEnd(4)}  ${row.item.padEnd(widest)}  ${row.detail}`);
    if (row.fix && row.level !== "OK") console.log(`      -> ${row.fix}`);
  }
  const fails = out.filter((row) => row.level === "FAIL").length;
  const warns = out.filter((row) => row.level === "WARN").length;
  console.log(`\n${fails} blocking, ${warns} warnings.`);
  process.exit(fails > 0 ? 1 : 0);
}
