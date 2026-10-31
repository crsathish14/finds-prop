import { afterAll, describe, expect, it } from "vitest";
import { checkDeps, diffDependencies } from "../check-deps.mjs";
import { cleanupTrees, makeTree, rules } from "./helpers.mjs";

afterAll(cleanupTrees);

const lock = (packages = {}) =>
  JSON.stringify({ lockfileVersion: 3, packages: { "": {}, ...packages } });
const run = (manifest, packages = {}, extra = {}) => {
  const root = makeTree({
    "package.json": JSON.stringify(manifest),
    "package-lock.json": lock(packages),
    ...extra,
  });
  return checkDeps({ root }).findings;
};

describe("G-11 check-deps", () => {
  it("passes a clean manifest and lockfile", () => {
    expect(
      run(
        { dependencies: { zod: "4.6.7" }, devDependencies: { vitest: "5.0.5" } },
        { "node_modules/zod": { version: "4.6.7", license: "MIT" } },
      ),
    ).toEqual([]);
  });

  it("rejects another package manager's lockfile", () => {
    expect(rules(run({ dependencies: {} }, {}, { "yarn.lock": "" }))).toContain("DEP-LOCKFILE");
  });

  it("rejects a missing package-lock.json", () => {
    const root = makeTree({ "package.json": JSON.stringify({}) });
    expect(rules(checkDeps({ root }).findings)).toContain("DEP-LOCKFILE");
  });

  it("rejects a packageManager field that names another tool", () => {
    expect(rules(run({ packageManager: "pnpm@9.0.0" }))).toContain("DEP-LOCKFILE");
    expect(run({ packageManager: "npm@11.8.0" })).toEqual([]);
  });

  it("rejects version ranges", () => {
    expect(rules(run({ dependencies: { zod: "^4.6.7" } }))).toContain("DEP-EXACT");
    expect(rules(run({ devDependencies: { vitest: "~5.0.0" } }))).toContain("DEP-EXACT");
  });

  it("rejects banned packages by name and by scope", () => {
    expect(rules(run({ dependencies: { zustand: "5.0.0" } }))).toContain("DEP-BANNED");
    expect(rules(run({ dependencies: { "@mui/material": "7.0.0" } }))).toContain("DEP-BANNED");
    expect(rules(run({ devDependencies: { "@storybook/react": "9.0.0" } }))).toContain(
      "DEP-BANNED",
    );
  });

  it("rejects an install script that is not approved by name", () => {
    expect(
      rules(
        run(
          {},
          { "node_modules/evil": { version: "1.0.0", license: "MIT", hasInstallScript: true } },
        ),
      ),
    ).toContain("DEP-INSTALL-SCRIPT");
    expect(
      run(
        {},
        { "node_modules/lefthook": { version: "2.0.0", license: "MIT", hasInstallScript: true } },
      ),
    ).toEqual([]);
  });

  it("rejects strong copyleft and unknown licences, and unapproved weak copyleft", () => {
    expect(
      rules(run({}, { "node_modules/a": { version: "1.0.0", license: "GPL-3.0" } })),
    ).toContain("DEP-LICENCE");
    expect(
      rules(run({}, { "node_modules/a": { version: "1.0.0", license: "SSPL-1.0" } })),
    ).toContain("DEP-LICENCE");
    expect(
      rules(run({}, { "node_modules/a": { version: "1.0.0", license: "MPL-2.0" } })),
    ).toContain("DEP-LICENCE");
    expect(rules(run({}, { "node_modules/a": { version: "1.0.0" } }))).toContain("DEP-LICENCE");
  });

  it("accepts approved weak copyleft and compound expressions", () => {
    expect(run({}, { "node_modules/axe-core": { version: "4.0.0", license: "MPL-2.0" } })).toEqual(
      [],
    );
    expect(
      run(
        {},
        {
          "node_modules/@img/sharp-win32-x64": {
            version: "1.0.0",
            license: "Apache-2.0 AND LGPL-3.0-or-later",
          },
        },
      ),
    ).toEqual([]);
    expect(
      run({}, { "node_modules/a": { version: "1.0.0", license: "(MIT OR GPL-3.0)" } }),
    ).toEqual([]);
  });
});

describe("G-11 dependency diff", () => {
  it("reports added, changed and removed packages", () => {
    const base = { dependencies: { a: "1.0.0", b: "1.0.0" }, devDependencies: { c: "1.0.0" } };
    const current = { dependencies: { a: "1.1.0", d: "2.0.0" }, devDependencies: { c: "1.0.0" } };
    const diff = diffDependencies(base, current);
    expect(diff.added.map((d) => d.name)).toEqual(["d"]);
    expect(diff.changed).toEqual([{ name: "a", from: "1.0.0", to: "1.1.0" }]);
    expect(diff.removed.map((d) => d.name)).toEqual(["b"]);
  });
});
