// L-01 helper: run gitleaks on staged changes. If gitleaks is not installed, warn and continue
// (npm run doctor reports it); CI always scans (gate G-12).
// Usage: node scripts/run-gitleaks.mjs --staged
import { spawnSync } from "node:child_process";
import { repoRoot } from "./lib/core.mjs";

const shell = process.platform === "win32";
const probe = spawnSync("gitleaks", ["version"], { cwd: repoRoot, encoding: "utf8", shell });
if (probe.error || probe.status !== 0) {
  console.warn(
    "run-gitleaks: gitleaks is not installed; skipping the local secret scan (npm run doctor explains how to install it). CI still scans.",
  );
  process.exit(0);
}

const staged = process.argv.includes("--staged");
const args = staged
  ? ["protect", "--staged", "--redact", "--no-banner"]
  : ["detect", "--redact", "--no-banner"];
const result = spawnSync("gitleaks", args, { cwd: repoRoot, stdio: "inherit", shell });
process.exit(result.status ?? 1);
