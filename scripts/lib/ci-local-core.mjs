// Every CI job, run on this machine, as lanes (R-GIT-05, docs/runbooks/ci-locally.md).
//
// This file holds the rules: which lanes there are, what each step runs, how steps depend on each other,
// what counts as a pass, and how the lanes are scheduled. It never starts a process itself: the caller
// passes `exec`, so the tests run it with stand-ins. The command line is scripts/ci-local.mjs.
//
// Lanes (each runs its own steps one after another; by default the lanes also run one after another):
//   small  npm audit, the secret scan, the pull request check (when a drafted pull request is given)
//   app    npm run check, knip (a report), the CI-style build, the smoke tests
//   db     migrations check, supabase start, check:db, the search performance check, a reset, the
//          integration tests, supabase stop. One stack is shared by these steps, one after the other.
//   linux  the Design Lab checks with the picture comparison, in the Linux Playwright image
//
// Why these lanes: the app lane owns `.next` and port 3100, the db lane owns the one local Supabase
// stack, the linux lane works in its own container on its own copy of the repository. Steps that would
// collide are kept in the same lane, so the lanes do not touch each other's files, ports or database.
//
// Serial is the default because that is what measured faster to a reliable result: on the owner's machine
// (12 CPUs, 15 GB) each lane takes about 5 minutes alone, about 15 minutes in all, while all lanes at
// once took 13 minutes AND failed four steps on load (the performance check, the integration tests'
// first call, a smoke test, the picture run), each of which passed alone. `--parallel` runs the lanes
// side by side anyway, and runs a lane that failed again on its own, so a timeout from a busy machine is
// told apart from a real failure.

import { DATABASE_PATHS, EVERYTHING_PATHS, PICTURE_PATHS } from "./ci-paths.mjs";

export const LANE_IDS = ["small", "app", "db", "linux"];

/** The values CI builds with (its jobs have no Supabase and no keys). */
export const CI_BUILD_ENV = {
  APP_ENV: "local",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "ci-placeholder-key",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
};

/**
 * Smoke tests that fail on a Windows machine only, because the page waits for the network to go quiet and
 * a refused connection to the missing database is slow there (docs/runbooks/ci-locally.md). CI passes them.
 */
export const KNOWN_LOCAL_SMOKE_FAILURES = [
  /site header › the header itself has no serious accessibility violation/,
  /text origin › all visible text on \/auth/,
];

export class UsageError extends Error {}

// Which lanes a change needs (R-GIT-05, docs/runbooks/ci-locally.md, "Which jobs for which change").
// The small and app lanes always run. The db lane runs when the change can touch the database, the Linux
// lane when it can change a picture, and everything runs when the workflow, this runner or the package
// list changes, or when the list of changed files could not be read. The path lists are shared with CI
// and live in ci-paths.mjs.
export { DATABASE_PATHS, EVERYTHING_PATHS, PICTURE_PATHS };

/** @param {string[] | null} files the changed files (repo-relative, forward slashes), or null if unknown */
export function selectLanes(files) {
  if (files === null) {
    return LANE_IDS.map((id) => ({ id, why: "the list of changed files could not be read" }));
  }
  const picked = new Map([
    ["small", "always"],
    ["app", "always"],
  ]);
  const note = (lane, file) => {
    if (!picked.has(lane)) picked.set(lane, file);
  };
  for (const file of files) {
    if (EVERYTHING_PATHS.some((pattern) => pattern.test(file))) {
      for (const id of LANE_IDS) note(id, file);
    }
    if (DATABASE_PATHS.some((pattern) => pattern.test(file))) note("db", file);
    if (PICTURE_PATHS.some((pattern) => pattern.test(file))) note("linux", file);
  }
  return LANE_IDS.filter((id) => picked.has(id)).map((id) => ({ id, why: picked.get(id) }));
}

