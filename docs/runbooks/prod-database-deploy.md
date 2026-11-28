# Production release and database deploy

Production is released only by `.github/workflows/release-prod.yml` (ADR-201). Vercel does not deploy `main` by itself, nobody runs `supabase db push` against prod by hand, and agents never do, and never approve.

## One-time setup (owner)

1. The GitHub environment `production` exists (created 25 Nov 2026): required reviewer `crsathish14`, "Prevent self-review" off, deployment branch `main` only.
2. In `production`, add the secret `PROD_DATABASE_URL`: prod Supabase project → Connect → **Session pooler** string with the database password filled in. GitHub runners have no IPv6, so the direct connection does not work.
3. In `production`, add the secret `PROD_BACKUP_PASSPHRASE`: a random passphrase of at least 20 characters. Save it in your password manager first. Without it the backups cannot be opened.
4. Vercel → project → Settings → Git → Deploy Hooks: create a hook named `release-prod` for branch `main`. Add its URL as the **repository** secret `VERCEL_PROD_DEPLOY_HOOK` (Settings → Secrets and variables → Actions → New repository secret).

All four must be done before the release that brings this workflow to `main` is merged.

## What a release does

1. **check**: looks for new files in `supabase/migrations/` since the last successful release.
2. **migrate** (only with new migrations): waits for your approval. Open the run (Actions → "Release to production"), click **Review deployments**, tick `production`, then **Approve and deploy**. It checks the release PR's CI, prints the migrations it will apply, makes the encrypted backup, applies, and prints the list.
3. **deploy**: asks Vercel to build `main`, waits until `https://findsprop.com/api/health` shows the new commit, then checks the home page.

A release without migrations skips step 2 and needs no click.

## The first run (look only)

Done on 26 Nov 2026 (run 45759641518 succeeded). Since then every merge into `main` releases by itself: you only approve the `production` step when the release has new migrations. This section stays for a new production project.

Until one run has shown the dry run (step "Show the migrations prod is missing" passed in an earlier run), every run prints the migrations prod is missing and then stops on purpose, so production is not deployed yet. A run that failed before the dry run does not count. Read the list:

- **Empty, or a few recent files**: start the workflow by hand: Actions → "Release to production" → Run workflow → branch `main`, **untick `dry_run`** → approve. It backs up, applies, and deploys.
- **Every file, although prod already has the tables**: prod was set up outside the migration history. **Do not apply.** Applying would fail or damage data. Production keeps running the previous version. A separate repair plan (`supabase migration repair`) is needed first.

## By hand

- **Look only** (the default): Run workflow with `dry_run` ticked. You approve, and it prints the missing migrations. Nothing is changed or deployed.
- **Retry after a failure**: Run workflow with `dry_run` unticked, on `main`.

## If a run fails

- **A secret is missing**: add it (setup above) and run by hand with `dry_run` unticked.
- **CI of the release PR is not green**: nothing was applied. Fix on `develop` and release again.
- **A migration fails**: the failed file is rolled back (each migration is one transaction); earlier files in the same run stay applied. Production was not deployed. Fix forward with a new migration through `develop`, then release again. `supabase/rollbacks/*.sql` are never run automatically (R-DB-03).
- **Smoke step times out** ("did not serve … within 20 minutes"): open the deployment in Vercel. If no build started, the deploy hook did not work. Check the secret, or deploy from the Vercel dashboard (Deployments → latest `main` → Redeploy). If `/api/health` has no `commit`, turn on "Automatically expose System Environment Variables" in the Vercel project settings.
- **Home page not 200**: roll back in Vercel (instant rollback) and follow `release-and-rollback.md` §8.2.
- **GitHub Actions is down**: deploy from the Vercel dashboard. Migrations wait for Actions.

## Restoring a backup

1. Open the run that made it → Artifacts → download `prod-backup-<run id>` and unzip it to get `prod-backup-<run id>.tar.gpg`. It is kept 14 days.
2. Decrypt it on your own computer: `gpg --decrypt prod-backup-<run id>.tar.gpg > backup.tar`, enter the passphrase, then `tar -xf backup.tar` (gives `roles.sql`, `schema.sql`, `data.sql`).
3. Restore into a **new** Supabase project first, never straight over prod. Follow Supabase's guide "Backup and restore using the CLI" (`psql` with `roles.sql`, then `schema.sql`, then `data.sql`). Then decide on re-pointing (release-and-rollback.md §8.2).
4. Delete the decrypted files afterwards. They hold personal data.

## Going private

On GitHub Free a private repository ignores environments. This workflow then stops before applying migrations, and the dev deploy stops too. Decide before switching (ADR-201, Consequences).

## Rotating secrets

- Database password: reset it in Supabase (Project Settings → Database), rebuild the pooler string, and replace `PROD_DATABASE_URL`.
- Deploy hook: delete it in Vercel, create a new one, and replace `VERCEL_PROD_DEPLOY_HOOK`.
- Passphrase: replace `PROD_BACKUP_PASSPHRASE`. Older backups still need the old passphrase.
