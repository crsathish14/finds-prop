// G-09 (part): after `next build`, no server-only variable name or value may appear in the files
// served to browsers (.next/static). Names come from the server env schema; values come from the
// build environment. R-SEC-08.
import fs from "node:fs";
import path from "node:path";
import { finding, isMain, printFindings, repoRoot } from "./lib/core.mjs";

const ALWAYS_FORBIDDEN = ["service_role", "SUPABASE_SERVICE_ROLE_KEY"];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(js|css|map|json|html|txt)$/.test(entry.name)) yield full;
  }
}

export function serverVariableNames(root) {
  const text = fs.readFileSync(path.join(root, "src/server/env.ts"), "utf8");
  return [...text.matchAll(/^\s+([A-Z][A-Z0-9_]+):/gm)]
    .map((match) => match[1])
    .filter((name) => !name.startsWith("NEXT_PUBLIC_"));
}

export function scanBundle({
  root = repoRoot,
  env = process.env,
  staticDir = path.join(root, ".next", "static"),
} = {}) {
  const findings = [];
  if (!fs.existsSync(staticDir))
    return [
      finding(".next/static", 0, "BUNDLE-MISSING", "build output not found; run next build first"),
    ];

  const names = [...new Set([...serverVariableNames(root), ...ALWAYS_FORBIDDEN])];
  const secretValues = names
    .map((name) => ({ name, value: env[name] }))
    .filter(
      ({ name, value }) =>
        typeof value === "string" &&
        value.length >= 16 &&
        !/^(local|dev|staging|production)$/.test(value) &&
        name !== "APP_ENV",
    );

  for (const file of walk(staticDir)) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    for (const name of names) {
      if (text.includes(name))
        findings.push(
          finding(
            rel,
            0,
            "BUNDLE-NAME",
            `server-only name ${name} appears in a file served to browsers (R-SEC-08)`,
          ),
        );
    }
    for (const { name, value } of secretValues) {
      if (text.includes(value))
        findings.push(
          finding(
            rel,
            0,
            "BUNDLE-VALUE",
            `the value of ${name} appears in a file served to browsers (R-SEC-08)`,
          ),
        );
    }
  }
  return findings;
}

if (isMain(import.meta.url)) process.exit(printFindings("check-client-bundle", scanBundle()));
