# ADR-017 · Public projections

- Status: Accepted
- Date: 2026-10-29
- Related: Proposed; approval: Inform; stage S3

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** `REVOKE SELECT` on listing tables from `anon`; `GRANT SELECT (explicit columns)`; RLS filters rows. All reads name columns; a lint rule bans `.select('*')`. Fixes ANA gap 4 (public queries returned `owner_id`).
