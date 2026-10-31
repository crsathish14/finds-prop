import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// R-DS-01: files made by `npx shadcn add` come with shadcn's own colour names, dark-mode classes
// and default text sizes. They must be re-themed to Grove tokens before they are committed.
const COMPONENTS_DIR = path.resolve(__dirname, "..");
const SHADCN_DEFAULTS = [
  /\b(?:bg|text|border|ring|fill|stroke|outline|divide)-(?:background|foreground|card|popover|secondary|accent|destructive|input|ring)(?:-foreground)?\b/,
  /-(?:primary|secondary|muted|accent|destructive|card|popover)-foreground\b/,
  /\bbg-muted\b/,
  /\bdark:/,
  /\bring-(?:\[|\d|offset)/,
  /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/,
  /\bshadow-(?:xs|sm|md|lg|xl|2xl)\b/,
  /\brounded-full\b/,
  /\bfocus-visible:ring/,
];

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("shared components carry no shadcn default styles", () => {
  const files = sourceFiles(COMPONENTS_DIR);

  it("finds the component files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((file) => [path.relative(COMPONENTS_DIR, file), file] as const))(
    "%s",
    (_name, file) => {
      const text = fs.readFileSync(file, "utf8");
      const found = SHADCN_DEFAULTS.flatMap((pattern) => text.match(pattern) ?? []);
      expect(found).toEqual([]);
    },
  );
});
