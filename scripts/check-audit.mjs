// G-11 Dependency audit (online part): fails on a high or critical advisory in the production dependencies,
// except an advisory that has a dated exception in scripts/policy/audit-exceptions.json. It replaces the bare
// `npm audit --omit=dev --audit-level=high`, which cannot skip one advisory, so a single advisory with no patched
// version does not block every pull request while every other high advisory still does.
// An exception needs { advisory (a GHSA id), package, reason (10 characters or more), reference (the advisory
// address) and expires (YYYY-MM-DD) }. One that is incomplete or past its date is itself a finding, so an exception
// can never be forgotten. The script fails closed: if `npm audit` cannot answer, that is a finding too.
// Usage: node scripts/check-audit.mjs
import { spawnSync } from "node:child_process";
import { finding, isMain, printFindings, readJson, repoRoot } from "./lib/core.mjs";

const BLOCKING = new Set(["high", "critical"]);
const EXCEPTIONS_FILE = "scripts/policy/audit-exceptions.json";

/** The GHSA id inside an advisory address, or null. */
function advisoryId(address) {
  const match = /GHSA(?:-[a-z0-9]{4}){3}/i.exec(String(address ?? ""));
  return match ? match[0].toLowerCase() : null;
}

/** Problems with the exceptions themselves: incomplete, or past their date. */
export function checkExceptions(exceptions, today = new Date()) {
  const problems = [];
  for (const [index, entry] of exceptions.entries()) {
    const where = `${EXCEPTIONS_FILE}[${index}]`;
    if (!advisoryId(entry.advisory) || String(entry.advisory).trim().length !== 19) {
      problems.push(
        finding(where, 0, "AUDIT-EXCEPTION", "entry needs an advisory id like GHSA-xxxx-xxxx-xxxx"),
      );
    }
    if (!entry.package)
      problems.push(finding(where, 0, "AUDIT-EXCEPTION", "entry needs a package"));
    if (!entry.reason || String(entry.reason).length < 10) {
      problems.push(
        finding(where, 0, "AUDIT-EXCEPTION", "entry needs a reason of at least 10 characters"),
      );
    }
    if (!entry.reference || !/^https:\/\//.test(String(entry.reference))) {
      problems.push(
        finding(
          where,
          0,
          "AUDIT-EXCEPTION",
          "entry needs a reference (the advisory https address)",
        ),
      );
    }
    if (!entry.expires || Number.isNaN(Date.parse(entry.expires))) {
      problems.push(
        finding(where, 0, "AUDIT-EXCEPTION", "entry needs an expires date (YYYY-MM-DD)"),
      );
    } else if (new Date(`${entry.expires}T23:59:59Z`) < today) {
      problems.push(
        finding(
          where,
          0,
          "AUDIT-EXCEPTION",
          `entry for ${entry.advisory} expired on ${entry.expires}; check for a patched version, then remove or renew it`,
        ),
      );
    }
  }
  return problems;
}

/**
 * The findings for one `npm audit --json` report. Every advisory object of severity high or critical in any
 * package's `via` list is checked; the ones that only name another package (strings) are the same advisories seen
 * from the packages that depend on it, so they are not counted twice.
 */
export function evaluateAudit(report, exceptions = [], today = new Date()) {
  const findings = checkExceptions(exceptions, today);
  const excepted = new Map(
    exceptions
      .filter((entry) => advisoryId(entry.advisory))
      .map((entry) => [advisoryId(entry.advisory), entry]),
  );
  const seen = new Set();
  for (const vulnerability of Object.values(report?.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== "object" || via === null) continue;
      if (!BLOCKING.has(String(via.severity))) continue;
      const id = advisoryId(via.url);
      const key = id ?? `${via.name}:${via.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = id ? excepted.get(id) : undefined;
      if (entry && new Date(`${entry.expires}T23:59:59Z`) >= today) continue;
      findings.push(
        finding(
          "package-lock.json",
          0,
          "AUDIT-ADVISORY",
          `${via.severity} advisory in ${via.name ?? vulnerability.name}: ${via.title ?? "(no title)"} ${via.url ?? ""}`.trim(),
        ),
      );
    }
  }
  return findings;
}

/** Runs `npm audit` for the production dependencies and returns its parsed report, or null when it cannot answer. */
function runNpmAudit() {
  const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 50 * 1024 * 1024,
  });
  // npm audit exits non-zero when it finds anything; its JSON is still on standard output.
  try {
    const report = JSON.parse(result.stdout);
    return report && typeof report === "object" && report.vulnerabilities !== undefined
      ? report
      : null;
  } catch {
    return null;
  }
}

if (isMain(import.meta.url)) {
  const report = runNpmAudit();
  if (report === null) {
    process.exit(
      printFindings("check-audit", [
        finding(
          "npm audit",
          0,
          "AUDIT-UNAVAILABLE",
          "npm audit gave no usable answer (registry or network problem); the gate fails closed",
        ),
      ]),
    );
  }
  const exceptions = readJson(repoRoot, EXCEPTIONS_FILE, []);
  const findings = evaluateAudit(report, exceptions);
  for (const entry of exceptions) {
    if (new Date(`${entry.expires}T23:59:59Z`) >= new Date()) {
      console.log(
        `check-audit: excepted ${entry.advisory} (${entry.package}) until ${entry.expires}: ${entry.reason}`,
      );
    }
  }
  process.exit(printFindings("check-audit", findings));
}
