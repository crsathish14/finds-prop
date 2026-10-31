# ADR-006 · Data-access boundaries — **Approval required (scope clarification)**

- Status: Accepted
- Date: 2026-10-29
- Related: Refined; approval: **Yes (scope clarification)**; stage S1

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:**
  - **Reads for pages:** Server Components call `features/*/queries.ts`.
  - **Mutations from our UI:** Server Actions via a single `defineAction()` wrapper (validate → authenticate → authorise → run → normalise errors → audit).
  - **Route Handlers:** machine callers (Send-SMS hook, cron retry, health), the places proxy, and any client-side fetch (map viewport, autocomplete).
  - **TanStack Query** is used **only inside client islands** that need client caching, optimistic updates or polling: saved-heart toggle, autocomplete, map viewport, admin/builder tables with live filters, charts with date ranges. **Search results and detail pages do not use it.** This clarifies ARC's "dashboards, filters, saved homes".
- **Trade-off:** two mental models (RSC vs Query) but each has a clear home.
- **Why approval:** it narrows what ARC's one-line table row might imply.
