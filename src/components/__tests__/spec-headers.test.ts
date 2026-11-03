import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAB_BOARDS } from "@/design-lab/registry";

// R-DS-03 and design-system.md section 7.1: every shared component carries a specification header
// that says what it is for, what it takes, how it behaves on each screen, how it is made
// accessible, its states, what it builds on, how it is tested and where the design comes from.
const COMPONENTS_DIR = path.resolve(__dirname, "..");
const LAYERS = ["ui", "patterns", "layout", "domain"];
const NOT_COMPONENTS = new Set(["layout/nav-types.ts"]);
const REQUIRED_PARTS = [
  "Purpose",
  "Props",
  "Responsive",
  "Accessibility",
  "States",
  "Dependencies",
  "Tests",
  "UX reference",
];

const files = LAYERS.flatMap((layer) =>
  fs
    .readdirSync(path.join(COMPONENTS_DIR, layer), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => `${layer}/${entry.name}`),
).filter((file) => !NOT_COMPONENTS.has(file));

function headerOf(file: string): string {
  const text = fs.readFileSync(path.join(COMPONENTS_DIR, file), "utf8");
  // The header is the first block comment (a "use client" line may come before it).
  return /\/\*\*([\s\S]*?)\*\//.exec(text)?.[1] ?? "";
}

function testFilesExist(): Set<string> {
  const found = new Set<string>();
  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.test\.tsx?$/.test(entry.name)) found.add(entry.name);
    }
  };
  walk(path.resolve(COMPONENTS_DIR, ".."));
  return found;
}

describe("component specification headers", () => {
  it("finds the shared components", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files)("%s has every part of the header", (file) => {
    const header = headerOf(file);
    const missing = REQUIRED_PARTS.filter((part) => !new RegExp(`${part}:`).test(header));
    expect(missing, `parts missing from the header of ${file}`).toEqual([]);
  });

  it.each(files)("%s says what the component is for, in a full sentence", (file) => {
    const header = headerOf(file);
    const purpose = /Purpose:([\s\S]*?)(?:Props:|Owner:)/.exec(header)?.[1] ?? "";
    expect(purpose.replace(/[\s*]+/g, " ").trim().length).toBeGreaterThan(20);
  });

  it("only names test files that exist", () => {
    const existing = testFilesExist();
    const unknown: string[] = [];
    for (const file of files) {
      const named = headerOf(file).match(/[\w-]+\.test\.tsx?/g) ?? [];
      for (const name of named) if (!existing.has(name)) unknown.push(`${file}: ${name}`);
    }
    expect(unknown, "headers naming a test file that does not exist").toEqual([]);
  });

  it("only names Design Lab pages that exist", () => {
    // A header may name a board ("Navigation") or an entry on one ("Card parts"; the start of an
    // entry name is enough, so "Badges" finds "Badges and statuses"). The lab registry is the truth.
    const boardTitles = LAB_BOARDS.map((board) => board.title);
    const entryNames = LAB_BOARDS.flatMap((board) => board.entries.map((entry) => entry.name));
    const unknown: string[] = [];
    for (const file of files) {
      for (const match of headerOf(file).matchAll(/Design Lab "([^"]+)"/g)) {
        const name = match[1] ?? "";
        const exists =
          boardTitles.includes(name) || entryNames.some((entry) => entry.startsWith(name));
        if (!exists) unknown.push(`${file}: ${name}`);
      }
    }
    expect(unknown, "headers naming a Design Lab page that does not exist").toEqual([]);
  });
});
