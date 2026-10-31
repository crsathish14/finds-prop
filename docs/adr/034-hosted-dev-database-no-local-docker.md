# ADR-034 · Hosted dev database, no local Docker

- Status: Accepted (owner decision, 31 Oct 2026)
- Date: 2026-10-31
- Related: R-DB-01, ADR-011, ADR-030, DEC-38, S1-SPK-01

## Context

The plan assumed a local Supabase stack (Docker) for daily work. The development machine runs Windows 11 Home without WSL, so Docker Desktop cannot start. The owner decided on 31 Oct 2026: no Docker; work against a hosted Supabase project and push the database directly to it.

## Decision

1. **No local stack is required.** `npm run db:start`, `db:reset`, `check:db` and `test:integration` stay in `package.json` for anyone who has Docker. They are optional. `npm run doctor` reports a missing Docker as information, not a warning.
2. **Daily database work uses the hosted `findsprop-dev` project.** The owner applies committed migrations to it with `supabase db push` (after `supabase link` to the dev project only). Agents write migration files and pgTAP tests but never run `supabase link`, `db push`, `db reset --linked` or any `--linked` or `--db-url` command; the deny rules and `guard-bash` keep enforcing that.
3. **CI stays authoritative for the database.** The `db` job builds a throwaway stack from an empty database on every PR: migrations policy, schema lint, pgTAP and the generated-types diff. Integration tests and any end-to-end test that needs Supabase run in CI only.
4. **Staging and production are unchanged:** migrations reach them only through CI from `main`, with credentials held in GitHub Environments.
5. **The dev project is disposable.** No real personal data. Test OTP numbers and auth settings that `supabase/config.toml` applies on the local stack must be set on the hosted project in the dashboard (to be recorded in a runbook at Stage 3). Seed scripts still refuse any URL that is not the dev allow-list.

## Consequences

- Setup needs no Docker or WSL, and the first run of the stack no longer blocks work.
- A migration can reach the dev database before CI has checked it. Mitigation: run `npm run check` first, push to dev when the PR's `db` job is green where practical, and fix forward with a new migration (migrations are forward-only, R-DB-02).
- Types: generate them from the dev project or copy the fresh file that the CI `db` job prints when the diff fails; CI decides.
- Without Docker the local gate is lighter. Say so in the PR under "Not run, and why"; CI runs the rest.
- **Residual risk to be aware of.** R-DB-01 previously kept all shared-environment credentials off machines where agents run. Applying migrations from the owner's machine puts a Supabase CLI login and the dev database password there. Defences: the deny rules, `guard-bash`, no password stored in any file (enter it at the prompt), and the dev project holds no real data. If that is not acceptable, the alternative is CI applying migrations to dev when a PR merges to `develop`, with no credentials on the machine.
- Revisit at the start of Stage 3, when the first migration is written.

## Amendment, 1 Nov 2026 (owner decision)

Point 2 changed: **migrations reach `findsprop-dev` only through the `db-deploy.yml` workflow**, which runs `supabase db push` inside CI after a merge to `develop`. This is the alternative the residual-risk note names. Nobody runs `supabase link` or `db push` from a machine, and agents still never do.

- Trigger: automatic on a push to `develop` that changes `supabase/migrations/`, plus a manual retry. It waits for the CI result of the same commit and applies nothing if CI failed.
- Credential: one secret, `DEV_DATABASE_URL` (the Session pooler connection string), in the GitHub Environment `dev`. It reaches only the dev database; no Supabase account token is used, because that would also reach a future production project.
- Trade-off the owner accepted: a merge to `develop` changes the dev database without a second prompt, so only green pull requests are merged. The dev project holds no real data and is rebuildable from migrations.
- Runbook: `docs/runbooks/dev-database-deploy.md`.
