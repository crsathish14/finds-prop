// G-04 Tokens (part 2): src/styles/tokens.css must equal the approved UX file (plan 04 section 2.12).
// Every custom property of the UX file is resolved to its final value (var() chains followed, colours
// normalised) and compared by name, separately for each media query. Differences and additions
// must be listed, with a reason, in scripts/policy/token-parity.json.
//  - PARITY-MISSING   a UX token has no production token
//  - PARITY-VALUE     the values differ
//  - PARITY-EXTRA     a production token is not in the UX file and is not listed
//  - PARITY-ALLOW     an allow entry has no reason, or matches nothing
// Usage: node scripts/check-token-parity.mjs
import fs from "node:fs";
import path from "node:path";
import { finding, isMain, printFindings, readJson, repoRoot } from "./lib/core.mjs";

export const PRODUCTION_FILE = "src/styles/tokens.css";
export const UX_FILE = "docs/ux/final-ux/assets/tokens.css";
export const ALLOW_FILE = "scripts/policy/token-parity.json";

/** Custom properties by "media|--name". The media part is empty for the base :root block. */
export function parseTokens(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = new Map();
  const stack = [];
  let buffer = "";
  for (const character of text) {
    if (character === "{") {
      stack.push(buffer.trim().replace(/\s+/g, " "));
      buffer = "";
    } else if (character === "}") {
      stack.pop();
      buffer = "";
    } else if (character === ";") {
      const declaration = /^\s*(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(buffer);
      if (declaration && stack.at(-1) === ":root") {
        const media = stack.find((selector) => selector.startsWith("@media")) ?? "";
        tokens.set(`${media}|${declaration[1]}`, declaration[2].trim());
      }
      buffer = "";
    } else buffer += character;
  }
  return tokens;
}

function normalise(value) {
  let result = value.toLowerCase().replace(/\s+/g, " ").trim();
  // color-mix(in srgb, #faf6ee 16%, transparent) is the same colour as rgba(250, 246, 238, 0.16)
  result = result.replace(
    /color-mix\(in srgb, #([0-9a-f]{6}) (\d+(?:\.\d+)?)%, transparent\)/g,
    (_whole, hex, percent) => {
      const channels = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
      return `rgba(${channels.join(", ")}, ${Number(percent) / 100})`;
    },
  );
  result = result.replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/g, "#$1$1$2$2$3$3");
  result = result.replace(/\d*\.\d+/g, (number) => String(Number(number)));
  result = result.replaceAll("'", '"');
  return result.replace(/\s*,\s*/g, ", ");
}

/** Follow var(--x) chains. A media block falls back to the base block for names it does not set. */
export function resolve(tokens, media, name, seen = new Set()) {
  const raw = tokens.get(`${media}|${name}`) ?? tokens.get(`|${name}`);
  if (raw === undefined || seen.has(name)) return undefined;
  const nextSeen = new Set(seen).add(name);
  let broken = false;
  const value = raw.replace(/var\((--[\w-]+)\)/g, (_whole, inner) => {
    const found = resolve(tokens, media, inner, nextSeen);
    if (found === undefined) broken = true;
    return found ?? "";
  });
  return broken ? undefined : normalise(value);
}

function describeAllow(entry) {
  return entry.name ?? "(no name)";
}

function allowMatches(entry, name) {
  if (!entry.name) return false;
  return entry.name.endsWith("*") ? name.startsWith(entry.name.slice(0, -1)) : entry.name === name;
}

export function checkTokenParity({ root = repoRoot } = {}) {
  const findings = [];
  const uxPath = path.join(root, UX_FILE);
  const productionPath = path.join(root, PRODUCTION_FILE);
  if (!fs.existsSync(uxPath))
    return [finding(UX_FILE, 0, "PARITY-MISSING", "UX token snapshot not found")];
  if (!fs.existsSync(productionPath))
    return [finding(PRODUCTION_FILE, 0, "PARITY-MISSING", "tokens file not found")];

  const ux = parseTokens(fs.readFileSync(uxPath, "utf8"));
  const production = parseTokens(fs.readFileSync(productionPath, "utf8"));
  const allow = readJson(root, ALLOW_FILE, { allow: [] }).allow ?? [];
  const used = new Set();
  const allowed = (name) => {
    const entry = allow.find((candidate) => allowMatches(candidate, name));
    if (entry) used.add(entry);
    return Boolean(entry);
  };

  for (const entry of allow) {
    if (!entry.reason || String(entry.reason).length < 10) {
      findings.push(
        finding(
          ALLOW_FILE,
          0,
          "PARITY-ALLOW",
          `${describeAllow(entry)}: add a reason of at least 10 characters`,
        ),
      );
    }
  }

  for (const key of ux.keys()) {
    const [media, name] = key.split("|");
    if (allowed(name)) continue;
    const want = resolve(ux, media, name);
    const got = resolve(production, media, name);
    const where = media ? `${name} in ${media}` : name;
    if (got === undefined) {
      findings.push(
        finding(PRODUCTION_FILE, 0, "PARITY-MISSING", `${where} is in the UX file but not here`),
      );
    } else if (want !== got) {
      findings.push(
        finding(
          PRODUCTION_FILE,
          0,
          "PARITY-VALUE",
          `${where} is "${got}" here but "${want}" in the UX file`,
        ),
      );
    }
  }

  const uxNames = new Set([...ux.keys()].map((key) => key.split("|")[1]));
  for (const key of production.keys()) {
    const [, name] = key.split("|");
    if (!uxNames.has(name) && !allowed(name)) {
      findings.push(
        finding(
          PRODUCTION_FILE,
          0,
          "PARITY-EXTRA",
          `${name} is not in the UX file; add it to ${ALLOW_FILE} with a reason`,
        ),
      );
    }
  }

  for (const entry of allow) {
    if (!used.has(entry)) {
      findings.push(
        finding(
          ALLOW_FILE,
          0,
          "PARITY-ALLOW",
          `${describeAllow(entry)} matches no token; remove it`,
        ),
      );
    }
  }
  return [...new Map(findings.map((item) => [`${item.rule}${item.message}`, item])).values()];
}

if (isMain(import.meta.url)) process.exit(printFindings("check-token-parity", checkTokenParity()));
