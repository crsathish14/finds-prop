// S3-T14: checks a Supabase project's Auth settings against what the app expects (plan 09 section 7).
// The OWNER runs it from their own terminal; agents never do (it needs a personal access token, which
// is for a whole Supabase account). It only reads: one GET of the project's Auth settings. It never
// prints a token, a secret or a setting's value: only which check passed, failed or warned.
//
//   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."     (PowerShell; create one in the dashboard, Account, Access Tokens)
//   node scripts/verify-supabase-config.mjs --project-ref <20 letters> --site-url https://<the app's address>
//
// Options: --environment dev|staging|production (default dev), --strict (a warning also fails the run).
// Close the terminal, or delete the token in the dashboard, when you are done. Runbook:
// docs/runbooks/supabase-config-checklist.md.
import {
  evaluateSettings,
  fetchAuthSettings,
  summarise,
  VerifyRefusal,
} from "./lib/verify-supabase-config-core.mjs";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const environment = option("environment") ?? "dev";
  const siteUrl = option("site-url");
  const settings = await fetchAuthSettings({
    fetch,
    token: process.env.SUPABASE_ACCESS_TOKEN,
    ref: option("project-ref") ?? process.env.SUPABASE_PROJECT_REF,
    environment,
  });
  const { lines, exitCode } = summarise(evaluateSettings({ settings, environment, siteUrl }), {
    strict: process.argv.includes("--strict"),
  });
  console.log(`verify-supabase-config: ${environment}`);
  for (const line of lines) console.log(line);
  process.exit(exitCode);
}

main().catch((error) => {
  const kind = error instanceof VerifyRefusal ? "refused" : "failed";
  console.error(`verify-supabase-config: ${kind}: ${error.message}`);
  process.exit(1);
});
