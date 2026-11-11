# ADR-125 · Authorization verification (S8-T04)

- Status: Accepted (part 1: the database; the actions and handlers are added in parts 2 and 3)
- Date: 2026-11-11
- Related: ADR-017 (column grants), ADR-028 and ADR-123 (the audit log), ADR-097 and ADR-121 (functions that run as the caller), plan 07 sections 4.2, 4.3 and 5, `DB-RLS-matrix`, `DB-PRIV`, BR-30 to BR-35
- Plan for S8-T04 approved by the owner on 11 Nov 2026 ("approved"), without the second-factor ("aal2") variants (see "Out of scope").

## What this is

Stage 8 asks for the authorization of the whole system to be checked end to end, not table by table as it was built. Part 1 is the database: two pgTAP files that say, in one place, who may do what, and fail when anything drifts.

## Decision

- **`rls_matrix.test.sql`: three layers over every public table.**
  1. **Privileges.** For each of the 23 tables, the privileges `anon`, `authenticated` and `service_role` hold (select, insert, update, delete, truncate; select, insert and update count when held on any column, as the column grants are). Neither `anon` nor `authenticated` holds truncate anywhere (the service role does, on every table but the audit log, which is the platform default for the server-only role and the same on the hosted project); `anon` holds select only, on the tables the public site reads; the audit log has select for the admin and nothing else for any role (it is written only by definer functions).
  2. **What each person can see.** Seven people (a visitor; customers A and B, each with a verified phone; active builders A and B; an inactive builder C; the admin) each read the fixtures of every table, and the list of rows each can see is compared with the policy table of plan 07 section 5. It includes the cases that matter most: customer B cannot see customer A's draft or pending listing, nobody but the two parties and the owner sees an enquiry, a builder sees only their own projects, units, leads and events, an **inactive builder sees none of their own pending projects** (the immediate effect of deactivation), a visitor sees only approved listings and live projects, and the server-only tables (secrets, tokens, rate limits, idempotency keys, app configuration) are invisible even to the admin through a client.
  3. **What each person can write.** About a hundred writes are tried as the person named and always undone: an edit, a delete or an insert that would succeed for the right person, so that a refusal is the policy's and not a typing mistake. Each is shown with its result in the test's name (`yes`, or `no` with the reason: no privilege, a policy, a trigger, or no row changed).
- **Inventory guard.** The tables are compared with the list in the file: a new public table without a row in the matrix fails the test, so authorization is decided when a table is made, not found later.
- **`function_grants.test.sql`: who may run each public function.** Visitors: five read-only helpers (`listing_is_public`, `listing_label`, `project_is_live`, `public_project_form`, `search_properties`). Signed-in people: those plus the helpers the policies call and the functions the portals use, each of which checks the caller itself (32 more). Everything else is for the service role only, and no trigger function can be run by a visitor or a signed-in person. A new function, or a changed grant, fails the test until the lists are updated on purpose.
- **The hosted dev database was read, not changed,** to check that these lists are the real state and not only what the migrations say: the privileges on every table and function were read (catalog only, no row of data) and match. The one difference is below.

## Findings

- **`public.rls_auto_enable()` is open to visitors on the hosted project and is not in our migrations.** It is Supabase's own event-trigger function (it switches row-level security on for each new table, and the project's `ensure_rls` event trigger runs it). It returns `event_trigger`, so PostgreSQL refuses to run it as an ordinary function (it can only be fired by the event), and it pins its `search_path`. No action is needed, and it is left alone (it is a platform feature that protects new tables). The catalogue test leaves event-trigger functions out for this reason; the local and CI databases do not have it.
- **The admin cannot change a listing, an enquiry, a photo or a person's name directly,** only through the moderation and close functions, and only the owner moves an enquiry on. This is the design (the matrix records it as "no"); it is written here so that nobody takes it for a gap.
- **Results of the first CI run, and any hole it shows, are added here before this change is merged.** The matrix was written from the migrations and checked against the hosted database's privileges; the row and write expectations were not run until CI (no local database), so a mismatch is either a wrong expectation (fixed in the test) or a real finding (reported, and fixed in its own change).

## Out of scope

- **The second factor ("aal2" variants of the matrix).** The roadmap lists them, but the owner decided on 1 Nov 2026 that staff sign in with Google only, with no second step (`docs/runbooks/staff-google-sign-in.md`). There is no aal2 condition in any policy, so there is nothing to vary. If a second factor is added later, the matrix gains an "aal1 admin" person.
- **The actions and route handlers** (the access level of every action, a wrong owner for every action that takes an id, the six handlers' refusals) are parts 2 and 3 of S8-T04.

## Consequences

- No migration, package, environment, CI, gate or protected-file change; two pgTAP files that run in CI. They read the real roles and policies, so they pass or fail with the migrations.
- Adding a table, a policy, a grant or a function now means adding its row here, in the same change.
- Rollback: delete the two test files and this ADR.
