import { describe, expect, it } from "vitest";
import {
  buildLanes,
  CI_BUILD_ENV,
  failedTests,
  formatDuration,
  KNOWN_LOCAL_SMOKE_FAILURES,
  LANE_IDS,
  linuxLabScript,
  parseArgs,
  runPlan,
  selectLanes,
  summarise,
  UsageError,
} from "../lib/ci-local-core.mjs";

const config = {
  base: "origin/develop",
  nodeMajor: "24",
  playwrightVersion: "1.64.1",
  repoRoot: "/repo",
  outDir: "/repo/out",
  platform: "win32",
};
const lanesWith = (overrides = {}) => buildLanes({ ...config, ...overrides });
const lane = (lanes, id) => lanes.find((candidate) => candidate.id === id);
const step = (lanes, laneId, stepId) =>
  lane(lanes, laneId).steps.find((candidate) => candidate.id === stepId);

describe("UT-ci-local: the options", () => {
  it("runs the lanes one after another, with the stack stopped, by default", () => {
    expect(parseArgs([])).toEqual({
      only: null,
      all: false,
      parallel: false,
      rerun: true,
      keepStack: false,
      prEvent: null,
      base: "origin/develop",
      list: false,
      help: false,
    });
  });

  it("reads each option", () => {
    const options = parseArgs([
      "--all",
      "--parallel",
      "--no-rerun",
      "--keep-stack",
      "--only=app,small",
      "--pr-event=event.json",
      "--base=origin/main",
      "--list",
    ]);
    expect(options).toMatchObject({
      all: true,
      parallel: true,
      rerun: false,
      keepStack: true,
      prEvent: "event.json",
      base: "origin/main",
      list: true,
    });
    expect([...options.only]).toEqual(["app", "small"]);
  });

  it.each([["--nope"], ["--only="], ["--only=app,mystery"], ["parallel"], ["--serial"]])(
    "refuses %s with a message",
    (argument) => {
      expect(() => parseArgs([argument])).toThrow(UsageError);
    },
  );
});

