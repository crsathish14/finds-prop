# Supabase

Read `docs/engineering/database.md` first. No local stack is required (ADR-034): the owner works against the hosted dev project and CI runs the database checks. Use `docs/engineering/playbooks/new-migration.md`.

1. Schema changes are new files in `supabase/migrations/`: one concern per file, named per the F01 to F11 plan, forward-only. Never edit, rename or delete a migration that exists on `develop`. A new timestamp must sort after the newest on `develop`. (R-DB-02, G-13)
2. Never change schema through Studio or an MCP server. Migrations reach dev only through the `db-deploy` workflow after a merge to `develop`; staging and production only through CI from `main`. You never run `supabase link`, `db push`, `db reset --linked` or any `--linked` or `--db-url` command. (R-DB-01)
3. Every public table: RLS enabled, policies that name the role, no write access for `anon`, column grants for public reads, `(select auth.uid())` form. (R-DB-04 to R-DB-06)
4. `SECURITY DEFINER` functions pin `search_path` and revoke `EXECUTE` from `public`. Prefer `SECURITY INVOKER`. (R-DB-05)
5. Each business rule: a trigger, constraint or policy, plus a named pgTAP test and a BR trace entry. Each new policy, trigger and function has a pgTAP test. (R-DB-07)
6. Multi-step workflows are RPC functions. Cross-system steps are idempotent with compensation. (R-DB-08)
7. Destructive or behaviour-changing migration: rollback note in the PR, a reviewed rollback script for the same timestamp (never auto-run), expand then contract across releases. (R-DB-03)
8. Run `npm run gen:types` and commit the result; CI diffs it. (R-DB-10)
9. Seeds are fictional; seed scripts refuse non-local URLs. No secrets in SQL. (R-DB-11, R-DB-13)
10. After any change here run `npm run check:db` if Docker is available; otherwise push and read the CI `db` job. Report the real result.
