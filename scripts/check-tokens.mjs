// G-04 Tokens (part 1): no hard-coded visual values outside src/styles/ (plan 04 section 2.13).
//  - TOK-COLOR      hex, rgb(), hsl(), oklch() and similar colour literals
//  - TOK-ARBITRARY  Tailwind arbitrary values with a unit, such as p-[13px] or text-[14px] or bg-[#fff]
//  - TOK-STYLE      inline style={{ ... }} with a literal colour, spacing or type value
//  - TOK-SPACING    a padding, margin, gap or space step outside the 4 px scale
//  - TOK-PALETTE    a class from Tailwind's default palette, such as bg-gray-100 or text-white
//  - TOK-BREAKPOINT the sm: and 2xl: prefixes (only md, lg, xl and portal exist)
// Waivers go in scripts/policy/allowlist.json with the rule id.
// Usage: node scripts/check-tokens.mjs
import {
  finding,
  isMain,
  lineOf,
  listFiles,
  loadAllowlist,
  printFindings,
  readText,
  repoRoot,
} from "./lib/core.mjs";

const SCANNED = /^src\/.*\.(ts|tsx|css|mdx)$/;
const SKIPPED = /^src\/styles\/|\/__tests__\/|\.test\.|\.d\.ts$|database\.types\.ts$/;

const SCALE_STEPS = new Set(["0", "1", "2", "3", "4", "5", "6", "8", "10", "14", "18", "24", "px"]);
const SPACING_UTILITY =
  "p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y";
const PALETTE_NAMES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PALETTE_PREFIXES =
  "bg|text|border|border-[xytrblse]|ring|ring-offset|fill|stroke|from|via|to|divide|outline|decoration|shadow|accent|caret|placeholder";

const COLOR_HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const COLOR_FUNCTION = /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/g;
const ARBITRARY_UNIT =
  /(?<![\w-])-?[a-z][a-z0-9-]*-\[[^\]\s]*?\d(?:px|rem|em)\b[^\]\s]*\]|(?<![\w-])-?(?:bg|text|border|fill|stroke|ring|from|via|to|shadow)-\[#[^\]\s]*\]/g;
const SPACING = new RegExp(
  `(?<![\\w-])-?(?:${SPACING_UTILITY})-(\\d+(?:\\.\\d+)?|px)(?![\\w./\\[-])`,
  "g",
);
const PALETTE = new RegExp(
  `(?<![\\w-])(?:${PALETTE_PREFIXES})-(?:(?:${PALETTE_NAMES})-\\d{2,3}|black|white)(?![\\w-])`,
  "g",
);
const BREAKPOINT = /(?<![\w-])(?:sm|2xl):[a-z!\[-]/g;
const STYLE_ATTRIBUTE = /style=\{\{([^}]*)\}\}/g;
const STYLE_PROPERTY =
  /\b(?:color|backgroundColor|background|borderColor|border|fontSize|fontFamily|fontWeight|lineHeight|padding\w*|margin\w*|gap|boxShadow|borderRadius)\s*:\s*(?!\s|["'`]var\()/;

/** Lines that are comments carry examples and rule text; code on the same line is still scanned. */
function codePart(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return "";
  return line.replace(/\s\/\/\s.*$/, "").replace(/\/\*.*?\*\//g, "");
}

function* matches(text, pattern) {
  pattern.lastIndex = 0;
  let found;
  while ((found = pattern.exec(text)) !== null) yield found;
}

export function checkTokens({ root = repoRoot, files = listFiles(root) } = {}) {
  const { problems, isAllowed } = loadAllowlist(root);
  const findings = [...problems];
  const add = (file, line, rule, message) => {
    if (!isAllowed(file, rule)) findings.push(finding(file, line, rule, message));
  };

  for (const file of files) {
    if (!SCANNED.test(file) || SKIPPED.test(file)) continue;
    const text = readText(root, file);
    if (text === null) continue;
    const code = text.split("\n").map(codePart).join("\n");

    for (const hit of matches(code, COLOR_HEX)) {
      add(
        file,
        lineOf(code, hit.index),
        "TOK-COLOR",
        `${hit[0]} is a colour literal; use a colour token class`,
      );
    }
    for (const hit of matches(code, COLOR_FUNCTION)) {
      add(
        file,
        lineOf(code, hit.index),
        "TOK-COLOR",
        `${hit[0]}) is a colour literal; use a colour token class`,
      );
    }
    for (const hit of matches(code, ARBITRARY_UNIT)) {
      add(
        file,
        lineOf(code, hit.index),
        "TOK-ARBITRARY",
        `${hit[0]} is an arbitrary value; use a token class or var(--token)`,
      );
    }
    for (const hit of matches(code, STYLE_ATTRIBUTE)) {
      if (STYLE_PROPERTY.test(hit[1])) {
        add(
          file,
          lineOf(code, hit.index),
          "TOK-STYLE",
          "inline style with a literal value; use token classes (var(--token) is allowed)",
        );
      }
    }
    for (const hit of matches(code, SPACING)) {
      if (!SCALE_STEPS.has(hit[1])) {
        add(
          file,
          lineOf(code, hit.index),
          "TOK-SPACING",
          `${hit[0]} is off the spacing scale (steps 1 2 3 4 5 6 8 10 14 18 24)`,
        );
      }
    }
    for (const hit of matches(code, PALETTE)) {
      add(
        file,
        lineOf(code, hit.index),
        "TOK-PALETTE",
        `${hit[0]} is from Tailwind's default palette; use a token colour`,
      );
    }
    for (const hit of matches(code, BREAKPOINT)) {
      add(
        file,
        lineOf(code, hit.index),
        "TOK-BREAKPOINT",
        `${hit[0].slice(0, -1)} is not a breakpoint here (md, lg, xl, portal)`,
      );
    }
  }
  return findings;
}

if (isMain(import.meta.url)) process.exit(printFindings("check-tokens", checkTokens()));