describe("UT-ci-local: the lanes are the CI jobs", () => {
  it("has the four lanes", () => {
    expect(lanesWith().map((entry) => entry.id)).toEqual(LANE_IDS);
  });

  it("puts what shares the build folder and the port in one lane, in order", () => {
    expect(lane(lanesWith(), "app").steps.map((entry) => entry.id)).toEqual([
      "check",
      "knip",
      "build",
      "smoke",
    ]);
  });

  it("builds with the values CI builds with, and the smoke tests need the build", () => {
    const lanes = lanesWith();
    expect(step(lanes, "app", "build").env).toEqual(CI_BUILD_ENV);
    expect(CI_BUILD_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("ci-placeholder-key");
    expect(step(lanes, "app", "smoke").dependsOn).toBe("build");
    expect(step(lanes, "app", "smoke").port).toBe(3100);
  });

  it("only forgives the known smoke failures on Windows", () => {
    expect(step(lanesWith({ platform: "win32" }), "app", "smoke").knownFailures).toBe(
      KNOWN_LOCAL_SMOKE_FAILURES,
    );
    expect(step(lanesWith({ platform: "linux" }), "app", "smoke").knownFailures).toBeUndefined();
    expect(step(lanesWith({ platform: "darwin" }), "app", "smoke").knownFailures).toBeUndefined();
  });

  it("knip is a report and cannot fail the run", () => {
    expect(step(lanesWith(), "app", "knip").report).toBe(true);
  });

  it("runs the database steps in CI's order on one stack, and stops it at the end", () => {
    const steps = lane(lanesWith(), "db").steps;
    expect(steps.map((entry) => entry.id)).toEqual([
      "migrations",
      "up",
      "checkdb",
      "perf",
      "reset",
      "ready",
      "integration",
      "stop",
    ]);
    expect(steps.at(-1).cleanup).toBe(true);
    expect(step(lanesWith(), "db", "integration").dependsOn).toBe("ready");
    expect(step(lanesWith(), "db", "ready")).toMatchObject({
      kind: "wait-stack",
      dependsOn: "reset",
    });
    expect(step(lanesWith(), "db", "migrations").command).toContain("--base origin/develop");
  });

  it("leaves the stack running with --keep-stack", () => {
    expect(
      lane(lanesWith({ keepStack: true }), "db").steps.some((entry) => entry.id === "stop"),
    ).toBe(false);
  });

  it("feeds the performance script to psql from the file, not through the shell", () => {
    const perf = step(lanesWith(), "db", "perf");
    expect(perf.stdinFile).toBe("supabase/perf/search-spike.sql");
    expect(perf.argv.slice(0, 4)).toEqual(["docker", "exec", "-i", "supabase_db_findsprop"]);
    expect(perf.argv).toContain("p95_limit=100");
  });

  it("runs the Design Lab checks in the Linux image for the pinned Playwright version", () => {
    const lab = step(lanesWith(), "linux", "lab");
    expect(lab.argv).toContain("mcr.microsoft.com/playwright:v1.64.1-noble");
    expect(lab.argv).toContain("/repo:/src:ro");
    expect(lab.argv).toContain("/repo/out:/out");
    expect(lab.argv).toContain("findsprop-ci-local-npm:/root/.npm");
    expect(lane(lanesWith(), "linux").needs).toEqual(["docker"]);
    expect(lane(lanesWith(), "db").needs).toEqual(["docker"]);
  });

  it("makes the Linux script use the project's Node, CI's build values, and a longer screenshot timeout", () => {
    const script = linuxLabScript({ nodeMajor: "24" });
    expect(script).toContain("latest-v24.x");
    expect(script).toContain("npm ci --ignore-scripts");
    expect(script).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="ci-placeholder-key"');
    expect(script).toContain("DESIGN_LAB_VISUAL=compare");
    expect(script).toContain("--timeout=240000");
    expect(script).toContain("--workers=1");
    expect(script).toContain("--exclude=./node_modules");
  });

  it("scans the secrets of this branch only, against the base", () => {
    expect(step(lanesWith(), "small", "secrets").command).toContain(
      "--log-opts=origin/develop..HEAD",
    );
    expect(step(lanesWith({ base: "origin/main" }), "small", "secrets").command).toContain(
      "origin/main..HEAD",
    );
  });

  it("cannot run the pull request check without a drafted pull request, and says how", () => {
    expect(step(lanesWith(), "small", "pr").skip).toMatch(/--pr-event/);
    const given = step(lanesWith({ prEvent: "/tmp/event.json" }), "small", "pr");
    expect(given.skip).toBeUndefined();
    expect(given.env).toEqual({ GITHUB_EVENT_PATH: "/tmp/event.json", GITHUB_BASE_REF: "develop" });
  });
});

describe("UT-ci-local: reading Playwright's list of failures", () => {
  const output = [
    "  1) [smoke] › e2e\\smoke.spec.ts:154:7 › @smoke site header › the header itself has no serious accessibility violation",
    "",
    "  4 failed",
    "    [smoke] › e2e\\smoke.spec.ts:154:7 › @smoke site header › the header itself has no serious accessibility violation, on a page",
    "    [smoke] › e2e\\smoke.spec.ts:698:9 › @smoke text origin › all visible text on /auth comes from en.json ",
    "  97 passed (1.7m)",
  ].join("\n");

  it("collects the failed titles between the failed and passed lines", () => {
    expect(failedTests(output)).toHaveLength(2);
    expect(failedTests(output)[1]).toContain("all visible text on /auth");
  });

  it("finds nothing when nothing failed", () => {
    expect(failedTests("  101 passed (2.0m)")).toEqual([]);
  });
});

describe("UT-ci-local: durations", () => {
  it.each([
    [900, "1s"],
    [59_000, "59s"],
    [60_000, "1m00s"],
    [193_000, "3m13s"],
  ])("writes %i ms as %s", (milliseconds, text) => {
    expect(formatDuration(milliseconds)).toBe(text);
  });
});

/** Stand-ins: a clock that moves 1 s per step, and an exec that answers from a table. */
function harness(answers = {}, extras = {}) {
  let time = 0;
  const calls = [];
  const logs = [];
  const exec = async (stepToRun, laneToRun) => {
    const key = `${laneToRun.id}:${stepToRun.id}`;
    calls.push(key);
    time += 1000;
    const answer =
      typeof answers[key] === "function"
        ? answers[key](calls.filter((call) => call === key).length)
        : answers[key];
    return { code: 0, output: "", logFile: `logs/${key}.log`, ...(answer ?? {}) };
  };
  return {
    calls,
    logs,
    run: (lanes, overrides = {}) =>
      runPlan({
        lanes,
        exec,
        available: { docker: true },
        parallel: true,
        rerun: true,
        log: (message) => logs.push(message),
        now: () => time,
        portInUse: async () => false,
        ...extras,
        ...overrides,
      }),
  };
}

const withPr = () => lanesWith({ prEvent: "/tmp/event.json" });
const statuses = (outcome, laneId) =>
  Object.fromEntries(
    outcome.lanes
      .find((entry) => entry.id === laneId)
      .records.map((record) => [record.id, record.status]),
  );

describe("UT-ci-local: running the lanes", () => {
  it("passes when every step passes, with a re-run of nothing", async () => {
    const { run, calls } = harness();
    const outcome = await run(withPr());
    expect(outcome.code).toBe(0);
    expect(calls).toHaveLength(4 + 8 + 1 + 3);
    expect(outcome.lanes.every((entry) => entry.rerun === null)).toBe(true);
  });

  it("starts the lanes together, not one after another", async () => {
    let running = 0;
    let most = 0;
    const exec = async (stepToRun, laneToRun) => {
      if (
        stepToRun.id === "check" ||
        stepToRun.id === "migrations" ||
        stepToRun.id === "lab" ||
        stepToRun.id === "audit"
      ) {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 20));
        running -= 1;
      }
      return { code: 0, output: "", logFile: `${laneToRun.id}.log` };
    };
    await runPlan({
      lanes: withPr(),
      exec,
      available: { docker: true },
      parallel: true,
      rerun: false,
      log: () => undefined,
      now: () => 0,
      portInUse: async () => false,
    });
    expect(most).toBe(4);
  });

  it("runs one lane at a time unless asked for --parallel", async () => {
    let running = 0;
    let most = 0;
    const exec = async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 2));
      running -= 1;
      return { code: 0, output: "", logFile: "x.log" };
    };
    await runPlan({
      lanes: withPr(),
      exec,
      available: { docker: true },
      parallel: false,
      rerun: true,
      log: () => undefined,
      now: () => 0,
      portInUse: async () => false,
    });
    expect(most).toBe(1);
  });

  it("skips what depends on a failed step, and the other steps still run", async () => {
    const { run, calls } = harness({ "app:build": { code: 1 } });
    const outcome = await run(withPr(), { rerun: false });
    expect(statuses(outcome, "app")).toMatchObject({
      check: "passed",
      build: "failed",
      smoke: "skipped",
    });
    expect(calls).not.toContain("app:smoke");
    expect(outcome.code).toBe(1);
  });

  it("does not fail the run for a report-only step", async () => {
    const { run } = harness({ "app:knip": { code: 1 } });
    const outcome = await run(withPr());
    expect(statuses(outcome, "app").knip).toBe("reported");
    expect(outcome.code).toBe(0);
  });

  it("stops the stack even when the database steps fail", async () => {
    const { run, calls } = harness({ "db:checkdb": { code: 1 } });
    const outcome = await run(withPr(), { rerun: false });
    expect(statuses(outcome, "db")).toMatchObject({
      checkdb: "failed",
      perf: "skipped",
      stop: "passed",
    });
    expect(calls.filter((entry) => entry === "db:stop")).toHaveLength(1);
    expect(outcome.code).toBe(1);
  });

  it("does not run anything that needs Docker when Docker is not running, and says so", async () => {
    const { run, calls } = harness();
    const outcome = await run(withPr(), { available: { docker: false } });
    expect(calls.some((entry) => entry.startsWith("db:") || entry.startsWith("linux:"))).toBe(
      false,
    );
    expect(statuses(outcome, "db").up).toBe("not-run");
    expect(statuses(outcome, "linux").lab).toBe("not-run");
    expect(outcome.code).toBe(2);
  });

  it("calls a run that could not do the pull request check incomplete, not passed", async () => {
    const { run } = harness();
    const outcome = await run(lanesWith());
    expect(statuses(outcome, "small").pr).toBe("not-run");
    expect(outcome.code).toBe(2);
  });

  it("fails, not just incomplete, when something failed and something could not run", async () => {
    const { run } = harness({ "app:check": { code: 1 } });
    const outcome = await run(lanesWith(), { rerun: false });
    expect(outcome.code).toBe(1);
  });

  it("refuses to start the smoke tests while something is on port 3100", async () => {
    const { run, calls } = harness();
    const outcome = await run(withPr(), { portInUse: async (port) => port === 3100, rerun: false });
    expect(statuses(outcome, "app").smoke).toBe("failed");
    expect(calls).not.toContain("app:smoke");
    expect(
      outcome.lanes
        .find((entry) => entry.id === "app")
        .records.find((record) => record.id === "smoke").note,
    ).toMatch(/port 3100 is in use/);
  });
});

