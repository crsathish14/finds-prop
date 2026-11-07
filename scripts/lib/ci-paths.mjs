// Which changed files need which CI jobs: one list, read by scripts/ci-changes.mjs in the `changes` job
// of .github/workflows/ci.yml (docs/engineering/quality-gates.md, section 7).
//
// Which of the three expensive jobs (db, integration, build) does a change need?
//
// The rule that keeps this safe: when in doubt, run. An unreadable list of changed files, a change to
// the workflow or the package list, and anything aimed at `main` all run every job. A job is skipped
// only when no changed file can affect it. Skipping is never a pass for a failing job: a skipped job
// is simply not needed, and `all-checks-passed` still fails if any job that did run fails.

/** CI runs every job when one of these changes: they can change how any job behaves. */
export const CI_FULL_PATHS = [
  /^\.github\//,
  /^scripts\/(ci-changes|lib\/ci-paths)/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^\.nvmrc$/,
];

/**
 * The CI db job: migrations policy, pgTAP, seed, generated types, the search performance check.
 * Nothing under src/ (except the generated types) is read by it.
 */
export const CI_DB_PATHS = [
  /^supabase\//,
  /^src\/types\/database\.types\.ts$/,
  /^scripts\/(check-migrations|gen-types|seed-dev|verify-supabase-config)/,
  /^scripts\/lib\/(core|seed-dev-core|verify-supabase-config-core)\.mjs$/,
];

/**
 * The CI integration job: the real src/server code against a real local Supabase. Beyond the database
 * paths, it covers the server-side routes and feature code (queries, services, actions, stores), and the
 * tests import the shared libraries, the types and the config, and a few feature files that hold column
 * lists, schemas and image fixtures.
 */
export const CI_INTEGRATION_PATHS = [
  ...CI_DB_PATHS,
  /^tests\/integration\//,
  /^vitest\.integration\./,
  /^src\/server\//,
  /^src\/app\/(api|auth)\//,
  /^src\/features\/.+\/(queries|service|[\w-]+-service|[\w-]+\.server|store|actions)\.tsx?$/,
  /^src\/(lib|config|types)\//,
  /^src\/features\/media\//,
  /^src\/features\/.+\/(schemas|[\w-]+-schemas|columns|public-columns)\.tsx?$/,
  /^tests\/(setup|stubs|support)/,
  /^vitest\.config\./,
];

/**
 * The CI build job (build, client bundle scan, smoke tests, Design Lab checks) is skipped only when every
 * changed file is one of these: documents, notes for the AI harness, or the database folder.
 */
export const CI_BUILD_SKIP_PATHS = [/^docs\//, /\.md$/, /^\.claude\//, /^supabase\//];

export const CI_JOB_IDS = ["db", "integration", "build"];

const matchesAny = (patterns, file) => patterns.some((pattern) => pattern.test(file));

/**
 * Which of the three expensive CI jobs a change needs.
 * @param {string[] | null} files the changed files (repo-relative, forward slashes), or null if unknown
 * @param {{ everything?: string }} [options] `everything`: run all jobs, with the reason
 * @returns {Record<"db" | "integration" | "build", { run: boolean, why: string }>}
 */
export function selectCiJobs(files, { everything } = {}) {
  if (everything) {
    return Object.fromEntries(CI_JOB_IDS.map((id) => [id, { run: true, why: everything }]));
  }
  if (files === null) {
    return Object.fromEntries(
      CI_JOB_IDS.map((id) => [
        id,
        { run: true, why: "the list of changed files could not be read" },
      ]),
    );
  }
  const full = files.find((file) => matchesAny(CI_FULL_PATHS, file));
  if (full) {
    return Object.fromEntries(CI_JOB_IDS.map((id) => [id, { run: true, why: `${full} changed` }]));
  }
  const decide = (patterns, skipReason) => {
    const hit = files.find((file) => matchesAny(patterns, file));
    return hit ? { run: true, why: `${hit} changed` } : { run: false, why: skipReason };
  };
  const onlyQuiet =
    files.length > 0 && files.every((file) => matchesAny(CI_BUILD_SKIP_PATHS, file));
  return {
    db: decide(CI_DB_PATHS, "no database, type or database-script file changed"),
    integration: decide(CI_INTEGRATION_PATHS, "no database or server file changed"),
    build: onlyQuiet
      ? { run: false, why: "only documents, notes or the database folder changed" }
      : {
          run: true,
          why: files.length === 0 ? "no changed files found" : "application files changed",
        },
  };
}
