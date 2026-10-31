# Playbook: new migration (class C2)

Read `AGENTS.md` and the nested file for the folder first.

1. Plan approved: which BR rules, which F-step, rollback, effect on running app (expand then contract).
2. Look at the newest migration on `develop`; choose a later timestamp; name per the F-plan.
3. Write SQL: one concern; RLS enabled; policies name the role and use `(select auth.uid())`; column grants; functions with pinned `search_path`; constraints; indexes tied to a query.
4. Write pgTAP beside it (impersonation helpers), update the BR trace.
5. With Docker: `npm run db:reset`, `npm run check:db`, `npm run gen:types`. Without Docker: push the branch and read the CI `db` job, which prints the fresh generated types if they differ. Commit migration, tests and types (migration in its own commit).
6. Destructive or behaviour-changing: rollback note and `supabase/rollbacks/<timestamp>.sql`.
7. Update seeds and `database.md` (ER or policy table). You never apply it to a shared environment: after the merge to `develop` the `db-deploy` workflow applies it to dev (ADR-034, runbook `docs/runbooks/dev-database-deploy.md`); staging and production are CI only.