describe("UT-ci-local: one after another is the default", () => {
  it("starts the lanes in order, cheap first and the Linux picture run last", async () => {
    const { run, logs } = harness();
    await run(withPr(), { parallel: false });
    const started = logs
      .filter((line) => line.includes(" start "))
      .map((line) => line.slice(1, line.indexOf("]")));
    const order = started.filter((id, index) => started.indexOf(id) === index);
    expect(order).toEqual(["small", "app", "db", "linux"]);
  });

  it("never runs a lane again on its own, since each already ran alone", async () => {
    const { run, calls } = harness({ "app:build": { code: 1 } });
    const outcome = await run(withPr(), { parallel: false });
    expect(calls.filter((entry) => entry === "app:build")).toHaveLength(1);
    expect(outcome.lanes.every((entry) => entry.rerun === null)).toBe(true);
    expect(outcome.code).toBe(1);
  });
});

describe("UT-ci-local: the stack must answer before the integration tests", () => {
  it("skips the integration tests, and still stops the stack, when the stack does not come back", async () => {
    const { run, calls } = harness({ "db:ready": { code: 1 } });
    const outcome = await run(withPr(), { rerun: false });
    expect(statuses(outcome, "db")).toMatchObject({
      reset: "passed",
      ready: "failed",
      integration: "skipped",
      stop: "passed",
    });
    expect(calls).not.toContain("db:integration");
    expect(outcome.code).toBe(1);
  });
});

