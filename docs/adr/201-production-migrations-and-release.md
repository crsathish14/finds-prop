# ADR-201 · Production release: migrate first, then deploy, with the owner's approval

- Status: Accepted. Plan approved by the owner in chat on 25 Nov 2026 ("Approve"; prod Supabase is on the Free plan; "Proceed").
- Date: 2026-11-25
- Related: ADR-034 (dev database deploy), ADR-011 (migrations), R-DB-01, R-DB-03, `docs/runbooks/release-and-rollback.md` §8.1
- Class: C2 (production and secrets). No migration, no dependency, no new visitor words.

## Context

`db-deploy.yml` applies migrations only to `findsprop-dev`, from `develop`. Nothing applied migrations to production. Vercel deployed `main` as soon as a release merged, so a release could go live before the tables or functions it needs existed. The release checklist (§8.1) already asked for back up → migrate → deploy → smoke with the owner approving a `production` environment, but none of it was built. The prod Supabase project is on the Free plan, which has no backups (Supabase recommends `supabase db dump` kept elsewhere).

## Decision

- **One workflow, `.github/workflows/release-prod.yml`, releases `main`.** It runs on every push to `main` (the merge of a release pull request), and by hand from `main`.
- **Vercel no longer deploys `main` by itself.** `vercel.json` sets `git.deploymentEnabled.main` to `false`. Previews and the `dev` environment on `develop` are unchanged. The workflow starts the production build with a Vercel deploy hook.
- **Jobs, in order:**
  1. `check` (no secrets): were files added under `supabase/migrations/` since the last successful release run on a merge? A run started by hand always goes on to `migrate`.
  2. `migrate`, only when there are new migrations: uses the GitHub environment **`production`** (required reviewer: the owner; branch: `main` only), so it waits for the owner's Approve click. Then it stops if a secret is missing, runs the migrations policy (G-13), checks that the commit is a merged release pull request whose `all-checks-passed` is green, prints a dry run, takes a backup (roles, schema, data with `supabase db dump`) **encrypted with AES-256** using `PROD_BACKUP_PASSPHRASE`, keeps it 14 days as a workflow artifact, applies (`supabase db push`, never the seed), and prints the applied list.
  3. `deploy`, only when `migrate` passed or was skipped: calls the deploy hook, waits until `/api/health` reports the new commit (it now includes `commit` from `VERCEL_GIT_COMMIT_SHA`), then checks that the home page answers 200.
- **The first run only looks.** The very first run of the workflow prints the dry run and stops before applying or deploying. The owner reads the list and then starts the workflow by hand with `dry_run` unticked. A run by hand defaults to look-only.
- **Secrets, set by the owner only:** `PROD_DATABASE_URL` (Session pooler string) and `PROD_BACKUP_PASSPHRASE` in the `production` environment; `VERCEL_PROD_DEPLOY_HOOK` as a repository secret, so a release without migrations needs no approval. The hook can only rebuild the latest `main`.
- **Agents never approve.** `.claude/hooks/guard-bash.mjs` refuses `gh api` calls on `pending_deployments` and deployment protection rules, in any form.

## Consequences

- A release with migrations stays on the old version until the owner approves and the migration succeeds. If it fails, nothing is deployed, and the database stays at the last migration that worked (each migration is one transaction). Expand then contract (R-DB-03) keeps the old app working on the new schema in between.
- A release without migrations deploys about a minute later than before, with no approval.
- The backup holds personal data, so it is never stored unencrypted. Without the passphrase it cannot be used, so the owner keeps it in a password manager. Files in Supabase Storage are not in it (only their database rows).
- **Going private on GitHub Free:** a private repository on Free ignores environments (no approval, no branch rule, no environment secrets). The migrate job then has no database secret and stops, so releases with migrations are not applied or deployed; releases without migrations still deploy. `db-deploy.yml` (dev) would also stop, because `DEV_DATABASE_URL` is an environment secret. Before the repository goes private, decide: GitHub Pro, or rework both workflows (a by-hand-only run with repository secrets).
- If GitHub Actions is down, production can still be deployed from the Vercel dashboard (Redeploy). Migrations then wait for Actions.
- Not verified before the first release: that a deploy hook still builds `main` while `deploymentEnabled.main` is `false`, and that `VERCEL_GIT_COMMIT_SHA` is set at run time. If either fails, the smoke step fails after 20 minutes and production stays on the old version. The runbook says what to do.

## Tests

- `src/app/api/health/__tests__/route.test.ts`: the probe adds `commit` on Vercel and leaves it out elsewhere; the existing health tests are unchanged.
- `scripts/__tests__/guard-bash.test.mjs`: approving a deployment through `gh api` is refused, also with `--method=POST` and `-XPOST`.
- The workflow itself is proven by its first run (look-only) on the next release.
