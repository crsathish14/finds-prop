// Shared helpers for the policy scripts (gates G-11 to G-17). Plain Node, no dependencies, so the
// scripts run on Windows, macOS and Linux exactly as they do in CI.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** One finding is printed as `file:line rule-id message` so editors and CI can link to it. */
export function finding(file, line, rule, message) {
  return { file, line, rule, message };
}

export function printFindings(name, findings) {
  for (const f of findings) {
    console.error(`${f.file}${f.line ? `:${f.line}` : ""} ${f.rule} ${f.message}`);
  }
  if (findings.length === 0) console.log(`${name}: ok`);
  else console.error(`${name}: ${findings.length} problem${findings.length === 1 ? "" : "s"}`);
  return findings.length === 0 ? 0 : 1;
}

export function git(root, args, { allowFail = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (allowFail) return null;
    throw error;
  }
}

/** Tracked files plus untracked-but-not-ignored files, as repo-relative POSIX paths. */
export function listFiles(root, { staged = false } = {}) {
  const out = staged
    ? git(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
    : git(root, ["ls-files", "--cached", "--others", "--exclude-standard"]);
  return out
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => fs.existsSync(path.join(root, f)));
}

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".json",
  ".md",
  ".css",
  ".sql",
  ".yml",
  ".yaml",
  ".toml",
  ".html",
  ".txt",
  ".example",
]);

export function isTextFile(file) {
  const base = path.basename(file);
  return TEXT_EXTENSIONS.has(path.extname(file)) || base.startsWith(".env") || base === "AGENTS.md";
}

export function readText(root, file, maxBytes = 1_000_000) {
  const full = path.join(root, file);
  const stat = fs.statSync(full);
  if (stat.size > maxBytes) return null;
  return fs.readFileSync(full, "utf8");
}

/** Glob to RegExp: `**` crosses folders, `*` does not, `{a,b}` alternates. Matches the whole path. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") re += "(?:";
    else if (c === "}") re += ")";
    else if (c === ",") re += "|";
    else if ("\\^$+.()|[]".includes(c)) re += `\\${c}`;
    else re += c;
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(file, globs) {
  return globs.some((g) => globToRegExp(g).test(file));
}

export function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

export function readJson(root, rel, fallback = undefined) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing file: ${rel}`);
  }
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

/**
 * Waivers live in scripts/policy/allowlist.json as { path, rule, reason, issue, expires }.
 * An entry without a reason or issue, or past its expiry date, is itself a finding.
 */
export function loadAllowlist(root, today = new Date()) {
  const entries = readJson(root, "scripts/policy/allowlist.json", []);
  const problems = [];
  for (const [index, entry] of entries.entries()) {
    const where = `scripts/policy/allowlist.json[${index}]`;
    if (!entry.path || !entry.rule)
      problems.push(finding(where, 0, "allowlist", "entry needs path and rule"));
    if (!entry.reason || String(entry.reason).length < 10)
      problems.push(
        finding(where, 0, "allowlist", "entry needs a reason of at least 10 characters"),
      );
    if (!entry.issue || !/^#\d+$/.test(String(entry.issue)))
      problems.push(finding(where, 0, "allowlist", "entry needs an issue number like #123"));
    if (!entry.expires || Number.isNaN(Date.parse(entry.expires)))
      problems.push(finding(where, 0, "allowlist", "entry needs an expires date (YYYY-MM-DD)"));
    else if (new Date(entry.expires) < today)
      problems.push(
        finding(
          where,
          0,
          "allowlist",
          `entry expired on ${entry.expires}; fix the cause or renew it with a new issue`,
        ),
      );
  }
  const isAllowed = (file, rule) =>
    entries.some(
      (entry) =>
        entry.rule === rule &&
        entry.path &&
        globToRegExp(entry.path).test(file) &&
        new Date(entry.expires) >= today,
    );
  return { entries, problems, isAllowed };
}

/** True when this module was started directly (not imported by a test). */
export function isMain(metaUrl) {
  return process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
}
