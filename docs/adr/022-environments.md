# ADR-022 · Environments — **Approval required (`DEC-20`)**

- Status: Accepted
- Date: 2026-10-29
- Related: Refined; approval: **Yes (`DEC-20`)**; stage S1/S8

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** local-first (Supabase CLI stack) → `findsprop-dev` (Vercel Preview + a stable `develop` deployment) → `findsprop-prod` (Vercel Production, `main`). **Recommended addition:** a `findsprop-staging` project before launch, or promote `develop`+dev as staging with a pre-launch rehearsal on a prod-shaped restore. Preview deployments **never** receive prod secrets. Supabase callbacks (SMS hook, cron, auth redirects) target a **stable** dev URL, not per-PR preview URLs.
- **Branch model (`DEC-02`):** `main` (prod) ← `develop` (dev) ← short-lived feature branches.
