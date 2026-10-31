import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "../lib/core.mjs";

const created = [];

/** Build a throw-away repository tree from { "relative/path": "content" }. */
export function makeTree(files = {}, { withPolicy = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "findsprop-test-"));
  created.push(root);
  if (withPolicy)
    fs.cpSync(path.join(repoRoot, "scripts", "policy"), path.join(root, "scripts", "policy"), {
      recursive: true,
    });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

export function cleanupTrees() {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

export const rules = (findings) => findings.map((f) => f.rule);
