// Runs every job CI runs, on this machine, as lanes (R-GIT-05, docs/runbooks/ci-locally.md).
//
//   npm run ci:local                        the lanes this change needs, one after another
//   npm run ci:local -- --all               every lane (small, app, db, linux)
//   npm run ci:local -- --only=app,small    exactly these lanes
//   npm run ci:local -- --parallel          the lanes side by side (a failed lane is run again alone)
//   npm run ci:local -- --pr-event=<file>   also run the pull request check on a drafted title and body
//   npm run ci:local -- --list              what each lane runs
//   other options: --no-rerun  --keep-stack  --base=<ref> (default origin/develop)
//
// Needs the project's Node (.nvmrc), Docker Desktop for the db and linux lanes, the Supabase CLI and
// gitleaks. Each step's output goes to its own log under node_modules/.cache/ci-local/<time>/. It changes
// nothing in the repository, pushes nothing and opens nothing. It is not part of CI, `verify` or any hook.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import {
  buildLanes,
  LANE_IDS,
  parseArgs,
  runPlan,
  selectLanes,
  summarise,
  UsageError,
} from "./lib/ci-local-core.mjs";
import { repoRoot } from "./lib/core.mjs";

const HELP = `Usage: npm run ci:local -- [options]
  (no lane option)  the lanes this change needs: small and app always; db and linux when the changed
                    files can affect the database or a picture (docs/runbooks/ci-locally.md)
  --all             every lane
  --parallel        run the lanes side by side (default: one after another; a lane that fails
                    while the others run is run again on its own, to tell load from a defect)
  --only=a,b        run only these lanes (${LANE_IDS.join(", ")})
  --no-rerun        do not run a failed lane again on its own
  --keep-stack      leave the local Supabase stack running afterwards
  --pr-event=FILE   run the pull request check on this event file (see docs/runbooks/ci-locally.md)
  --base=REF        the branch CI compares with (default origin/develop)
  --list            show what each lane runs`;

const LOG_LIMIT = 400_000;

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, file), "utf8"));
}

function dockerRuns() {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/** The files this branch changes against the base (commits, uncommitted and new files), or null. */
function changedFiles(base) {
  try {
    const git = (args) =>
      execFileSync("git", args, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    const mergeBase = git(["merge-base", base, "HEAD"]).trim();
    const lines = (text) => text.split(/\r?\n/).filter(Boolean);
    return [
      ...new Set([
        ...lines(git(["diff", "--name-only", mergeBase])),
        ...lines(git(["ls-files", "--others", "--exclude-standard"])),
      ]),
    ];
  } catch {
    return null;
  }
}

/** The address and service key of the running local stack, from the Supabase CLI. */
function readStack() {
  const output = execFileSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    shell: process.platform === "win32",
  });
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return { url: values.API_URL, key: values.SERVICE_ROLE_KEY ?? values.SECRET_KEY };
}

/**
 * Waits until the stack's sign-in service answers an administrator's request: it restarts after a reset, and
 * the integration tests' first call fails if it is not back. The answer is only a status, never printed.
 */
