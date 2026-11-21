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
  ["--c-danger-text", "--c-danger-bg", 4.5],
  ["--c-danger", "--c-surface", 4.5],
  ["--c-on-primary", "--c-danger", 4.5],
  ["--c-muted", "--c-primary-tint", 4.5],
  ["--c-muted", "--c-neutral-bg", 4.5],
  ["--c-on-amber", "--c-amber", 4.5],
  ["--c-info", "--c-info-bg", 4.5],
  ["--c-neutral", "--c-neutral-bg", 4.5],
  ["--c-on-primary", "--c-ink", 4.5],
  ["--c-on-dark", "--c-dark", 4.5],
  ["--c-on-dark-muted", "--c-dark", 4.5],
  ["--c-on-dark-accent", "--c-dark", 4.5],
  ["--c-on-dark", "--c-dark-active", 4.5],
  // The other surfaces the same text colours sit on (cards, sunken bands, tints, hover tints)
  ["--c-subtle", "--c-surface", 4.5],
  ["--c-subtle", "--c-bg-sunken", 4.5],
  ["--c-primary", "--c-surface", 4.5],
  ["--c-primary", "--c-bg-sunken", 4.5],
  ["--c-primary-hover", "--c-primary-tint", 4.5],
  ["--c-muted", "--c-primary-tint-2", 4.5],
  ["--c-ink", "--c-bg-sunken", 4.5],
  ["--c-ink", "--c-primary-tint", 4.5],
  ["--c-ink", "--c-primary-tint-2", 4.5],
  ["--c-ink", "--c-neutral-bg", 4.5],
  ["--c-ink", "--c-success-bg", 4.5],
  ["--c-ink", "--c-warning-bg", 4.5],
  ["--c-ink", "--c-danger-bg", 4.5],
  ["--c-on-dark-muted", "--c-dark-active", 4.5],
  // The AI calls to action (header pill, search card link, "Ask about" button, bottom-bar disc)
  // are accent text on white, on the light tint and on its hover tint.
  ["--c-accent-text", "--c-surface", 4.5],
  ["--c-accent-text", "--c-bg-sunken", 4.5],
  ["--c-accent-text", "--c-accent-tint-2", 4.5],
  // Status text on a white card, and the red error text (the red background uses danger-text)
  ["--c-success", "--c-surface", 4.5],
  ["--c-warning", "--c-surface", 4.5],
  ["--c-info", "--c-surface", 4.5],
  ["--c-neutral", "--c-surface", 4.5],
  ["--c-danger-text", "--c-surface", 4.5],
];

// Left out on purpose. --c-disabled is a disabled control, which WCAG 1.4.3 exempts. --c-border and
// --c-border-strong are decorative lines (a control is identified by --c-border-input, below).
// --c-amber is only ever a fill with --c-on-amber on it (listed above), never text or an icon on white.
// --c-danger on --c-danger-bg is 4.4 : 1: red text on that tint uses --c-danger-text instead.

const NON_TEXT_PAIRS = [
  // Icons, links' marks and control outlines against the surfaces they sit on
  ["--c-primary", "--c-bg", 3],
  ["--c-primary", "--c-primary-tint", 3],
  ["--c-primary", "--c-primary-tint-2", 3],
  ["--c-accent", "--c-bg", 3],
  ["--c-border-input", "--c-bg", 3],
  ["--c-border-input", "--c-primary-tint", 3],
  ["--c-focus", "--c-surface", 3],
  ["--c-focus", "--c-bg-sunken", 3],
  ["--c-focus", "--c-primary-tint-2", 3],
  ["--c-focus", "--c-neutral-bg", 3],
  ["--c-on-dark-accent", "--c-dark-active", 3],
  // Status icons on their own tint and on white
  ["--c-success", "--c-success-bg", 3],
  ["--c-warning", "--c-warning-bg", 3],
  ["--c-danger", "--c-danger-bg", 3],
  ["--c-info", "--c-info-bg", 3],
  ["--c-success", "--c-surface", 3],
  ["--c-danger", "--c-surface", 3],
  // Chart marks on a white card
  ["--c-series-1", "--c-surface", 3],
  ["--c-series-2", "--c-surface", 3],
  ["--c-series-3", "--c-surface", 3],
  ["--c-series-4", "--c-surface", 3],
  ["--c-series-other", "--c-surface", 3],
  ["--c-border-input", "--c-surface", 3],
  ["--c-border-input", "--c-bg-sunken", 3],
  ["--c-focus", "--c-bg", 3],
  ["--c-focus", "--c-primary-tint", 3],
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

  it("matches the measured value the brand documents for white on action teal", () => {
    const ratio = contrastRatio(colour("--c-on-accent"), colour("--c-accent"));
    expect(ratio).toBeGreaterThan(5.1);
    expect(ratio).toBeLessThan(5.3);
  });

  it("keeps brand teal off white: it is only for ink surfaces (2.5 : 1 on white)", () => {
    const ratio = contrastRatio(colour("--p-teal-500"), colour("--c-surface"));
    expect(ratio).toBeLessThan(3);
    expect(colour("--c-on-dark-accent")).toBe(colour("--p-teal-500"));
  });
});
