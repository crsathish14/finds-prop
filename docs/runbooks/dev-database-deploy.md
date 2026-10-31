# Dev database deploy

Migrations reach `findsprop-dev` only through the workflow `.github/workflows/db-deploy.yml` (ADR-034, amended 1 Nov 2026). Nobody runs `supabase link` or `supabase db push` by hand, and agents never do.

## When it runs

- Automatically after a merge to `develop` that changes `supabase/migrations/`. It first waits for the CI result (`all-checks-passed`) of the same commit and applies nothing if CI failed.
- By hand, to retry after a failed run: Actions, "Deploy database to dev", Run workflow, branch `develop`. It refuses any other branch.

## What it does

1. Runs the migrations policy check.
2. Waits for CI on that commit.
3. Prints a dry run (the list of migrations that will apply), applies them, then prints the applied list.

A newer run waits for an older one and then applies everything still pending, so two quick merges are safe.

## Credentials

One secret, `DEV_DATABASE_URL`, in the GitHub Environment `dev`: the Supabase **Session pooler** connection string of the dev project with its database password filled in. It reaches only the dev database. Nothing else is stored, and it is never printed or pasted into chat.

To rotate it: reset the database password (Supabase, Project Settings, Database), rebuild the string, replace the secret.

## If a run fails

- **CI did not pass:** fix on a branch and merge again. Nothing was applied.
- **A migration fails on dev:** read the step log. A migration is transactional, so the failed file is not half applied. Fix forward with a new migration (never edit one that is on `develop`), merge it, and the next run applies the rest.
- **Extension or permission error on the hosted project** (for example `pg_cron`): enable the extension in the Supabase dashboard, then re-run the workflow.
