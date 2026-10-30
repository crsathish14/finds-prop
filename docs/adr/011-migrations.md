# ADR-011 · Migrations — **Decided (option A: fresh schema)**

- Status: Accepted
- Date: 2026-10-29
- Related: Changed from ARC step 4; approval: **Decided: option A**; stage S3

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision (your answer, 29 Oct 2026):** write a **fresh schema**; do **not** copy the demo's migrations. Derive it from `06-business-rules-and-data.md`, the table/policy/trigger descriptions in `07-supabase-interactions.md`, the page and form specifications, and the architecture; raise ambiguities as questions instead of reading them out of the demo's code. Order and content in `06 §10.1` (F01–F11); forward-only; destructive changes use expand/contract; each migration reviewed in a PR and applied to an empty database in CI with pgTAP proving each business rule.
- **Alternative rejected:** squash into a clean baseline. Cleaner, but loses traceability to DEMO and breaks ARC's explicit instruction. May be revisited just before the first prod deploy (no prod history exists yet).
