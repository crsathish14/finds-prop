# Testing standards

> Source: distilled from the approved implementation plan and AI harness design (30 Oct 2026). References such as `plan 07 §4.2`, `03` §10 or `ADR-009` point to the archived plan, the harness design documents, or `docs/adr/`. From Stage 1 (S1-T12) this repository is authoritative (HD-11).

The named tests (`UT-`, `DB-`, `IT-`, `E2E-`) are listed in `test-catalogue.md`. No coverage percentage is set: completeness is the checklist and the rule-to-test map below.

## Rules

| ID        | Rule                                                                                                                                                                                | Enforced by                                               | Source       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------ |
| R-TEST-01 | A slice carries the tests in plan 08 §9: unit, pgTAP, integration, one E2E main path plus one error path, axe, baselines                                                            | PR template; G-06 (`DB-BR-TRACE`); Review                 | plan 08 §9   |
| R-TEST-02 | Never weaken a test to make it pass: no `.only`, no `.skip` or `.todo` without an issue and date, no deleted assertion without a stated reason, no snapshot update without a reason | G-02 (`no-restricted-syntax` in test files), G-14; Review | plan 08 §8.4 |
| R-TEST-03 | Deterministic tests: no `waitForTimeout`, injectable clock, unique data per test, cleaned up                                                                                        | G-02 (`no-restricted-syntax`)                             | plan 08 §2   |
| R-TEST-04 | External providers are faked. No unit or integration test uses the network, a real SMS or a real email                                                                              | G-08 (CI has no provider keys)                            | plan 08 §2   |
| R-TEST-05 | Fixtures and screenshots contain fictional data only                                                                                                                                | G-12; Review                                              | plan 08 §2   |
| R-TEST-06 | A visual baseline changes only on purpose and with a reviewer's comparison against the UX render                                                                                    | G-10; Review                                              | plan 08 §6   |
| R-TEST-07 | A bug fix starts with a test that fails for the right reason                                                                                                                        | Review                                                    | harness      |
| R-TEST-08 | Authorization tests cover success, unauthenticated, wrong role, wrong owner, invalid input, rate limited                                                                            | G-08                                                      | plan 08 §9   |

## Test pyramid and tooling

| Layer              | Tool                                                                    | Runs against                      | Purpose                                                              | Speed           |
| ------------------ | ----------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------- | --------------- |
| Unit and component | **Vitest** + Testing Library (+ `happy-dom`/`jsdom`)                    | pure code, components with fakes  | Rules, schemas, utilities, UI logic                                  | seconds         |
| Database           | **pgTAP** via `supabase test db`                                        | local Supabase Postgres           | RLS, triggers, constraints, RPC functions, storage policies          | tens of seconds |
| Integration        | **Vitest** with real local Supabase (Auth, Postgres, Storage, Inbucket) | services + fake provider adapters | Data-access, workflows, authorization with real JWTs, route handlers | minutes         |
| End-to-end         | **Playwright**                                                          | production build + local Supabase | Critical journeys, redirects, role access, responsive navigation     | minutes         |
| Accessibility      | `@axe-core/playwright` + manual                                         | Design Lab pages and E2E states   | Automated WCAG checks; keyboard and screen-reader passes             | with E2E        |
| Visual regression  | Playwright `toHaveScreenshot`                                           | Design Lab and key screens        | Component variants and layout at 390 / 820 / 1440                    | with E2E        |
| Performance        | Lighthouse CI + Vercel Speed Insights                                   | preview URL; field data           | LCP/INP/CLS, bundle budget                                           | nightly         |
| Static             | ESLint (flat config), `tsc --noEmit`, token/boundary scripts            | source                            | Style, boundaries, types, no hard-coded values                       | seconds         |

Layout: unit/component tests beside code (`__tests__/`); `supabase/tests/` for pgTAP; `tests/integration/` for Vitest integration; `e2e/` for Playwright; shared fakes and factories in `tests/`.

## Test data, environments and fakes

| Concern            | Approach                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database           | Local Supabase from migrations + `seed.sql`; CI starts it fresh each run                                                                                                                                                                                             |
| Users              | Created via the Auth admin API in a setup file: customer A, customer B (owner), builder A (active), builder B (active), builder C (inactive), admin (reserved email, local only). Phone sign-in uses Supabase **test phone numbers with fixed OTPs**; no SMS is sent |
| Email              | Inbucket (local) read through its HTTP API to follow verification and invite links                                                                                                                                                                                   |
| External providers | Interfaces in `server/{sms,places,mail}` have fakes (`FakeSms`, `FakePlaces` with deterministic Tamil Nadu results, `FakeMail`); CRM target is a local HTTP server that can fail on demand                                                                           |
| Time               | Injectable clock for rate limits, retries (1, 5, 30, 120, 720 minutes) and sweeps                                                                                                                                                                                    |
| Isolation          | Each integration/E2E test creates uniquely named data and cleans it up; a nightly job runs `supabase db reset` and the full suite                                                                                                                                    |
| Images             | Small fixture JPEG/PNG/WEBP, a spoofed file (`.jpg` that is HTML/SVG), an oversize file, an image with GPS EXIF                                                                                                                                                      |
| Seeds              | Deterministic; never contain real data; the seed script refuses to run against non-local/non-dev URLs                                                                                                                                                                |

