# Running every CI job locally, before a push

Rule R-GIT-05 (owner, 7 Nov 2026): before you ask to push, run every job CI runs, on the same commit, and fix what fails first. CI should pass on its first run. If one truly cannot run on your machine, the pull request says which and why ("Not run, and why"). Never report a check as passed that you did not run.

The jobs are in `.github/workflows/ci.yml`. This page is the local version of each one. Use the repository's Node (`.nvmrc`, Node 24; on Windows `fnm exec --using=24.22.2 cmd /c "<command>"` from PowerShell).

## Needs

- Docker Desktop running (the local Supabase stack and the Linux picture check need it). The first `supabase start` downloads a few gigabytes of images.
- The Supabase CLI at the version CI pins (see `ci.yml`, `supabase/setup-cli`).
- `npx playwright install chromium` once; WebKit and Firefox are optional (used for browser spikes, not by CI).
- `gitleaks` at the version CI pins.

## The jobs

| CI job              | Run locally                                                                                                                                                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| static              | `npm run check` (format, lint, types, unit tests, policy), then `npx knip` (a report only)                                                                                                                                                                                                                 |
| unit                | part of `npm run check`                                                                                                                                                                                                                                                                                    |
| db                  | `node scripts/check-migrations.mjs --base origin/develop`, `supabase start`, then `npm run check:db` (it resets with and without the seed, lints, runs pgTAP, the seed tests, the seed-dev tests and the generated-types check), then the search performance check below, then `supabase stop --no-backup` |
| integration         | `supabase start` then `npm run test:integration`                                                                                                                                                                                                                                                           |
| build and e2e smoke | the CI-style build below, `npm run test:e2e:smoke`, then the Design Lab checks below                                                                                                                                                                                                                       |
| security            | `npm audit --omit=dev --audit-level=high` and the secret scan below                                                                                                                                                                                                                                        |
| pr-policy           | the pull request check below, run on the drafted title and body before the pull request is opened                                                                                                                                                                                                          |

`npm run verify` runs check, check:db, test:integration, build, test:ds and the smoke tests in one go. It does not run knip, the migrations check against the base branch, the performance check, the audit, the secret scan or the pull request check, so those are run on their own.

### CI-style build

CI builds with placeholder values. Set them first, or the build reads your own environment and behaves differently:

```
APP_ENV=local NEXT_PUBLIC_SITE_URL=http://localhost:3000 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=ci-placeholder-key NEXT_PUBLIC_TURNSTILE_SITE_KEY=
npm run build
```

The Playwright tests start `next start` themselves on port 3100 (the smoke tests and the Design Lab). Stop a stray server on that port first, and stop yours afterwards: stopping a background server can leave its child process listening.

### Smoke tests

`npm run test:e2e:smoke`. With no Supabase running, four tests wait for the network to go quiet and time out on Windows (the header accessibility check and the three `/auth` text checks); CI passes them. They fail the same way with the local Supabase stack running (checked 7 Nov 2026), so the stack does not fix them. A failure that is not one of these four is real.

### Design Lab checks and pictures

`DESIGN_LAB_VISUAL=compare npm run test:ds`. The stored pictures are Linux pictures, so on Windows the picture comparison cannot match. Run the compare step inside the Linux Playwright image that matches the pinned version (`mcr.microsoft.com/playwright:v<version>-noble`, version from `@playwright/test` in `package.json`), with a Linux `npm ci` inside the container (not the Windows `node_modules`). Without Docker, run `npm run test:ds` for the accessibility, scroll and keyboard checks and read the picture result from CI.

The two tallest boards (Domain, Discovery) are photographed whole, about 50,000 px tall at 1440 px and 72,000 px at 390 px. On a slower machine, or inside Docker, that can take longer than the 30 second test timeout and fail with `page.screenshot: Test timeout`. That is the machine, not the picture. For a local run, add `--workers=1 --timeout=240000` on the command line (for example `npx playwright test --project=design-lab --workers=1 --timeout=240000 -g "board (domain|discovery)"`). Never change the timeout in the repository to make a run pass.

A Windows run with `DESIGN_LAB_VISUAL=compare` also writes a new `*-design-lab-win32.png` next to every stored picture (Playwright makes a baseline for the platform it runs on when none exists), about 54 untracked files. They are never used by CI and must not be committed: delete them (`git status` shows them as untracked) or, better, run the picture comparison in the Linux container only and run Windows without `DESIGN_LAB_VISUAL`.

A picture baseline changes only on purpose, only after the owner approves the pictures, and in its own commit (R-TEST-06; `docs/engineering/testing.md`). If the first run of a new Design Lab entry has no baseline, its pictures are the ones to show the owner; never raise the tolerance or skip a page.

### Search performance check

After `npm run check:db` (it needs the seeded data and the running stack):

```
docker exec -i supabase_db_findsprop psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -v p95_limit=100 -v runs=200 < supabase/perf/search-spike.sql
```

It leaves 10,000 fictional listings in the local database; reset it (`supabase db reset`) before running the database tests again.

### Secret scan

`gitleaks detect --redact --no-banner --config .gitleaks.toml` scans the whole history of every local branch, as CI does for the branch it checks. A flagged value in an old commit stays flagged: only a clean branch fixes it. To look at one branch only: `--log-opts "origin/develop..HEAD"`. Test fixtures that look like secrets (a long random-looking value assigned to a name with `key`, `token` or `secret` in it) are the usual cause; use obviously fake, low-entropy values.

### Pull request check

The check reads the pull request from the event file named in `GITHUB_EVENT_PATH`. Make a file with the drafted title and body, then run it:

```
{ "pull_request": { "title": "<title>", "body": "<body>", "base": { "ref": "develop" }, "head": { "ref": "<branch>" } } }
GITHUB_EVENT_PATH=<that file> node scripts/check-pr.mjs
```

## After a failure

Find the cause and fix it locally; run the job again and then the others that could be affected (a change to a database function can change the generated types and the integration tests). Do not push to see what CI says.

## Rules

- This page changes only with `ci.yml`: when a job or a pinned version changes there, change it here in the same pull request.
- Pushing still needs the owner's yes every time, and merging is the owner's.
