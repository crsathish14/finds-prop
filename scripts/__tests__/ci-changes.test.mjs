import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  decide,
  everythingReason,
  formatDecision,
  outputLines,
  revisionsToCompare,
} from "../ci-changes.mjs";
import { selectCiJobs } from "../lib/ci-paths.mjs";
import { repoRoot } from "../lib/core.mjs";

const pull = { GITHUB_EVENT_NAME: "pull_request", GITHUB_BASE_REF: "develop", GITHUB_SHA: "abc" };
const push = {
  GITHUB_EVENT_NAME: "push",
  GITHUB_REF_NAME: "develop",
  GITHUB_SHA: "abc",
  CI_BEFORE_SHA: "def",
};

const run = (files) => {
  const decision = selectCiJobs(files);
  return {
    db: decision.db.run,
    integration: decision.integration.run,
    build: decision.build.run,
  };
};
const ALL = { db: true, integration: true, build: true };

describe("UT-ci-changes: which CI jobs a change needs", () => {
  it("skips db, integration and build for a change to documents only", () => {
    expect(run(["docs/status.md", "README.md", "docs/adr/001-x.md"])).toEqual({
      db: false,
      integration: false,
      build: false,
    });
  });

  it("runs db and integration, but not build, for a migration and its tests", () => {
    expect(
      run([
        "supabase/migrations/20261107100000_media.sql",
        "supabase/tests/media.test.sql",
        "docs/adr/058-listing-photo-pipeline.md",
      ]),
    ).toEqual({ db: true, integration: true, build: false });
  });

  it("runs integration and build, but not db, for a server module", () => {
    expect(run(["src/server/audit/audit.ts"])).toEqual({
      db: false,
      integration: true,
      build: true,
    });
  });

  it.each([
    "src/features/media/service.ts",
    "src/features/forms/queries.ts",
    "src/features/home/columns.ts",
    "src/features/projects/lead-schemas.ts",
    "src/lib/env.ts",
    "src/types/database.types.ts",
    "src/app/api/internal/sweep-media/route.ts",
    "tests/integration/media.test.ts",
  ])("runs integration for %s", (file) => {
    expect(run([file]).integration).toBe(true);
  });

  it.each([
    "src/components/ui/button.tsx",
    "src/design-lab/boards/domain.tsx",
    "src/features/projects/project-screen.tsx",
    "src/i18n/messages/en.json",
    "e2e/design-lab/boards.spec.ts",
  ])("runs build but neither db nor integration for the screen file %s", (file) => {
    expect(run([file])).toEqual({ db: false, integration: false, build: true });
  });

  it.each([
    "src/types/database.types.ts",
    "scripts/gen-types.mjs",
    "scripts/check-migrations.mjs",
    "scripts/seed-dev.mjs",
    "supabase/config.toml",
    "supabase/seed.sql",
  ])("runs db for %s", (file) => {
    expect(run([file]).db).toBe(true);
  });

  it.each([
    ".github/workflows/ci.yml",
    "package.json",
    "package-lock.json",
    ".nvmrc",
    "scripts/ci-changes.mjs",
    "scripts/lib/ci-paths.mjs",
  ])("runs every job when %s changes", (file) => {
    expect(run(["docs/status.md", file])).toEqual(ALL);
  });

  it("runs every job when the list of changed files could not be read", () => {
    expect(selectCiJobs(null).db).toEqual({
      run: true,
      why: "the list of changed files could not be read",
    });
    expect(run(null)).toEqual(ALL);
  });

  it("runs build when no changed files are found, instead of skipping everything", () => {
    expect(run([])).toEqual({ db: false, integration: false, build: true });
  });

  it("says why each job runs or skips", () => {
    const decision = selectCiJobs(["src/server/audit/audit.ts"]);
    expect(decision.integration.why).toBe("src/server/audit/audit.ts changed");
    expect(decision.db.why).toMatch(/no database/);
    expect(formatDecision(decision, ["src/server/audit/audit.ts"])).toBe(
      [
        "changed files: 1",
        "db: skip (no database, type or database-script file changed)",
        "integration: run (src/server/audit/audit.ts changed)",
        "build: run (application files changed)",
      ].join("\n"),
    );
  });
});