## Per-feature test checklist (vertical slice)

A slice is not complete unless it has, as applicable:

| #   | Item                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Unit tests for its Zod schemas, pure rules and formatting                                                                   |
| 2   | pgTAP for every migration it adds (RLS cells, triggers, RPC)                                                                |
| 3   | Integration tests for each service function: success, unauthenticated, wrong role, wrong owner, invalid input, rate limited |
| 4   | At least one E2E journey covering its main path (and an error path)                                                         |
| 5   | axe pass on each new page and each designed state                                                                           |
| 6   | Visual baselines for each new screen/state at 390 / 820 / 1440                                                              |
| 7   | Design Lab entries for any new shared component                                                                             |
| 8   | Loading, empty, error, success and rate-limited states implemented as in the UX screen list                                 |
| 9   | Security checklist items from `07` §4.2 ticked                                                                              |
| 10  | Traceability row in `11` updated                                                                                            |

## Business rule to test map

| Rules                                            | Tests                                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| BR-01…06 (auth; superseded for customers by ARC) | `IT-auth-otp`, `E2E-02`, `UT-safe-redirect`; email confirmation intent: `IT-auth-otp` (verification link)        |
| BR-10…15 (roles, builder invite)                 | `DB-TRG-user_roles-guard`, `DB-RLS-agent-has-no-extra-access`, `IT-builder-invite`, `E2E-11`                     |
| BR-20…28 (listing lifecycle, constraints)        | `DB-TRG-properties-guard`, `UT-status`, `IT-status-parity`, `E2E-06/07/08`                                       |
| BR-30…35 (builder isolation, guards)             | `DB-RLS-matrix`, `DB-TRG-builders`, `IT-AUTHZ-builder`, `E2E-10/11/16`                                           |
| BR-40…49 (projects, units, leads, RERA, forms)   | `DB-TRG-projects-guard`, `DB-TRG-units/leads`, `DB-CASCADE`, `E2E-12/13/16`, `UT-dynamic-form`                   |
| BR-50…54 (enquiries, saved)                      | `DB-FN-submit_enquiry`, `DB-RLS-enquiries-*`, `E2E-03/05`                                                        |
| BR-60…67 (forms, CRM)                            | `UT-dynamic-form`, `UT-crm-url`, `UT-retry`, `IT-forms`, `IT-crm`, `E2E-13/14`                                   |
| BR-70…75 (rate limits, visitor hash)             | `DB-FN-rate_limit_hit`, `DB-FN-record_form_submission`, `DB-FN-track_project_event`, `UT-visitor-hash`, `E2E-13` |
| BR-80…83 (CMS)                                   | `IT-sponsors`, `UT-schemas` (CMS), `E2E-15` (defaults merge when table empty)                                    |
| BR-90…93 (search, labels, localities)            | `DB-FN-search`, `UT-search-schema`, `UT-label`, `E2E-01`, `IT-places`                                            |
| BR-94 (project visibility)                       | `DB-RLS-matrix`, `E2E-11/12`                                                                                     |
| BR-73/74/95 (AI)                                 | **Deferred**; reserved test IDs `*-ai` when the phase starts                                                     |

## Done matrix: which commands prove which change

The same table appears in `AGENTS.md` and `docs/engineering/workflow.md`.

| Changed paths                                                        | Minimum to run before saying "done"                                     |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Docs, copy, tests only                                               | `npm run check`                                                         |
| `src/**` (any code)                                                  | `npm run check`                                                         |
| `src/components/**`, `src/styles/**`                                 | plus `npm run test:ds`                                                  |
| `src/features/**` (service, actions, queries), `src/server/**`       | plus `npm run test:integration`                                         |
| `supabase/**`                                                        | plus `npm run check:db` and `npm run gen:types`                         |
| Routes, journeys, navigation                                         | plus `npm run test:e2e:smoke`                                           |
| `package.json`, lockfile                                             | plus `npm run check` (the dependency gate runs inside it) and a PR note |
| `AGENTS.md`, `docs/engineering/**`, `.claude/**`, `scripts/**`       | plus `npm run harness:check`                                            |
| Class C2, or before opening any PR that touches several of the above | `npm run verify`                                                        |
