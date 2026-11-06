# ADR-017 · Public projections

- Status: Accepted
- Date: 2026-10-29
- Related: Proposed; approval: Inform; stage S3

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** `REVOKE SELECT` on listing tables from `anon`; `GRANT SELECT (explicit columns)`; RLS filters rows. All reads name columns; a lint rule bans `.select('*')`. Fixes ANA gap 4 (public queries returned `owner_id`).

## Verification (S4-T13, 6 Nov 2026)

The decision was built in Stage 3 (column grants on the listing, project, builder, form and site tables; DEC-35 as a generated `public_location` rounded to 0.001°, about 100 m, while projects keep exact coordinates). S4-T13 adds the tests that keep it true:

- **`supabase/tests/public_projections.test.sql`** (`DB-RLS-column-grants`): the exact set of columns `anon` can read on every table of the `public` schema, written out in the test, so a later migration that grants one more column fails until someone agrees it is public; a named list of columns that must never be readable; the same columns for a signed-in customer; the four functions `anon` can run (the search, the label and the two helpers the row policies call); and the rounding of a home's point against the exactness of a project's.
- **`tests/integration/public-queries.test.ts`** (`IT-queries`): the select strings the public pages send, run as a visitor against the real database. Only approved homes and live projects of active builders come back, with exactly the keys asked for; a read that names a private column or `*` is refused (`42501`); the search returns the rounded point; the lead, event and rate-limit functions refuse a visitor.
- **`src/features/__tests__/public-columns.test.ts`** (runs without a database): no select string names an owner, a moderation state, a private link or a builder's private contact. The homepage and sitemap strings moved into `columns.ts` files so the tests check the strings the pages send.

Public by design, and recorded as such in the allowlist: a project's contact phone, RERA number, address and exact coordinates; a form's fields and project link; all of `site_settings`. Nothing in the database changed.
