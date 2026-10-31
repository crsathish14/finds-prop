import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/lib/contrast.ts";
import { parseTokens, resolve } from "../check-token-parity.mjs";
import { repoRoot } from "../lib/core.mjs";

// UT-tokens: every text pair the design relies on is readable. The numbers are the ones the UX
// measured (design-system.md); a token change that breaks one fails here, not in front of a reader.
const tokens = parseTokens(fs.readFileSync(path.join(repoRoot, "src/styles/tokens.css"), "utf8"));
const colour = (name) => resolve(tokens, "", name);

const TEXT_PAIRS = [
  ["--c-ink", "--c-bg", 4.5],
  ["--c-ink", "--c-surface", 4.5],
  ["--c-muted", "--c-bg", 4.5],
  ["--c-muted", "--c-surface", 4.5],
  ["--c-muted", "--c-bg-sunken", 4.5],
  ["--c-subtle", "--c-bg", 4.5],
  ["--c-primary", "--c-bg", 4.5],
  ["--c-primary", "--c-primary-tint", 4.5],
  ["--c-on-primary", "--c-primary", 4.5],
  ["--c-on-primary", "--c-primary-hover", 4.5],
  ["--c-on-accent", "--c-accent", 4.5],
  ["--c-on-accent", "--c-accent-hover", 4.5],
  ["--c-accent-text", "--c-bg", 4.5],
  ["--c-accent-text", "--c-accent-tint", 4.5],
  ["--c-success", "--c-success-bg", 4.5],
  ["--c-warning", "--c-warning-bg", 4.5],
  ["--c-danger", "--c-danger-bg", 4.5],
  ["--c-danger", "--c-surface", 4.5],
  ["--c-info", "--c-info-bg", 4.5],
  ["--c-neutral", "--c-neutral-bg", 4.5],
  ["--c-on-primary", "--c-ink", 4.5],
  ["--c-on-dark", "--c-dark", 4.5],
  ["--c-on-dark-muted", "--c-dark", 4.5],
  ["--c-on-dark-accent", "--c-dark", 4.5],
  ["--c-on-dark", "--c-dark-active", 4.5],
];

const NON_TEXT_PAIRS = [
  ["--c-border-input", "--c-surface", 3],
  ["--c-focus", "--c-bg", 3],
  ["--c-focus-on-dark", "--c-dark", 3],
];

describe("UT-tokens: contrast of the colour pairs", () => {
  it.each(TEXT_PAIRS)("%s on %s is at least %d : 1", (foreground, background, minimum) => {
    const ratio = contrastRatio(colour(foreground), colour(background));
    expect(ratio, `${foreground} on ${background}`).not.toBeNull();
    expect(ratio).toBeGreaterThanOrEqual(minimum);
  });

  it.each(NON_TEXT_PAIRS)(
    "%s against %s is at least %d : 1 (borders and focus)",
    (foreground, background, minimum) => {
      expect(contrastRatio(colour(foreground), colour(background))).toBeGreaterThanOrEqual(minimum);
    },
  );

  it("matches the measured value the UX documents for white on copper", () => {
    const ratio = contrastRatio(colour("--c-on-accent"), colour("--c-accent"));
    expect(ratio).toBeGreaterThan(4.7);
    expect(ratio).toBeLessThan(4.9);
  });
});