describe("UT-ci-local: which lanes a change needs", () => {
  const ids = (files) => selectLanes(files).map((entry) => entry.id);

  it("always runs the small and app lanes, even for a change to documents only", () => {
    expect(ids([])).toEqual(["small", "app"]);
    expect(ids(["docs/status.md", "README.md"])).toEqual(["small", "app"]);
  });

  it.each([
    "supabase/migrations/20261107100000_media_pipeline.sql",
    "supabase/tests/media_pipeline.test.sql",
    "src/types/database.types.ts",
    "tests/integration/media.test.ts",
    "src/server/supabase/admin.server.ts",
    "src/server/rate-limit/limiter.ts",
    "src/app/api/internal/sweep-media/route.ts",
    "src/app/auth/callback/route.ts",
    "src/features/media/service.ts",
    "src/features/forms/queries.ts",
    "src/features/auth/email-service.ts",
    "src/features/site/sponsors.server.ts",
  ])("adds the db lane for %s", (file) => {
    expect(ids([file])).toEqual(["small", "app", "db"]);
  });

  it.each([
    "src/design-lab/boards/domain.ts",
    "src/components/domain/photo-uploader.tsx",
    "src/styles/theme.css",
    "src/i18n/messages/en.json",
    "e2e/design-lab/boards.spec.ts",
    "package-lock.json",
  ])("adds the Linux lane for %s", (file) => {
    expect(ids([file])).toEqual(["small", "app", "linux"]);
  });

  it("does not add the db lane for a page or a component alone", () => {
    expect(
      ids(["src/app/[locale]/(public)/layout.tsx", "src/features/media/photo-list.ts"]),
    ).toEqual(["small", "app"]);
  });

  it("adds both when a change touches both", () => {
    expect(ids(["supabase/seed.sql", "src/components/domain/photo-uploader.tsx"])).toEqual([
      "small",
      "app",
      "db",
      "linux",
    ]);
  });

  it.each([
    ".github/workflows/ci.yml",
    "scripts/ci-local.mjs",
    "scripts/lib/ci-local-core.mjs",
    "package.json",
    ".nvmrc",
  ])("runs every lane for %s", (file) => {
    expect(ids([file])).toEqual(LANE_IDS);
  });

  it("runs every lane when the changed files could not be listed, and says why", () => {
    const picked = selectLanes(null);
    expect(picked.map((entry) => entry.id)).toEqual(LANE_IDS);
    expect(picked.every((entry) => entry.why.includes("could not be read"))).toBe(true);
  });

  it("names the first file that asked for each lane", () => {
    const picked = selectLanes([
      "docs/a.md",
      "supabase/seed.sql",
      "supabase/other.sql",
      "src/styles/theme.css",
    ]);
    expect(picked).toEqual([
      { id: "small", why: "always" },
      { id: "app", why: "always" },
      { id: "db", why: "supabase/seed.sql" },
      { id: "linux", why: "src/styles/theme.css" },
    ]);
  });
});

