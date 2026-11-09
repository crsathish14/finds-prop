# ADR-094 · The builder portal: units and leads, the server side (S7-T03, step C1)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-081 (the admin's unit actions), ADR-082 (the admin's lead actions), ADR-093 (the projects pages), BR-31 (a builder sees only their own), BR-46 and BR-47 (a lead stays with its project; a builder changes only the state), FR-BLD-03, FR-BLD-04
- Plan for S7-T03 approved by the owner on 9 Nov 2026 ("T03 approved"); the owner confirmed the new rate-limit row below on 9 Nov 2026.

## Decision

- **Six builder actions, built from the admin's.** `addMyUnit`, `updateMyUnit`, `deleteMyUnit` and `loadMoreMyUnits` (the units half), and `setMyLeadStatus` and `loadMoreMyLeads` (the leads half) take the same inputs, cache tags and audit entries as the admin's actions (`unit.created`, `unit.updated`, `unit.deleted`, `lead.status_changed`, with the builder as the actor), for the **builder role** (the role and an active record, agents included). The services are the admin's, which already take any signed-in client.
- **The user's own session decides whose rows.** The actions run as the signed-in builder, not the service role, so the database's policies apply: a builder writes only the units of their own projects (`project_units` policies), reads only the leads of their own projects and changes only a lead's state (`project_leads` policies and its guard, BR-47). A unit on another builder's project is refused ("not allowed"); saving or deleting a unit, or changing a lead, that is not theirs is "not found", and nothing changes. A builder has no form submissions, so there is no builder version of that read.
- **One read needs an extra check.** The policies of `project_units` let any signed-in person read the units of a live project (they are public on the project page), so "the builder's own units" is not what the table alone gives. `readMyUnitsPage` first checks that the project is in the builder's own list (`my_projects()`) and answers nothing otherwise; the builder's Units page and "Show more" both use it, and "Show more" answers "not found" for a project that is not theirs. The project picker is the builder's own projects (`readMyProjectOptions`).
- **A new rate-limit scope, `builder_edit`: 300 per builder per hour,** for a builder's unit and lead changes (and the profile, step D). Half the admin's 600, since a builder works on their own inventory only. The two "Show more" reads have no limit of their own, as the admin's. The scope is added to the closed list (`src/server/rate-limit/limits.ts`, with its test) and to the rate-limit table in `docs/engineering/security.md`, a protected document: **the owner confirmed the row on 9 Nov 2026.**
- **Not in this change:** the pages (`/builder/units`, `/builder/leads`, step C2), the profile (step D), the dashboard and insights (step E).

## Consequences

- New configs and actions beside the admin's, one scope, two reads, and their tests (unit tests of who may call each action and what each runs; integration cases, run only in CI, that a builder cannot read, add, change or delete another builder's units or leads). No migration, package, environment or CI change.
- `docs/engineering/security.md` gains one row (`Builder edit`), so the PR's Gate-change line names it.
- Rollback: delete the builder actions and configs, the two reads, the `builder_edit` scope, its test line and its documentation row. Nothing written stays wrong: units and lead states already saved are ordinary rows.
