// G-21 Messages: src/i18n/messages/en.json is the single source of visitor-facing text (ADR-035).
//  - every file is valid JSON; values are non-empty strings or nested objects; keys are plain names
//  - no HTML in messages; braces balance; variable names are plain; no apostrophe before a brace
//  - every key in en.json is used somewhere in src/ (a key nobody reads is dead text)
//  - every other language file has exactly the keys and the variables of en.json
// Usage: node scripts/check-messages.mjs
import fs from "node:fs";
import path from "node:path";
import { finding, isMain, listFiles, printFindings, readText, repoRoot } from "./lib/core.mjs";

export const MESSAGES_DIR = "src/i18n/messages";
const SEGMENT = /^[A-Za-z][A-Za-z0-9_]*$/;
const ARG_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HTML = /<\/?[A-Za-z][^>]*>/;
const SOURCE = /^src\/.*\.(ts|tsx)$/;
const NOT_SOURCE = /(\/__tests__\/|\.test\.|\.spec\.|^src\/i18n\/messages\/|\.d\.ts$)/;

/**
 * Variables used by one message: {name} and {name, plural, one {...} other {...}}, at any depth.
 * A brace inside a plural or select starts a branch; anywhere else it starts a variable.
 */
export function parseMessage(message) {
  const problems = [];
  const args = new Set();
  const stack = [];
  for (let index = 0; index < message.length; index++) {
    const ch = message[index];
    if (ch === "'" && (message[index + 1] === "{" || message[index + 1] === "}")) {
      problems.push("an apostrophe before a brace escapes it; reword the message");
    }
    if (ch === "{") {
      const top = stack.at(-1);
      if (top?.branches) {
        stack.push({ branches: false });
        continue;
      }
      const header = /^\s*([^\s,{}]*)\s*(?:,\s*([A-Za-z]+))?/.exec(message.slice(index + 1));
      const name = header?.[1] ?? "";
      const type = header?.[2];
      if (!ARG_NAME.test(name)) problems.push(`"${name}" is not a valid variable name`);
      else args.add(name);
      stack.push({ branches: type === "plural" || type === "select" || type === "selectordinal" });
    } else if (ch === "}") {
      if (stack.length === 0) problems.push("a closing brace has no opening brace");
      else stack.pop();
    }
  }
  if (stack.length > 0) problems.push("an opening brace is never closed");
  return { args, problems };
}

/** Flatten nested objects to dotted keys, reporting shape problems on the way. */
function flatten(node, file, findings, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (!SEGMENT.test(key)) {
      findings.push(
        finding(file, 0, "MSG-KEY", `"${full}": keys are plain names (letters, digits, _)`),
      );
    }
    if (typeof value === "string") {
      out.set(full, value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      flatten(value, file, findings, full, out);
    } else {
      findings.push(finding(file, 0, "MSG-SHAPE", `"${full}" must be a string or an object`));
    }
  }
  return out;
}

function lineOfKey(text, key) {
  const last = key.split(".").at(-1);
  const index = text.indexOf(`"${last}"`);
  return index < 0 ? 0 : text.slice(0, index).split("\n").length;
}

function usedKeys(keys, files, root) {
  const literals = new Set();
  const prefixes = new Set();
  for (const file of files) {
    if (!SOURCE.test(file) || NOT_SOURCE.test(file)) continue;
    const text = readText(root, file);
    if (text === null) continue;
    for (const match of text.matchAll(/["'`]([A-Za-z0-9_.]+)["'`]/g))
      literals.add(`${file}\u0000${match[1]}`);
    for (const match of text.matchAll(/`([A-Za-z0-9_.]+\.)\$\{/g)) prefixes.add(match[1]);
    // direct reads of the file, as global-error does: en.errorPage.title
    for (const match of text.matchAll(/\b(?:en|messages)\.([A-Za-z0-9_.]+)/g)) {
      literals.add(`${file}\u0000${match[1]}`);
    }
  }
  const byFile = new Map();
  for (const entry of literals) {
    const [file, value] = entry.split("\u0000");
    if (!byFile.has(file)) byFile.set(file, new Set());
    byFile.get(file).add(value);
  }
  const used = new Set();
  for (const key of keys) {
    if ([...prefixes].some((prefix) => key.startsWith(prefix))) {
      used.add(key);
      continue;
    }
    const parts = key.split(".");
    for (const set of byFile.values()) {
      // the full key, or a namespace passed to the translator plus the rest as a second literal
      const found = parts.some((_, index) => {
        const namespace = parts.slice(0, index).join(".");
        const rest = parts.slice(index).join(".");
        return index === 0 ? set.has(rest) : set.has(namespace) && set.has(rest);
      });
      if (found) {
        used.add(key);
        break;
      }
    }
  }
  return used;
}

export function checkMessages({ root = repoRoot, files = listFiles(root) } = {}) {
  const findings = [];
  const dir = path.join(root, MESSAGES_DIR);
  const enRel = `${MESSAGES_DIR}/en.json`;
  if (!fs.existsSync(path.join(root, enRel))) {
    return [finding(enRel, 0, "MSG-FILE", "en.json is missing (ADR-035)")];
  }

  const loaded = new Map();
  for (const name of fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()) {
    const rel = `${MESSAGES_DIR}/${name}`;
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      findings.push(finding(rel, 0, "MSG-JSON", `not valid JSON: ${error.message}`));
      continue;
    }
    const flat = flatten(json, rel, findings);
    for (const [key, value] of flat) {
      const line = lineOfKey(text, key);
      if (value.trim() === "") findings.push(finding(rel, line, "MSG-EMPTY", `"${key}" is empty`));
      else if (value !== value.trim())
        findings.push(finding(rel, line, "MSG-SPACE", `"${key}" has leading or trailing spaces`));
      if (HTML.test(value))
        findings.push(
          finding(rel, line, "MSG-HTML", `"${key}" contains HTML; messages are plain text`),
        );
      for (const problem of parseMessage(value).problems) {
        findings.push(finding(rel, line, "MSG-ICU", `"${key}": ${problem}`));
      }
    }
    loaded.set(name, { rel, text, flat });
  }

  const en = loaded.get("en.json");
  if (!en) return findings;

  // other languages: same keys, same variables
  for (const [name, other] of loaded) {
    if (name === "en.json") continue;
    for (const [key, value] of en.flat) {
      if (!other.flat.has(key)) {
        findings.push(
          finding(other.rel, 0, "MSG-PARITY", `"${key}" is missing (it is in en.json)`),
        );
        continue;
      }
      const want = [...parseMessage(value).args].sort().join(",");
      const got = [...parseMessage(other.flat.get(key)).args].sort().join(",");
      if (want !== got) {
        findings.push(
          finding(
            other.rel,
            lineOfKey(other.text, key),
            "MSG-PARITY",
            `"${key}" uses variables {${got}} but en.json uses {${want}}`,
          ),
        );
      }
    }
    for (const key of other.flat.keys()) {
      if (!en.flat.has(key)) {
        findings.push(
          finding(
            other.rel,
            lineOfKey(other.text, key),
            "MSG-PARITY",
            `"${key}" is not in en.json`,
          ),
        );
      }
    }
  }

  // keys nobody reads
  const used = usedKeys([...en.flat.keys()], files, root);
  for (const key of en.flat.keys()) {
    if (!used.has(key)) {
      findings.push(
        finding(
          enRel,
          lineOfKey(en.text, key),
          "MSG-UNUSED",
          `"${key}" is not used anywhere in src/`,
        ),
      );
    }
  }
  return findings;
}

if (isMain(import.meta.url)) process.exit(printFindings("check-messages", checkMessages()));
