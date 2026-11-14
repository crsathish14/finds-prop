import { describe, expect, it } from "vitest";
import { decide, toRelative } from "../../.claude/hooks/guard-edit.mjs";

const ROOT = "C:\\Users\\kavya priya\\OneDrive\\Documents\\Sathish\\finds-prop\\findsprop";
const onBase = (set) => (rel) => set.has(rel);

const CASES = [
  // secrets and generated files
  [".env", "deny"],
  [".env.local", "deny"],
  [".env.development.local", "deny"],
  [".env.production", "deny"],
  [`${ROOT}\\.env.local`, "deny"],
  [".env.example", "none"],
  ["package-lock.json", "deny"],
  ["node_modules/zod/package.json", "deny"],
  [".next/server/app.js", "deny"],
  [".git/config", "deny"],

  // protected paths ask
  ["AGENTS.md", "ask"],
  ["src/features/search/AGENTS.md", "ask"],
  ["docs/engineering/security.md", "none"], // AI chat tasks may change it (owner, 14 Nov 2026)
  ["docs/engineering/backend.md", "none"],
  ["docs/engineering/frontend.md", "none"],
  ["docs/engineering/workflow.md", "ask"],
  ["docs/engineering/quality-gates.md", "ask"],
  ["scripts/ai-eval/run.mjs", "none"],
  ["scripts/ai-spike/run.mjs", "none"],
  ["scripts/ai-hack.mjs", "ask"],
  [".github/workflows/ci.yml", "ask"],
  [".claude/settings.json", "ask"],
  [".claude/hooks/guard-bash.mjs", "ask"],
  [".mcp.json", "ask"],
  ["eslint.config.mjs", "ask"],
  ["lefthook.yml", "ask"],
  ["package.json", "ask"],
  ["tsconfig.json", "ask"],
  ["scripts/check-hygiene.mjs", "ask"],
  ["scripts/policy/banned-deps.json", "ask"],
  ["supabase/config.toml", "ask"],
  ["next.config.ts", "ask"],
  ["src/proxy.ts", "ask"],
  ["src/server/env.ts", "none"], // the environment schema: AI-P1-T01 adds the provider variables
  ["src/server/supabase/admin.server.ts", "ask"],
  ["vitest.config.mts", "ask"],
  [`${ROOT}\\.github\\workflows\\ci.yml`, "ask"],

  // ordinary files pass
  ["src/features/search/queries.ts", "none"],
  ["src/components/ui/button.tsx", "none"],
  ["src/app/page.tsx", "none"],
  ["docs/requirements/search.md", "none"],
  ["e2e/smoke.spec.ts", "none"],
  ["supabase/tests/rls.test.sql", "none"],
  ["README.md", "none"],
  [`${ROOT}\\src\\app\\page.tsx`, "none"],
];

describe("guard-edit decide()", () => {
  for (const [file, expected] of CASES) {
    it(`${expected.padEnd(4)} ${file}`, () => {
      expect(decide(file, { root: ROOT, existsOnBase: () => false }).decision).toBe(expected);
    });
  }

  it("denies editing a migration that already exists on the base branch", () => {
    const file = "supabase/migrations/20261101000000_base.sql";
    expect(decide(file, { root: ROOT, existsOnBase: onBase(new Set([file])) }).decision).toBe(
      "deny",
    );
  });

  it("allows a new migration", () => {
    expect(
      decide("supabase/migrations/20261102000000_new.sql", {
        root: ROOT,
        existsOnBase: onBase(new Set()),
      }).decision,
    ).toBe("none");
  });

  it("asks when the base branch cannot be consulted", () => {
    expect(
      decide("supabase/migrations/20261102000000_new.sql", { root: ROOT, existsOnBase: () => null })
        .decision,
    ).toBe("ask");
  });

  it("normalises Windows paths, case and ./ prefixes", () => {
    expect(toRelative(`${ROOT}\\src\\app\\page.tsx`, ROOT)).toBe("src/app/page.tsx");
    expect(toRelative(`${ROOT.toUpperCase()}\\SRC\\x.ts`, ROOT)).toBe("SRC/x.ts");
    expect(toRelative("./src/app/page.tsx", ROOT)).toBe("src/app/page.tsx");
  });

  it("gives a reason for every block", () => {
    expect(decide(".env.local", { root: ROOT }).reason.length).toBeGreaterThan(10);
  });
});
