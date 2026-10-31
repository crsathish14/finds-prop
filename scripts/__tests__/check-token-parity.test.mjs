import { afterAll, describe, expect, it } from "vitest";
import { checkTokenParity, parseTokens, resolve } from "../check-token-parity.mjs";
import { cleanupTrees, makeTree, rules } from "./helpers.mjs";

afterAll(cleanupTrees);

const UX = `
:root { --c-bg: #FAF6EE; --c-line: rgba(250, 246, 238, .16); --gutter: 16px; }
@media (min-width: 768px) { :root { --gutter: 32px; } }
`;
const GOOD = `
:root { --p-ivory: #faf6ee; --c-bg: var(--p-ivory); --c-line: color-mix(in srgb, var(--p-ivory) 16%, transparent); --gutter: 16px; }
@media (min-width: 768px) { :root { --gutter: 32px; } }
`;

const run = (
  production,
  ux = UX,
  allow = [{ name: "--p-*", reason: "primitive layer for the tests" }],
) => {
  const root = makeTree({
    "src/styles/tokens.css": production,
    "docs/ux/final-ux/assets/tokens.css": ux,
    "scripts/policy/token-parity.json": JSON.stringify({ allow }),
  });
  return checkTokenParity({ root });
};

describe("G-04 check-token-parity", () => {
  it("passes when values resolve to the same result, through var() and color-mix()", () => {
    expect(run(GOOD)).toEqual([]);
  });

  it("reads each media query separately", () => {
    const tokens = parseTokens(UX);
    expect(resolve(tokens, "", "--gutter")).toBe("16px");
    expect(resolve(tokens, "@media (min-width: 768px)", "--gutter")).toBe("32px");
  });

  it("fails when a value differs", () => {
    const problems = run(GOOD.replace("#faf6ee", "#faf6ef"));
    expect(rules(problems)).toContain("PARITY-VALUE");
  });

  it("fails when a UX token is missing", () => {
    expect(rules(run(GOOD.replace("--gutter: 16px;", "")))).toContain("PARITY-MISSING");
  });

  it("fails when a media-query value differs", () => {
    expect(rules(run(GOOD.replace("--gutter: 32px", "--gutter: 30px")))).toContain("PARITY-VALUE");
  });

  it("fails on a token that is not in the UX file and not listed", () => {
    expect(rules(run(GOOD.replace(":root {", ":root { --c-new: red;")))).toContain("PARITY-EXTRA");
  });

  it("accepts a listed addition and rejects a listed entry with no reason or no match", () => {
    const withExtra = GOOD.replace(":root {", ":root { --c-new: red;");
    expect(
      run(withExtra, UX, [
        { name: "--p-*", reason: "primitive layer for the tests" },
        { name: "--c-new", reason: "added for a test of the allow list" },
      ]),
    ).toEqual([]);
    expect(
      rules(
        run(GOOD, UX, [
          { name: "--p-*", reason: "primitive layer for the tests" },
          { name: "--c-gone", reason: "this token does not exist" },
        ]),
      ),
    ).toEqual(["PARITY-ALLOW"]);
    expect(rules(run(GOOD, UX, [{ name: "--p-*", reason: "short" }]))).toEqual(["PARITY-ALLOW"]);
  });
});

describe("G-04 check-token-parity: the real files", () => {
  it("tokens.css matches the approved UX tokens", () => {
    expect(checkTokenParity()).toEqual([]);
  });
});
