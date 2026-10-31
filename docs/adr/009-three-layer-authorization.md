# ADR-009 · Three-layer authorization

- Status: Accepted
- Date: 2026-10-29
- Related: Refined; approval: Partly (`DEC-05`); stage S3

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** (1) UI visibility (cosmetic); (2) server check in every action/handler/RSC data function via `requireUser()`, `requireRole()`, `requireOwnership()`; (3) RLS + triggers in Postgres as the final authority. Roles stay in `user_roles` with `has_role()`; policies use `(select auth.uid())`-style initPlan wrapping for performance. Staff routes additionally require `aal2` if `DEC-05` selects a second factor that supports it.
- **Never:** service role to bypass authorization in user-facing reads.