export function parseArgs(argv) {
  const options = {
    only: null,
    all: false,
    parallel: false,
    rerun: true,
    keepStack: false,
    prEvent: null,
    base: "origin/develop",
    list: false,
    help: false,
  };
  for (const argument of argv) {
    if (argument === "--parallel") options.parallel = true;
    else if (argument === "--all") options.all = true;
    else if (argument === "--no-rerun") options.rerun = false;
    else if (argument === "--keep-stack") options.keepStack = true;
    else if (argument === "--list") options.list = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument.startsWith("--only=")) {
      const lanes = argument.slice("--only=".length).split(",").filter(Boolean);
      const unknown = lanes.filter((lane) => !LANE_IDS.includes(lane));
      if (lanes.length === 0 || unknown.length > 0) {
        throw new UsageError(
          `--only takes lanes from: ${LANE_IDS.join(", ")}${unknown.length ? ` (not: ${unknown.join(", ")})` : ""}`,
        );
      }
      options.only = new Set(lanes);
    } else if (argument.startsWith("--pr-event=")) {
      options.prEvent = argument.slice("--pr-event=".length) || null;
    } else if (argument.startsWith("--base=")) {
      options.base = argument.slice("--base=".length) || options.base;
    } else {
      throw new UsageError(`unknown option ${argument}`);
    }
  }
  return options;
}

/** The bash script the Linux lane runs inside the Playwright image (a clean copy of the repository). */
export function linuxLabScript({ nodeMajor, buildEnv = CI_BUILD_ENV }) {
  const exports = Object.entries(buildEnv)
    .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
    .join(" ");
  return [
    "set -e",
    "mkdir -p /work && cd /src",
    "tar cf - --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./test-results --exclude=./playwright-report . | tar xf - -C /work",
    "cd /work",
    // The image ships a newer Node than the project's; CI uses the version in .nvmrc.
    `base=https://nodejs.org/dist/latest-v${nodeMajor}.x`,
    'file=$(curl -fsSL $base/SHASUMS256.txt | grep -o "node-v[0-9.]*-linux-x64.tar.gz" | head -1)',
    'curl -fsSL "$base/$file" | tar -xz -C /usr/local --strip-components=1',
    "node -v",
    "npm ci --ignore-scripts > /tmp/npm-ci.log 2>&1 || { tail -20 /tmp/npm-ci.log; exit 1; }",
    `export ${exports}`,
    "npm run build > /tmp/build.log 2>&1 || { tail -30 /tmp/build.log; exit 1; }",
    "set +e",
    // One worker, as on CI's 2-CPU runner (more would only compete with the server and the screenshots), and
    // longer than the 30 second default for the two tallest boards, which are photographed whole in Docker.
    "CI=1 DESIGN_LAB_VISUAL=compare npx playwright test --project=design-lab --workers=1 --timeout=240000 2>&1 | tail -n 40",
    "code=${PIPESTATUS[0]}",
    "mkdir -p /out && cp -r test-results /out/ 2>/dev/null; cp -r playwright-report /out/ 2>/dev/null",
    "exit $code",
  ].join("\n");
}

/**
 * The lanes and their steps. A step is `{ id, name, command }` (run through the shell), or `{ argv }` (no
 * shell), with optional `env`, `stdinFile`, `dependsOn` (a step of the same lane that must have passed),
 * `report` (shown, never fails the run), `cleanup` (always runs, at the end of the lane),
 * `knownFailures` (test titles that may fail on this platform) and `skip` (why it cannot run).
 */