describe("UT-ci-local: known failures on this platform", () => {
  const known = [
    "  4 failed",
    "    [smoke] › e2e\\smoke.spec.ts:154:7 › @smoke site header › the header itself has no serious accessibility violation, on a page",
    "    [smoke] › e2e\\smoke.spec.ts:698:9 › @smoke text origin › all visible text on /auth comes from en.json ",
    "  97 passed (1.7m)",
  ].join("\n");
  const unknown = known.replace(
    "    [smoke] › e2e\\smoke.spec.ts:698:9",
    "    [smoke] › e2e\\smoke.spec.ts:300:9 › @smoke home page › has a heading\n    [smoke] › e2e\\smoke.spec.ts:698:9",
  );

  it("counts the four known smoke failures as passed, with a note", async () => {
    const { run } = harness({ "app:smoke": { code: 1, output: known } });
    const outcome = await run(withPr());
    expect(statuses(outcome, "app").smoke).toBe("known");
    expect(outcome.code).toBe(0);
  });

  it("fails the run when any other test fails with them", async () => {
    const { run } = harness({ "app:smoke": { code: 1, output: unknown } });
    const outcome = await run(withPr(), { rerun: false });
    expect(statuses(outcome, "app").smoke).toBe("failed");
    expect(outcome.code).toBe(1);
  });

  it("does not forgive a failure that has no test list (a crash)", async () => {
    const { run } = harness({ "app:smoke": { code: 1, output: "Error: browser crashed" } });
    const outcome = await run(withPr(), { rerun: false });
    expect(statuses(outcome, "app").smoke).toBe("failed");
  });
});

describe("UT-ci-local: a lane that fails under load is run again alone", () => {
  it("calls it a timeout under load when it passes on its own, and keeps the run green", async () => {
    const { run, calls } = harness({
      "app:build": (time) => (time === 1 ? { code: 1 } : { code: 0 }),
    });
    const outcome = await run(withPr());
    const app = outcome.lanes.find((entry) => entry.id === "app");
    expect(app.rerun?.passed).toBe(true);
    expect(calls.filter((entry) => entry === "app:build")).toHaveLength(2);
    expect(outcome.code).toBe(0);
    expect(summarise(outcome)).toMatch(/PASSED on its own: a timeout under load/);
  });

  it("calls it a real failure when it fails on its own too", async () => {
    const { run } = harness({ "app:build": { code: 1 } });
    const outcome = await run(withPr());
    expect(outcome.lanes.find((entry) => entry.id === "app").rerun?.passed).toBe(false);
    expect(outcome.code).toBe(1);
    expect(summarise(outcome)).toMatch(/failed on its own too: a real failure/);
  });

  it("does not run a lane again with --no-rerun, or when the lanes ran one after another (it already ran alone)", async () => {
    const answers = { "app:build": { code: 1 } };
    const noRerun = harness(answers);
    await noRerun.run(withPr(), { rerun: false });
    expect(noRerun.calls.filter((entry) => entry === "app:build")).toHaveLength(1);
    const serial = harness(answers);
    await serial.run(withPr(), { parallel: false });
    expect(serial.calls.filter((entry) => entry === "app:build")).toHaveLength(1);
  });

  it("starts the stack again on the re-run, because it was stopped at the end of the first", async () => {
    const { run, calls } = harness({
      "db:integration": (time) => (time === 1 ? { code: 1 } : { code: 0 }),
    });
    const outcome = await run(withPr());
    expect(calls.filter((entry) => entry === "db:up")).toHaveLength(2);
    expect(calls.filter((entry) => entry === "db:stop")).toHaveLength(2);
    expect(outcome.code).toBe(0);
  });
});

describe("UT-ci-local: the summary", () => {
  it("lists every step with its result, time and log, and ends with a verdict", async () => {
    const { run } = harness({ "app:build": { code: 1 } });
    const outcome = await run(withPr(), { rerun: false });
    const text = summarise(outcome);
    expect(text).toMatch(/app\s+FAILED\s+CI-style build/);
    expect(text).toMatch(/app\s+skipped\s+smoke tests\s+.*build did not pass/);
    expect(text).toContain("log: logs/app:build.log");
    expect(text).toMatch(/Something FAILED/);
  });

  it("says all passed only when all passed", async () => {
    const { run } = harness();
    expect(summarise(await run(withPr()))).toMatch(/All CI jobs passed locally/);
    expect(summarise(await run(lanesWith()))).toMatch(/something could not run/);
  });
});
