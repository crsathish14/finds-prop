// G-15 Env parity: the variable names in the two env modules equal the names in .env.example,
// process.env is read nowhere else, and .env.example contains no secret-looking values.
// Layout rule: one variable per line in the schemas (documented in src/server/env.ts).
import fs from "node:fs";
import path from "node:path";
import {
  finding,
  isMain,
  lineOf,
  listFiles,
  printFindings,
  readText,
  repoRoot,
} from "./lib/core.mjs";

const ENV_MODULES = ["src/server/env.ts", "src/lib/public-env.ts"];
const KEY_LINE = /^\s+([A-Z][A-Z0-9_]+):/gm;
const PROCESS_ENV = /\bprocess\.env\b/g;
// Names Next.js and the platform provide themselves; not ours to declare.
const PLATFORM_KEYS = new Set(["NODE_ENV", "NEXT_RUNTIME", "VERCEL_ENV", "VERCEL_URL", "CI"]);

function keysFromModule(text) {
  const keys = new Set();
  for (const match of text.matchAll(KEY_LINE)) keys.add(match[1]);
  return keys;
}

function keysFromExample(text) {
  const keys = new Map();
  text.split("\n").forEach((line, index) => {
    const match = /^([A-Z][A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) keys.set(match[1], { value: match[2], line: index + 1 });
  });
  return keys;
}

export function checkEnv({ root = repoRoot, files = listFiles(root) } = {}) {
  const findings = [];
  const schemaKeys = new Set();
  for (const mod of ENV_MODULES) {
    const full = path.join(root, mod);
    if (!fs.existsSync(full)) {
      findings.push(finding(mod, 0, "ENV-MODULE", "env module is missing"));
      continue;
    }
    for (const key of keysFromModule(fs.readFileSync(full, "utf8"))) schemaKeys.add(key);
  }

  const examplePath = path.join(root, ".env.example");
  if (!fs.existsSync(examplePath)) {
    findings.push(finding(".env.example", 0, "ENV-EXAMPLE", ".env.example is missing"));
  } else {
    const example = keysFromExample(fs.readFileSync(examplePath, "utf8"));
    for (const key of schemaKeys) {
      if (!example.has(key))
        findings.push(
          finding(
            ".env.example",
            0,
            "ENV-PARITY",
            `${key} is in the env schema but not in .env.example`,
          ),
        );
    }
    for (const [key, { value, line }] of example) {
      if (!schemaKeys.has(key))
        findings.push(
          finding(
            ".env.example",
            line,
            "ENV-PARITY",
            `${key} is in .env.example but not in the env schema`,
          ),
        );
      if (/^(eyJ[\w-]{10,}|sk_[\w-]{10,}|[A-Za-z0-9+/=_-]{32,})$/.test(value)) {
        findings.push(
          finding(
            ".env.example",
            line,
            "ENV-SECRET",
            `${key} looks like a real secret; .env.example holds names and safe defaults only`,
          ),
        );
      }
    }
  }

  // process.env only in the two env modules
  for (const file of files) {
    if (!/\.(ts|tsx|mjs|js|mts)$/.test(file)) continue;
    if (ENV_MODULES.includes(file)) continue;
    if (
      file.startsWith("scripts/") ||
      file.startsWith(".claude/") ||
      file.endsWith(".config.ts") ||
      file.endsWith(".config.mjs") ||
      file.endsWith(".config.mts")
    )
      continue;
    if (/(\.test\.|\.spec\.|\/__tests__\/|^e2e\/|^tests\/)/.test(file)) continue;
    const text = readText(root, file);
    if (text === null) continue;
    for (const match of text.matchAll(PROCESS_ENV)) {
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 40);
      const name = /^\.([A-Z0-9_]+)/.exec(after)?.[1];
      if (name && PLATFORM_KEYS.has(name)) continue;
      findings.push(
        finding(
          file,
          lineOf(text, match.index),
          "ENV-PROCESS",
          "read environment variables only through src/server/env.ts or src/lib/public-env.ts (R-GEN-07)",
        ),
      );
    }
  }
  return findings;
}

if (isMain(import.meta.url)) process.exit(printFindings("check-env", checkEnv()));