describe("UT-ci-changes: the event decides", () => {
  it("runs everything for a pull request into main and for a push to main", () => {
    expect(everythingReason({ ...pull, GITHUB_BASE_REF: "main" })).toMatch(/main/);
    expect(everythingReason({ ...push, GITHUB_REF_NAME: "main" })).toMatch(/main/);
    const decision = decide({ ...pull, GITHUB_BASE_REF: "main" }, ["docs/status.md"]);
    expect(outputLines(decision)).toEqual(["db=true", "integration=true", "build=true"]);
  });

  it("runs everything for an event it does not know", () => {
    expect(everythingReason({ GITHUB_EVENT_NAME: "schedule" })).toMatch(/schedule/);
    expect(everythingReason({})).toMatch(/unknown/);
  });

  it("filters a pull request into develop and a push to develop", () => {
    expect(everythingReason(pull)).toBeUndefined();
    expect(everythingReason(push)).toBeUndefined();
    expect(outputLines(decide(pull, ["docs/status.md"]))).toEqual([
      "db=false",
      "integration=false",
      "build=false",
    ]);
  });

  it("compares a pull request with its base, and a push with the commit before it", () => {
    expect(revisionsToCompare(pull)).toEqual({ range: "origin/develop...abc" });
    expect(revisionsToCompare(push)).toEqual({ range: "def..abc" });
  });

  it("has nothing to compare for a new branch, a missing commit or a missing base", () => {
    expect(
      revisionsToCompare({ ...push, CI_BEFORE_SHA: "0000000000000000000000000000000000000000" }),
    ).toBeNull();
    expect(revisionsToCompare({ ...push, CI_BEFORE_SHA: undefined })).toBeNull();
    expect(revisionsToCompare({ ...pull, GITHUB_BASE_REF: undefined })).toBeNull();
    expect(revisionsToCompare({ ...pull, GITHUB_SHA: undefined })).toBeNull();
  });
});

describe("UT-ci-changes: a week of real pull requests (1 to 7 Nov 2026)", () => {
  // The share of the three jobs skipped on typical changes, from the pull requests of that week.
  const week = [
    { files: ["docs/status.md", "docs/adr/057-x.md"], skips: ["db", "integration", "build"] },
    {
      files: ["supabase/migrations/20261106_x.sql", "supabase/tests/x.test.sql"],
      skips: ["build"],
    },
    {
      files: ["src/features/projects/project-screen.tsx", "e2e/smoke.spec.ts"],
      skips: ["db", "integration"],
    },
    { files: ["src/server/rate-limit/limiter.ts", "docs/status.md"], skips: ["db"] },
    { files: [".github/workflows/ci.yml", "docs/status.md"], skips: [] },
  ];
  it.each(week)("skips $skips for $files", ({ files, skips }) => {
    const decision = selectCiJobs(files);
    const skipped = ["db", "integration", "build"].filter((id) => !decision[id].run);
    expect(skipped).toEqual(skips);
  });
});

describe("UT-ci-changes: the workflow uses the decision", () => {
  const text = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
  const section = (name) => {
    const start = text.indexOf(`\n  ${name}:\n`);
    const next = text.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
    return text.slice(start, next === -1 ? undefined : start + 1 + next);
  };

  it("has a changes job that runs the script and exposes the three answers", () => {
    const changes = section("changes");
    expect(changes).toContain("node scripts/ci-changes.mjs");
    expect(changes).toContain("fetch-depth: 0");
    for (const id of ["db", "integration", "build"]) {
      expect(changes).toContain(`${id}: \${{ steps.decide.outputs.${id} }}`);
    }
  });

  it.each(["db", "integration", "build"])(
    "makes the %s job wait for it and run only when asked",
    (id) => {
      const job = section(id);
      expect(job).toMatch(/needs: changes/);
      expect(job).toContain(`if: needs.changes.outputs.${id} == 'true'`);
    },
  );

  it("makes all-checks-passed wait for changes, so a failed decision fails the gate", () => {
    expect(text).toMatch(
      /needs: \[changes, static, pr-policy, unit, db, integration, build, security\]/,
    );
  });

  it("keeps static, unit and security unconditional", () => {
    for (const id of ["static", "unit", "security"]) {
      expect(section(id)).not.toMatch(/\n {4}if:/);
    }
  });
});
