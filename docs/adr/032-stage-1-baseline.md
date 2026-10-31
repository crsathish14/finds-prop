# ADR-032 · Stage 1 baseline: versions, name and small additions

- Status: Accepted
- Date: 2026-10-30
- Related: DEC-02, DEC-10, ADR-003, ADR-005

## Context

The architecture and plan assumed "Next.js 16". The scaffold created on 30 Oct 2026 resolved to newer minors.

## Decision

Baseline: Node 24 (engines >= 22.12), npm 11, Next.js 16.4.3, React 19.3.0, TypeScript 5.9 strict, Tailwind 4.3, Zod 4.6, Vitest 5, Playwright 1.64, ESLint 9.39 (ADR-029). Project, repository, folder and npm package name: `findsprop` (all lowercase). The brand in user-facing copy stays "Find Prop".

Additions the plan was silent on, kept deliberately small: environment variable `APP_ENV` (`local`, `dev`, `staging`, `production`; default `local`) to send `noindex` outside production and to set log verbosity; the template's `partialPrefetching` option stays on because the template enables it with Cache Components, and spike S1-SPK-01 confirms or reverses both.

## Consequences

Cache Components and partial prefetching are provisional until S1-SPK-01 runs against a real Supabase session (needs Docker or a dev project). If the spike fails, set `cacheComponents` and `partialPrefetching` to false and use the `unstable_cache` fallback in plan 05 section 3.
