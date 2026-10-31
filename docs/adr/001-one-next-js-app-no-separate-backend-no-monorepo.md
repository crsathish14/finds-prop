# ADR-001 · One Next.js app, no separate backend, no monorepo

- Status: Accepted
- Date: 2026-10-29
- Related: Confirmed; approval: No; stage S1

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Evidence:** ARC "one Next.js app on Vercel… a monorepo can wait until the mobile app starts".
- **Supports:** all requirements; NFR-10.
- **Decision:** single repo, single `package.json`. Keep `src/schemas`-style validation and `types` folders self-contained so they can be extracted into packages later (ARC recommendation).
- **Trade-offs:** no shared-package friction now; one-time move when the mobile app starts.
- **Risk:** low.
