// G-13 Migrations policy.
//  - existing migrations (on the base branch) are never modified, renamed or deleted (R-DB-02)
//  - new files are named <14-digit timestamp>_<snake_case>.sql and sort after the newest on base
//  - every `create table public.x` enables Row Level Security in the same file (R-DB-04)
//  - destructive SQL carries a `-- destructive: <reason>` header and a rollback file (R-DB-03)
// Usage: node scripts/check-migrations.mjs [--base <git ref>]   (base defaults to BASE_REF or origin/develop)
import fs from "node:fs";
import path from "node:path";
import { finding, git, isMain, printFindings, repoRoot } from "./lib/core.mjs";

const DIR = "supabase/migrations";
const NAME = /^supabase\/migrations\/(\d{14})_[a-z0-9_]+\.sql$/;
const CREATE_TABLE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(\w+)\.)?"?(\w+)"?/gi;
const DESTRUCTIVE =
  /\b(drop\s+table|drop\s+column|truncate\b|alter\s+column\s+\S+\s+(?:set\s+data\s+)?type)\b/i;

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Pure policy function.
 * @param {{ files: Array<{path: string, content: string}>, rollbackFiles: string[],
 *           base: null | { nameStatus: Array<{status: string, path: string}>, baseFiles: string[] } }} input
 */
export function evaluateMigrations({ files, rollbackFiles = [], base = null }) {
  const findings = [];

  if (base) {
    const newestOnBase = base.baseFiles
      .map((fileName) => NAME.exec(fileName)?.[1])
      .filter(Boolean)
      .sort()
      .at(-1);
    for (const { status, path: file } of base.nameStatus) {
      if (!file.startsWith(`${DIR}/`)) continue;
      if (status !== "A") {
        findings.push(
          finding(
            file,
            0,
            "MIG-IMMUTABLE",
            `an existing migration was ${status === "D" ? "deleted" : status.startsWith("R") ? "renamed" : "modified"}; migrations are forward-only, add a new file instead (R-DB-02)`,
          ),
        );
        continue;
      }
      const timestamp = NAME.exec(file)?.[1];
      if (timestamp && newestOnBase && timestamp <= newestOnBase) {
        findings.push(
          finding(
            file,
            0,
            "MIG-ORDER",
            `timestamp ${timestamp} does not sort after the newest migration on the base branch (${newestOnBase}); rename it (R-DB-02)`,
          ),
        );
      }
    }
  }

  for (const { path: file, content } of files) {
    const match = NAME.exec(file);
    if (!match) {
      findings.push(
        finding(
          file,
          0,
          "MIG-NAME",
          "name must be <14-digit timestamp>_<snake_case>.sql (R-DB-03)",
        ),
      );
      continue;
    }
    const code = stripSqlComments(content);
    const lower = code.toLowerCase();
    for (const table of code.matchAll(CREATE_TABLE)) {
      const schema = (table[1] ?? "public").toLowerCase();
      const name = table[2].toLowerCase();
      if (schema !== "public") continue;
      const enable = new RegExp(
        `alter\\s+table\\s+(?:only\\s+)?(?:if\\s+exists\\s+)?(?:public\\.)?"?${name}"?\\s+enable\\s+row\\s+level\\s+security`,
      );
      if (!enable.test(lower))
        findings.push(
          finding(
            file,
            0,
            "MIG-RLS",
            `table public.${name} is created without "alter table public.${name} enable row level security" in the same file (R-DB-04)`,
          ),
        );
    }
    if (DESTRUCTIVE.test(code)) {
      if (!/^\s*--\s*destructive:\s*\S.{6,}/im.test(content))
        findings.push(
          finding(
            file,
            0,
            "MIG-DESTRUCTIVE",
            "destructive SQL needs a header line '-- destructive: <reason>' (R-DB-03)",
          ),
        );
      const rollback = `supabase/rollbacks/${match[1]}.sql`;
      if (!rollbackFiles.includes(rollback))
        findings.push(
          finding(
            file,
            0,
            "MIG-DESTRUCTIVE",
            `destructive SQL needs a reviewed rollback script at ${rollback} (R-DB-03)`,
          ),
        );
    }
  }
  return findings;
}

export function collect(root, baseRef) {
  const dir = path.join(root, DIR);
  const files = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((fileName) => fileName.endsWith(".sql"))
        .map((fileName) => ({
          path: `${DIR}/${fileName}`,
          content: fs.readFileSync(path.join(dir, fileName), "utf8"),
        }))
    : [];
  const rollbackDir = path.join(root, "supabase/rollbacks");
  const rollbackFiles = fs.existsSync(rollbackDir)
    ? fs.readdirSync(rollbackDir).map((fileName) => `supabase/rollbacks/${fileName}`)
    : [];

  let base = null;
  const mergeBase = baseRef
    ? git(root, ["merge-base", baseRef, "HEAD"], { allowFail: true })?.trim()
    : null;
  if (mergeBase) {
    const diff =
      git(root, ["diff", "--name-status", mergeBase, "--", DIR], { allowFail: true }) ?? "";
    const nameStatus = diff
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [status, ...rest] = line.split("\t");
        return { status: status ?? "", path: rest.at(-1) ?? "" };
      });
    const baseFiles = (
      git(root, ["ls-tree", "-r", "--name-only", baseRef, "--", DIR], { allowFail: true }) ?? ""
    )
      .split("\n")
      .filter(Boolean);
    base = { nameStatus, baseFiles };
  }
  return { files, rollbackFiles, base };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  const baseRef = baseIndex >= 0 ? args[baseIndex + 1] : (process.env.BASE_REF ?? "origin/develop");
  const input = collect(repoRoot, baseRef);
  if (!input.base) {
    if (process.env.CI) {
      console.error(
        `check-migrations: base ref ${baseRef} is not available in CI; fetch it (fetch-depth 0)`,
      );
      process.exit(1);
    }
    console.log(
      `check-migrations: base ref ${baseRef} not available here; skipping the immutability and ordering checks (CI runs them)`,
    );
  }
  process.exit(printFindings("check-migrations", evaluateMigrations(input)));
}
