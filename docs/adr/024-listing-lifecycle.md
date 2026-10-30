# ADR-024 · Listing lifecycle — **Approval required (`DEC-09`)**

- Status: Accepted
- Date: 2026-10-29
- Related: Proposed; approval: **Yes (`DEC-09`)**; stage S3

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

State machine in `06 §5`. States: `draft` (new, owner only), `pending`, `approved`, `rejected`, `sold`, `rented`. Rules: owners can set `pending` on submit (from `draft` or after editing `rejected`), `sold`/`rented` only from `approved`; admin alone sets `approved`/`rejected`/`featured`; edit of moderated fields on `approved` resets to `pending` (recommended policy). All enforced by trigger; transitions written to `audit_log`.