export function buildLanes(config) {
  const {
    base = "origin/develop",
    nodeMajor,
    playwrightVersion,
    repoRoot,
    outDir,
    prEvent = null,
    keepStack = false,
    platform = process.platform,
  } = config;

  const app = [
    { id: "check", name: "npm run check", command: "npm run check" },
    { id: "knip", name: "knip", command: "npx knip", report: true },
    { id: "build", name: "CI-style build", command: "npm run build", env: CI_BUILD_ENV },
    {
      id: "smoke",
      name: "smoke tests",
      command: "npm run test:e2e:smoke",
      dependsOn: "build",
      port: 3100,
      ...(platform === "win32" ? { knownFailures: KNOWN_LOCAL_SMOKE_FAILURES } : {}),
    },
  ];

  const db = [
    {
      id: "migrations",
      name: "migrations check against the base",
      command: `node scripts/check-migrations.mjs --base ${base}`,
    },
    { id: "up", name: "supabase start", command: "supabase start" },
    { id: "checkdb", name: "npm run check:db", command: "npm run check:db", dependsOn: "up" },
    {
      id: "perf",
      name: "search performance check",
      argv: [
        "docker",
        "exec",
        "-i",
        "supabase_db_findsprop",
        "psql",
        "-U",
        "supabase_admin",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "p95_limit=100",
        "-v",
        "runs=200",
      ],
      stdinFile: "supabase/perf/search-spike.sql",
      dependsOn: "checkdb",
    },
    {
      id: "reset",
      name: "database reset (as a fresh CI stack)",
      command: "supabase db reset",
      dependsOn: "up",
    },
    // The sign-in service restarts after a reset; the first call of the integration tests fails if it is not back.
    { id: "ready", name: "wait until the stack answers", kind: "wait-stack", dependsOn: "reset" },
    {
      id: "integration",
      name: "integration tests",
      command: "npm run test:integration",
      dependsOn: "ready",
    },
    ...(keepStack
      ? []
      : [
          {
            id: "stop",
            name: "supabase stop",
            command: "supabase stop --no-backup",
            cleanup: true,
          },
        ]),
  ];

  const linux = [
    {
      id: "lab",
      name: "Design Lab checks with pictures (Linux, Docker)",
      argv: [
        "docker",
        "run",
        "--rm",
        "--ipc=host",
        "-v",
        `${repoRoot}:/src:ro`,
        "-v",
        `${outDir}:/out`,
        // The downloaded packages are kept between runs, so `npm ci` in the container is quick.
        "-v",
        "findsprop-ci-local-npm:/root/.npm",
        `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`,
        "bash",
        "-c",
        linuxLabScript({ nodeMajor }),
      ],
    },
  ];

  const small = [
    { id: "audit", name: "npm audit", command: "npm audit --omit=dev --audit-level=high" },
    {
      id: "secrets",
      name: "secret scan (this branch)",
      command: `gitleaks detect --redact --no-banner --config .gitleaks.toml --log-opts=${base}..HEAD`,
    },
    prEvent
      ? {
          id: "pr",
          name: "pull request check",
          command: "node scripts/check-pr.mjs",
          env: { GITHUB_EVENT_PATH: prEvent, GITHUB_BASE_REF: base.replace(/^origin\//, "") },
        }
      : {
          id: "pr",
          name: "pull request check",
          command: "node scripts/check-pr.mjs",
          skip: "needs a drafted pull request: pass --pr-event=<file> (docs/runbooks/ci-locally.md)",
        },
  ];

  // Cheap lanes first, the heaviest last, so a quick failure shows early when they run one after another.
  return [
    { id: "small", steps: small },
    { id: "app", steps: app },
    { id: "db", steps: db, needs: ["docker"] },
    { id: "linux", steps: linux, needs: ["docker"] },
  ];
}

/** The titles of the tests Playwright reports as failed, from its list output. */
export function failedTests(output) {
  const lines = String(output).split(/\r?\n/);
  const titles = [];
  let inFailures = false;
  for (const line of lines) {
    if (/^\s+\d+ failed\s*$/.test(line)) {
      inFailures = true;
      continue;
    }
    if (inFailures) {
      if (/^\s+\[[^\]]+\] › /.test(line)) titles.push(line.trim());
      else if (/^\s+\d+ (passed|flaky|skipped|did not run)/.test(line)) inFailures = false;
    }
  }
  return titles;
}

export function formatDuration(milliseconds) {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
}

/** Runs one lane's steps one after another. Returns a record per step. */
async function runLane(lane, context) {
  const { exec, available, log, now } = context;
  const records = [];
  const byId = new Map();

  const record = (step, fields) => {
    const entry = { lane: lane.id, id: step.id, name: step.name, ...fields };
    records.push(entry);
    byId.set(step.id, entry);
    return entry;
  };

  const missing = (lane.needs ?? []).find((need) => !available[need]);
  for (const step of lane.steps.filter((candidate) => !candidate.cleanup)) {
    if (missing) {
      record(step, { status: "not-run", note: `${missing} is not running` });
      continue;
    }
    if (step.skip) {
      record(step, { status: "not-run", note: step.skip });
      continue;
    }
    const dependency = step.dependsOn ? byId.get(step.dependsOn) : null;
    if (dependency && !["passed", "known"].includes(dependency.status)) {
      record(step, { status: "skipped", note: `${step.dependsOn} did not pass` });
      continue;
    }
    if (step.port && (await context.portInUse(step.port))) {
      record(step, {
        status: "failed",
        note: `port ${step.port} is in use (a stray server?); stop it and run again`,
        ms: 0,
      });
      log(`[${lane.id}] failed ${step.name}: port ${step.port} is in use`);
      continue;
    }
    log(`[${lane.id}] start ${step.name}`);
    const started = now();
    const result = await exec(step, lane);
    const ms = now() - started;
    let status = result.code === 0 ? "passed" : "failed";
    let note;
    if (status === "failed" && step.report) {
      status = "reported";
      note = "a report only";
    } else if (status === "failed" && step.knownFailures) {
      const titles = failedTests(result.output);
      const unknown = titles.filter(
        (title) => !step.knownFailures.some((known) => known.test(title)),
      );
      if (titles.length > 0 && unknown.length === 0) {
        status = "known";
        note = `${titles.length} known local-only failures (CI passes them)`;
      }
    }
    record(step, { status, ms, logFile: result.logFile, note });
    log(`[${lane.id}] ${status} ${step.name} (${formatDuration(ms)})`);
  }
  // Cleanup steps run at the end of the lane, whatever happened (the stack is stopped, for one).
  for (const step of lane.steps.filter((candidate) => candidate.cleanup)) {
    if (missing) continue;
    const started = now();
    const result = await exec(step, lane);
    record(step, {
      status: result.code === 0 ? "passed" : "failed",
      ms: now() - started,
      logFile: result.logFile,
    });
  }
  return records;
}

const BAD = new Set(["failed"]);

function laneFailed(records) {
  return records.some((entry) => BAD.has(entry.status));
}

/**
 * Runs the chosen lanes (one after another, or side by side with `parallel`), then, after a parallel run, runs
 * any lane that failed again on its own, unless `rerun` is off. Returns `{ lanes, code }`: code 0 when everything passed (a lane that
 * failed only under load and passed alone counts, and is flagged), 1 when something failed, 2 when
 * nothing failed but something could not run.
 */
export async function runPlan({ lanes, exec, available, parallel, rerun, log, now, portInUse }) {
  const context = { exec, available, log, now, portInUse: portInUse ?? (async () => false) };
  const first = [];
  if (parallel) {
    first.push(...(await Promise.all(lanes.map((lane) => runLane(lane, context)))));
  } else {
    for (const lane of lanes) first.push(await runLane(lane, context));
  }

  const results = lanes.map((lane, index) => ({ id: lane.id, records: first[index], rerun: null }));
  // A lane that failed alone has nothing to prove by running alone again, so only a parallel run re-runs.
  if (rerun && parallel) {
    for (const result of results) {
      if (!laneFailed(result.records)) continue;
      const lane = lanes.find((candidate) => candidate.id === result.id);
      log(`[${lane.id}] failed while the other lanes ran; running it again on its own`);
      const again = await runLane(lane, context);
      result.rerun = { records: again, passed: !laneFailed(again) };
    }
  }

  // A lane that was run again counts by how it did on its own.
  const effective = results.flatMap((result) =>
    result.rerun ? result.rerun.records : result.records,
  );
  const failed = effective.some((entry) => BAD.has(entry.status));
  const notRun = effective.some((entry) => entry.status === "not-run");
  return { lanes: results, code: failed ? 1 : notRun ? 2 : 0 };
}

const LABEL = {
  passed: "ok",
  known: "ok (known)",
  reported: "report",
  failed: "FAILED",
  skipped: "skipped",
  "not-run": "NOT RUN",
};

/** The table printed at the end: every step, its result, its time and where its log is. */
export function summarise(outcome) {
  const lines = [];
  for (const lane of outcome.lanes) {
    const shown = lane.rerun ? lane.rerun.records : lane.records;
    for (const entry of shown) {
      const time = entry.ms === undefined ? "" : formatDuration(entry.ms);
      lines.push(
        `${entry.lane.padEnd(6)} ${(LABEL[entry.status] ?? entry.status).padEnd(10)} ${entry.name.padEnd(48)} ${time.padStart(6)}${entry.note ? `  ${entry.note}` : ""}${entry.logFile ? `\n         log: ${entry.logFile}` : ""}`,
      );
    }
    if (lane.rerun) {
      lines.push(
        lane.rerun.passed
          ? `       ^ lane "${lane.id}" FAILED while the other lanes ran and PASSED on its own: a timeout under load, not a defect (CI runs its jobs on separate machines). The first run's logs are kept.`
          : `       ^ lane "${lane.id}" failed on its own too: a real failure.`,
      );
    }
  }
  const verdict =
    outcome.code === 0
      ? "All CI jobs passed locally."
      : outcome.code === 1
        ? "Something FAILED. Fix it and run again before asking to push."
        : "Nothing failed, but something could not run (NOT RUN above). Say what and why in the pull request.";
  lines.push("", verdict);
  return lines.join("\n");
}
