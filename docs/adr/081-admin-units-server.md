# ADR-081 · Admin units: the server side (S7-T07, part A1)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-065 (listing moderation server, `admin_decision`), ADR-075 (admin builders server), ADR-078 and ADR-079 (the Units page parts), FR-ADM-05, BR-45, DEC-27
- Plan approved by the owner on 8 Nov 2026 ("all approved"): units and leads are built as admin-only server code that the builder portal (S7-T03) can reuse; unit and lead-state changes are audited in the action; a new rate-limit scope and its row in the protected security table are approved. The server side is split into two changes (units here, leads next) so each is small enough to read.

## Decision

- **A new `units` feature, no migration.** The database already lets an admin read, add, change and delete the units of any project (`project_units` policies and column grants), keeps a project's unit numbers unique and never lets a unit move to another project (`guard_project_units`). The rules in code are the validation and the mapping of the database's refusals.
- **The user's own client, not the service role.** `unitStore` acts as the signed-in admin through their cookies, so the policies decide what is allowed and the service-role allow-list (security.md 4.3, `eslint.config.mjs`) is unchanged. The same store, with the builder's session, will serve the builder portal: a builder may write only the units of their own projects, which the integration test shows.
- **Four actions**, all for a super admin: `addUnit`, `updateUnit`, `deleteUnit` and `loadMoreUnits` ("Show more", a read). A write is limited by the new scope **`admin_edit`: 600 per admin per hour** (entering a project of a few hundred units is well inside it; a stuck script is not), refreshes the project's public page and the lists (`tagsAfterProjectChange`, because the units show on it) and adds an audit entry (`unit.created`, `unit.updated`, `unit.deleted`, entity `unit` and its id, with no details of the unit), because the database does not audit units.
- **The rate-limit table in `docs/engineering/security.md` gets two rows,** approved by the owner on 8 Nov 2026: `admin_decision` (120 per admin per hour, in the code since S6-T04 but missing from the table) and the new `admin_edit`.
- **The list is read by unit number.** A page is 25 units; unit numbers are unique in a project, so the number is the cursor and no encoding is needed. A search is a case-insensitive "contains" on the number (`%`, `_` and `\` are letters, not wildcards), the state chip is an exact match, and the count of units the filters match comes from a second, count-only query. The order is the database's text order of the unit number.
- **The floor plan "link" is stored in `floor_plan_path`.** The column is named for a storage path, but uploads were skipped in Stage 5, and the approved form asks for a link. Until uploads exist the column holds an https link (checked: https only, at most 300 characters). A later upload feature stores a path instead and tells the two apart by whether it starts with `https://`.
- **Directions are eight words,** sent in lower case (`north-east`) and stored as the words the public page shows (`North-east`).
- **Three new messages** under `validation.*`: `unitNumberTaken`, `numberInvalid` and `linkInvalid`.
- **Not in this change:** the Units page (a later change connects it), the Leads server code (A2), the builder's own pages (S7-T03).

## Wording to confirm

- "This unit number is already used in this project." (a repeated number, on the number's box)
- "Enter a number." (floor, bedrooms, area or price that is not a number)
- "Enter a full address, starting with https://" (a floor plan link that is not an https address; the same words as the Design Lab specimen of ADR-079)

## Consequences

- No migration, package, gate or environment change. A documented change to the protected security table (two rows) and one new rate-limit scope.
- The integration test (`tests/integration/units.test.ts`) runs in CI against the real local database; it was not run on the developer's machine, because the owner asked that nothing be started locally.
- Rollback: delete the `units` feature, its tests, the `admin_edit` scope and the two documentation rows. Units already written stay as they are.
