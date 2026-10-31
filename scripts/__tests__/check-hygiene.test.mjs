import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkHygiene } from "../check-hygiene.mjs";
import { cleanupTrees, makeTree, rules } from "./helpers.mjs";

afterAll(cleanupTrees);

const run = (files, extra = {}) => {
  const root = makeTree(files);
  return checkHygiene({ root, files: Object.keys(files), ...extra });
};

describe("G-14 check-hygiene: escape hatches", () => {
  it("accepts an eslint-disable with a rule and a reason", () => {
    expect(
      run({
        "src/a.ts":
          "// eslint-disable-next-line no-console -- logging is wired through the logger in S3\nconsole.log(1);\n",
      }),
    ).toEqual([]);
  });

  it("rejects an eslint-disable without a reason", () => {
    expect(rules(run({ "src/a.ts": "// eslint-disable-next-line no-console\nx();\n" }))).toContain(
      "HYG-ESLINT-DISABLE",
    );
  });

  it("rejects a blanket eslint-disable", () => {
    expect(rules(run({ "src/a.ts": "/* eslint-disable */\nx();\n" }))).toContain(
      "HYG-ESLINT-DISABLE",
    );
  });

  it("rejects @ts-ignore and a short @ts-expect-error, accepts a described one", () => {
    expect(rules(run({ "src/a.ts": "// @ts-ignore\nx();\n" }))).toContain("HYG-TS-COMMENT");
    expect(rules(run({ "src/a.ts": "// @ts-expect-error oops\nx();\n" }))).toContain(
      "HYG-TS-COMMENT",
    );
    expect(
      run({
        "src/a.ts":
          "// @ts-expect-error third-party types are wrong for this call (library #42)\nx();\n",
      }),
    ).toEqual([]);
  });

  it("requires an issue number on TODO, FIXME and HACK", () => {
    expect(rules(run({ "src/a.ts": "// TODO fix later\n" }))).toContain("HYG-TODO");
    expect(rules(run({ "src/a.ts": "// FIXME broken\n" }))).toContain("HYG-TODO");
    expect(run({ "src/a.ts": "// TODO(#12) revisit after the spike\n" })).toEqual([]);
  });

  it("rejects focused and skipped tests", () => {
    expect(rules(run({ "src/a.test.ts": 'it.only("x", () => {});\n' }))).toContain(
      "HYG-TEST-FOCUS",
    );
    expect(rules(run({ "src/a.test.ts": 'describe.skip("x", () => {});\n' }))).toContain(
      "HYG-TEST-FOCUS",
    );
    expect(rules(run({ "e2e/a.spec.ts": 'test.todo("x");\n' }))).toContain("HYG-TEST-FOCUS");
    expect(run({ "src/a.test.ts": 'it("x", () => {});\n' })).toEqual([]);
  });
});

describe("G-14 check-hygiene: banned files", () => {
  it.each([
    ["src/middleware.ts", "export {};\n"],
    ["middleware.ts", "export {};\n"],
    ["yarn.lock", ""],
    ["bun.lockb", ""],
    ["pnpm-lock.yaml", ""],
    ["bunfig.toml", ""],
    [".storybook/main.ts", "export {};\n"],
    ["CLAUDE.local.md", "personal\n"],
    [".env.local", "A=1\n"],
    [".env", "A=1\n"],
  ])("rejects %s", (file, content) => {
    expect(rules(run({ [file]: content }))).toContain("HYG-BANNED-FILE");
  });

  it("allows .env.example and a CLAUDE.md that only imports AGENTS.md", () => {
    expect(run({ ".env.example": "A=\n", "CLAUDE.md": "@AGENTS.md\n" })).toEqual([]);
  });

  it("rejects a CLAUDE.md with its own content", () => {
    expect(rules(run({ "CLAUDE.md": "# rules\nbe good\n" }))).toContain("HYG-BANNED-FILE");
  });
});

describe("G-14 check-hygiene: banned strings", () => {
  it("rejects the demo brand and demo paths in code", () => {
    expect(rules(run({ "src/a.ts": 'const k = "chennai-estates-compare";\n' }))).toContain(
      "HYG-demo-brand",
    );
    expect(rules(run({ "src/a.ts": 'import x from "../../property-pal/x";\n' }))).toContain(
      "HYG-demo-path",
    );
  });

  it("allows the demo brand in docs that explain the rule", () => {
    expect(run({ "docs/engineering/rules.md": "Do not use chennai-estates-compare.\n" })).toEqual(
      [],
    );
  });

  it("confines provider hostnames to their adapter", () => {
    expect(
      rules(run({ "src/features/x/service.ts": 'fetch("https://api.msg91.com/x");\n' })),
    ).toContain("HYG-provider-host-msg91");
    expect(run({ "src/server/sms/msg91.ts": 'fetch("https://api.msg91.com/x");\n' })).toEqual([]);
  });

  it("confines the service-role variable name", () => {
    expect(
      rules(
        run({ "src/features/x/queries.ts": "const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n" }),
      ),
    ).toContain("HYG-service-role-name");
    expect(run({ "src/server/env.ts": "SUPABASE_SERVICE_ROLE_KEY: z.string(),\n" })).toEqual([]);
  });
});

describe("G-14 check-hygiene: waivers", () => {
  const today = new Date("2026-11-01T00:00:00Z");
  const entry = (extra = {}) =>
    JSON.stringify([
      {
        path: "src/a.ts",
        rule: "HYG-TODO",
        reason: "tracked in the roadmap",
        issue: "#7",
        expires: "2026-12-31",
        ...extra,
      },
    ]);

  it("lets a valid waiver silence one rule on one path", () => {
    const root = makeTree({ "src/a.ts": "// TODO later\n" });
    fs.writeFileSync(path.join(root, "scripts/policy/allowlist.json"), entry());
    expect(checkHygiene({ root, files: ["src/a.ts"], today })).toEqual([]);
  });

  it("fails an expired waiver, and still reports the underlying problem", () => {
    const root = makeTree({ "src/a.ts": "// TODO later\n" });
    fs.writeFileSync(
      path.join(root, "scripts/policy/allowlist.json"),
      entry({ expires: "2026-10-01" }),
    );
    const result = rules(checkHygiene({ root, files: ["src/a.ts"], today }));
    expect(result).toContain("allowlist");
    expect(result).toContain("HYG-TODO");
  });

  it("fails a waiver without an issue or a reason", () => {
    const root = makeTree({ "src/a.ts": "ok\n" });
    fs.writeFileSync(
      path.join(root, "scripts/policy/allowlist.json"),
      entry({ issue: "", reason: "x" }),
    );
    expect(
      rules(checkHygiene({ root, files: ["src/a.ts"], today })).filter(
        (rule) => rule === "allowlist",
      ),
    ).toHaveLength(2);
  });
});
