import { afterAll, describe, expect, it } from "vitest";
import { checkTokens } from "../check-tokens.mjs";
import { cleanupTrees, makeTree, rules } from "./helpers.mjs";

afterAll(cleanupTrees);

const run = (files) => {
  const root = makeTree(files);
  return checkTokens({ root, files: Object.keys(files) });
};
const component = (className) => ({
  "src/components/ui/thing.tsx": `export const Thing = () => <div className="${className}" />;\n`,
});

describe("G-04 check-tokens: allowed code", () => {
  it("passes token classes, on-scale spacing and var() arbitrary values", () => {
    expect(
      run(
        component(
          "bg-surface text-ink p-4 md:px-6 -mt-2 gap-x-3 py-14 h-[var(--size-control)] w-[calc(100%-var(--gutter))] border-line",
        ),
      ),
    ).toEqual([]);
  });

  it("ignores src/styles, tests and comments", () => {
    expect(
      run({
        "src/styles/tokens.css": ":root { --c-bg: #faf6ee; }\n",
        "src/components/ui/thing.test.tsx": 'const x = "bg-gray-100 p-7";\n',
        "src/components/ui/other.ts": "// avoid bg-gray-100 and #fff here\nexport const a = 1;\n",
      }),
    ).toEqual([]);
  });

  it("does not mistake an issue number in a comment or an anchor name for a colour", () => {
    expect(
      run({ "src/lib/a.ts": 'export const link = "/search#results";\n// see #123\n' }),
    ).toEqual([]);
  });
});

describe("G-04 check-tokens: negative tests", () => {
  it("fails on colour literals", () => {
    expect(rules(run({ "src/lib/a.ts": 'export const c = "#1F4A38";\n' }))).toEqual(["TOK-COLOR"]);
    expect(rules(run({ "src/lib/a.ts": 'export const c = "rgb(1, 2, 3)";\n' }))).toEqual([
      "TOK-COLOR",
    ]);
    expect(rules(run({ "src/lib/a.ts": 'export const c = "hsl(10 20% 30%)";\n' }))).toEqual([
      "TOK-COLOR",
    ]);
  });

  it("fails on arbitrary values with a unit or a colour", () => {
    expect(rules(run(component("p-[13px]")))).toEqual(["TOK-ARBITRARY"]);
    expect(rules(run(component("text-[14px]")))).toEqual(["TOK-ARBITRARY"]);
    expect(rules(run(component("bg-[#fff]")))).toContain("TOK-ARBITRARY");
    expect(rules(run(component("w-[3.5rem]")))).toEqual(["TOK-ARBITRARY"]);
  });

  it("fails on spacing off the scale, including negative and responsive forms", () => {
    expect(rules(run(component("p-7")))).toEqual(["TOK-SPACING"]);
    expect(rules(run(component("md:gap-9 -mt-12")))).toEqual(["TOK-SPACING", "TOK-SPACING"]);
    expect(rules(run(component("space-y-16")))).toEqual(["TOK-SPACING"]);
    expect(rules(run(component("py-0.5")))).toEqual(["TOK-SPACING"]);
  });

  it("fails on the default palette, black and white", () => {
    expect(rules(run(component("bg-gray-100")))).toEqual(["TOK-PALETTE"]);
    expect(rules(run(component("hover:text-red-500")))).toEqual(["TOK-PALETTE"]);
    expect(rules(run(component("text-white border-black")))).toEqual([
      "TOK-PALETTE",
      "TOK-PALETTE",
    ]);
  });

  it("fails on the sm and 2xl breakpoints", () => {
    expect(rules(run(component("sm:flex")))).toEqual(["TOK-BREAKPOINT"]);
    expect(rules(run(component("2xl:p-4")))).toEqual(["TOK-BREAKPOINT"]);
    expect(run(component("md:flex lg:p-4 xl:p-4 portal:block"))).toEqual([]);
  });

  it("fails on inline styles with literal values, accepts var() values", () => {
    expect(
      rules(run({ "src/a.tsx": 'export const a = <p style={{ color: "red" }}>x</p>;\n' })),
    ).toContain("TOK-STYLE");
    expect(
      rules(run({ "src/a.tsx": 'export const a = <p style={{ margin: "4rem auto" }}>x</p>;\n' })),
    ).toContain("TOK-STYLE");
    expect(
      run({ "src/a.tsx": 'export const a = <p style={{ color: "var(--c-ink)" }}>x</p>;\n' }),
    ).toEqual([]);
  });

  it("reports the file and line", () => {
    const [problem] = run({ "src/lib/a.ts": 'const a = 1;\nexport const c = "#1F4A38";\n' });
    expect(problem).toMatchObject({ file: "src/lib/a.ts", line: 2, rule: "TOK-COLOR" });
  });
});
