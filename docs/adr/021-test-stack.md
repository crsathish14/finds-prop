# ADR-021 · Test stack

- Status: Accepted
- Date: 2026-10-29
- Related: Refined; approval: No; stage S1

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** Vitest (+ Testing Library) for unit/component; Vitest against local Supabase for integration; pgTAP (`supabase test db`) for RLS/trigger tests; Playwright for E2E, a11y (`@axe-core/playwright`) and visual snapshots. No coverage % target; see `08`.
