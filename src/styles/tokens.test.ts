import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// UT-tokens: the three style files agree with each other. Parity with the approved UX file is
// checked by scripts/check-token-parity.mjs.
const read = (name: string) => fs.readFileSync(path.join(__dirname, name), "utf8");
const tokens = read("tokens.css");
const theme = read("theme.css");
const globals = read("globals.css");

// Defined at runtime by next/font on <html> (src/styles/fonts.ts)
const FONT_FILE_VARIABLES = ["--font-plex-serif", "--font-plex-sans", "--font-noto-sans-tamil"];
const defined = new Set([
  ...[...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]),
  ...FONT_FILE_VARIABLES,
]);
const themeDefined = new Set([...theme.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
const used = (css: string) =>
  [...css.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1] ?? "");

describe("UT-tokens", () => {
  it("every variable read in tokens.css is defined there", () => {
    const missing = used(tokens).filter((name) => !defined.has(name));
    expect(missing).toEqual([]);
  });

  it("every variable read in theme.css or globals.css is a token", () => {
    const known = new Set([...defined, ...themeDefined]);
    const missing = [...used(theme), ...used(globals)].filter((name) => !known.has(name));
    expect(missing).toEqual([]);
  });

  it("theme.css and globals.css never name a primitive", () => {
    expect([...used(theme), ...used(globals)].filter((name) => name.startsWith("--p-"))).toEqual(
      [],
    );
  });

  it("removes Tailwind's default palette, breakpoints, radii and shadows", () => {
    for (const reset of ["--color-*", "--breakpoint-*", "--radius-*", "--shadow-*"]) {
      expect(theme).toContain(`${reset}: initial;`);
    }
  });

  it("exposes only the breakpoints md, lg, xl and portal", () => {
    const names = [...theme.matchAll(/--breakpoint-([a-z]+):/g)].map((match) => match[1]);
    expect(names.sort()).toEqual(["lg", "md", "portal", "xl"]);
  });

  it("keeps the spacing scale on the 4 px base", () => {
    const steps = [...tokens.matchAll(/--s-(\d+):\s*(\d+)px/g)].map((match) => ({
      step: Number(match[1]),
      pixels: Number(match[2]),
    }));
    expect(steps).toHaveLength(11);
    for (const { step, pixels } of steps) expect(pixels).toBe(step * 4);
  });
});
