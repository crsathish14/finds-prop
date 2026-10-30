// Runs after `npm install`: installs the git hooks on developer machines only.
// Skipped in CI and wherever there is no git repository (for example a Vercel build).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./lib/core.mjs";

if (process.env.CI || process.env.VERCEL || !fs.existsSync(path.join(repoRoot, ".git")))
  process.exit(0);
spawnSync("npx", ["--no-install", "lefthook", "install"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});
// A failure to install hooks must never break an install; doctor reports missing hooks.
process.exit(0);
