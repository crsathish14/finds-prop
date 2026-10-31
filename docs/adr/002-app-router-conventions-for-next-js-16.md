# ADR-002 · App Router conventions for Next.js 16

- Status: Accepted
- Date: 2026-10-29
- Related: Refined; approval: No; stage S1

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** Server Components by default; `"use client"` only for leaf islands; `await params`/`searchParams`/`cookies()`/`headers()`; `proxy.ts` (not `middleware.ts`); Turbopack default; ESLint flat config run directly; route groups `(public)`, `(auth)`, `(account)`, `(portal)`; every segment that fetches has `loading.tsx` and `error.tsx`; parallel routes avoided unless needed (they require `default.js` in 16).
- **Trade-offs:** modern conventions only; no legacy `middleware.ts`.
- **Risk:** Active LTS ends when Next 17 ships (RISK-23): schedule a review at each major.