async function waitForStack(logFile, timeoutMs = 180_000) {
  const log = fs.createWriteStream(logFile);
  const deadline = Date.now() + timeoutMs;
  let result = { code: 1 };
  try {
    const { url, key } = readStack();
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${url}/auth/v1/admin/users?per_page=1`, {
          headers: { apikey: key, authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(5000),
        });
        log.write(`answered ${response.status}\n`);
        if (response.ok) {
          result = { code: 0 };
          break;
        }
      } catch {
        log.write("no answer yet\n");
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch {
    log.write("could not read the stack's address (is it running?)\n");
  }
  log.end(`\n[exit code ${result.code}]\n`);
  return result;
}

const children = new Set();

function stopAll() {
  for (const child of children) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
}

/** Starts one step, writes everything it prints to its own log file, and keeps the end of it for checks. */
function makeExec(logDir) {
  let counter = 0;
  return (step, lane) =>
    new Promise((resolve) => {
      counter += 1;
      const logFile = path.join(
        logDir,
        `${String(counter).padStart(2, "0")}-${lane.id}-${step.id}.log`,
      );
      if (step.kind === "wait-stack") {
        waitForStack(logFile).then((result) =>
          resolve({ ...result, output: "", logFile: path.relative(repoRoot, logFile) }),
        );
        return;
      }
      const log = fs.createWriteStream(logFile);
      log.write(`$ ${step.command ?? step.argv.slice(0, 6).join(" ")}\n\n`);
      const env = { ...process.env, ...(step.env ?? {}), FORCE_COLOR: "0", NO_COLOR: "1" };
      const options = { cwd: repoRoot, env, stdio: ["pipe", "pipe", "pipe"] };
      const child = step.argv
        ? spawn(step.argv[0], step.argv.slice(1), options)
        : spawn(step.command, { ...options, shell: true });
      children.add(child);
      let output = "";
      const collect = (chunk) => {
        log.write(chunk);
        output = (output + chunk.toString()).slice(-LOG_LIMIT);
      };
      child.stdout.on("data", collect);
      child.stderr.on("data", collect);
      if (step.stdinFile) {
        fs.createReadStream(path.join(repoRoot, step.stdinFile)).pipe(child.stdin);
      } else {
        child.stdin.end();
      }
      const finish = (code) => {
        children.delete(child);
        log.end(`\n[exit code ${code}]\n`);
        resolve({ code, output, logFile: path.relative(repoRoot, logFile) });
      };
      child.on("error", (error) => {
        collect(`could not start: ${error.message}\n`);
        finish(127);
      });
      child.on("close", (code) => finish(code ?? 1));
    });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return 0;
  }

  const nodeMajor = fs.readFileSync(path.join(repoRoot, ".nvmrc"), "utf8").trim().split(".")[0];
  if (String(process.versions.node.split(".")[0]) !== nodeMajor) {
    console.error(
      `This repository runs on Node ${nodeMajor}; this is Node ${process.versions.node}. ` +
        `On Windows: fnm exec --using=<24.x> cmd /c "npm run ci:local"`,
    );
    return 2;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logDir = path.join(repoRoot, "node_modules", ".cache", "ci-local", stamp);
  const outDir = path.join(logDir, "linux-out");
  const playwrightVersion = readJson("package.json").devDependencies["@playwright/test"];

  const all = buildLanes({
    base: options.base,
    nodeMajor,
    playwrightVersion,
    repoRoot,
    outDir,
    prEvent: options.prEvent ? path.resolve(options.prEvent) : null,
    keepStack: options.keepStack,
  });
  let lanes;
  let reasons = [];
  if (options.only) {
    lanes = all.filter((lane) => options.only.has(lane.id));
  } else if (options.all) {
    lanes = all;
  } else {
    const picked = selectLanes(changedFiles(options.base));
    lanes = all.filter((lane) => picked.some((entry) => entry.id === lane.id));
    reasons = picked;
  }

  for (const reason of reasons) {
    if (reason.why !== "always") console.log(`  lane ${reason.id}: ${reason.why}`);
  }
  const left = LANE_IDS.filter((id) => !lanes.some((lane) => lane.id === id));
  if (left.length > 0) {
    console.log(`  left out, not needed by this change: ${left.join(", ")} (--all runs them)`);
  }

  if (options.list) {
    for (const lane of lanes) {
      console.log(`${lane.id}${lane.needs ? ` (needs ${lane.needs.join(", ")})` : ""}`);
      for (const step of lane.steps) {
        console.log(
          `  ${step.name}${step.cleanup ? " (always, at the end)" : ""}${step.report ? " (report only)" : ""}`,
        );
      }
    }
    return 0;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const stamped = () => new Date().toTimeString().slice(0, 8);
  const log = (message) => console.log(`${stamped()} ${message}`);
  log(
    `Running ${lanes.map((lane) => lane.id).join(", ")} ${options.parallel ? "side by side" : "one after another"}. Logs: ${path.relative(repoRoot, logDir)}`,
  );

  process.on("SIGINT", () => {
    stopAll();
    process.exit(130);
  });

  const outcome = await runPlan({
    lanes,
    exec: makeExec(logDir),
    available: {
      docker: lanes.some((lane) => lane.needs?.includes("docker")) ? dockerRuns() : true,
    },
    parallel: options.parallel,
    rerun: options.rerun,
    log,
    now: () => Date.now(),
    portInUse,
  });

  const summary = summarise(outcome);
  fs.writeFileSync(path.join(logDir, "summary.txt"), `${summary}\n`);
  console.log(`\n${summary}`);
  return outcome.code;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    if (error instanceof UsageError) {
      console.error(`${error.message}\n\n${HELP}`);
      process.exit(2);
    }
    console.error(error);
    process.exit(2);
  },
);
