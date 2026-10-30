# Definition of done

> Source: distilled from the approved implementation plan and AI harness design (30 Oct 2026). References such as `plan 07 §4.2`, `03` §10 or `ADR-009` point to the archived plan, the harness design documents, or `docs/adr/`. From Stage 1 (S1-T12) this repository is authoritative (HD-11).

What "done" means at each level. A pull request or stage that does not meet its level is not done, regardless of how it looks in a demo.

---

## 1. Project-wide (every pull request)

- [ ] Linked to requirement IDs (`FR-*`) and UX screen keys in the PR description.
- [ ] All required CI checks pass (`08` §8.1): lint (incl. import boundaries, a11y, token and raw-element rules), types (and generated DB types), unit/component, database + integration, production build, E2E smoke, Design Lab axe/visual, dependency audit, gitleaks.
- [ ] No new `any`, `@ts-ignore`, `eslint-disable`, `console.log`, or TODO without an issue link.
- [ ] No hard-coded colours, spacing steps outside the scale, or raw `<button>/<input>/<a>` in features or pages.
- [ ] No duplicate of an existing shared component (PR checkbox "searched `components/` and the Design Lab").
- [ ] No secrets, tokens, real personal data, or `.env` values in code, tests, fixtures, logs or screenshots.
- [ ] Server code that touches data follows the checklist in `07` §4.2.
- [ ] Documentation updated when behaviour, configuration or architecture changed (ADR for significant choices).
- [ ] Reviewed by someone other than the author (CODEOWNERS for `components/**`, `styles/**`, `supabase/**`, `src/server/**`).
- [ ] Traceability row in `11` updated.
- [ ] PR template complete: change class, real verification results (anything not run is stated), new-dependency note, AI-assistance disclosure and a `Gate-change:` line (`../property-platform-ai-harness/05`, `G-17`).
- [ ] No gate, hook, lint rule, test or instruction file was weakened or bypassed to obtain a green result (`R-AI-04`, `R-TEST-02`).

---

## 2. Feature slice (a user-visible capability)

A slice is done only when **all** of the following exist:

**Product and UX**

- [ ] Matches the approved UX screen(s) at 390 / 820 / 1440 (and 1024 / 1280 without overflow), reviewed against `final-ux/renders/`.
- [ ] Every designed state implemented: default, loading, empty, no matches, validation error, success, failed action, auth required, confirmation, rate limited, not found, long text, missing optional data (where the screen has it).
- [ ] Copy matches the UX; any new wording is flagged to you.
- [ ] Proposed items are included only if approved (`DEC-*`); otherwise they are absent, not hidden-but-live.

**Frontend**

- [ ] Server Component by default; client islands are leaf-level `*.client.tsx`.
- [ ] Forms: shared Zod schema, errors linked to fields, first error focused, typed values preserved on failure, double-submit prevented, idempotency where it matters.
- [ ] URL is the source of truth for filters/tabs/pagination where the UX says so.
- [ ] Images via `next/image` with `sizes`, fixed aspect ratios, fallbacks.
- [ ] Metadata, canonical and `noindex` set per `05` §12.

**Backend and data**

- [ ] Reads use explicit columns and the right Supabase client; writes go through a Server Action → service → RPC/table with the user's JWT; service role only if allow-listed.
- [ ] Business rules enforced in the service **and** in the database (trigger/RLS/constraint); error codes normalised.
- [ ] Multi-step writes are atomic (RPC) or have explicit compensation.
- [ ] Rate limits applied where the caller can be anonymous or the action is abusable.
- [ ] Audit entries for sensitive actions.
- [ ] Cache tags set and invalidated for public data.

**Authorization and security**

- [ ] Verified at all three layers: UI visibility, server check, RLS. A test proves the server and RLS layers independently reject unauthorised calls.
- [ ] IDOR checked: another user's id returns `NOT_FOUND`.
- [ ] Inputs validated and bounded; uploads validated server-side; output escaped.
- [ ] Items in `07` §15 for the current stage ticked.

**Tests** (`08` §9)

- [ ] Unit tests for schemas and pure rules.
- [ ] pgTAP for every migration it adds.
- [ ] Integration tests: success, unauthenticated, wrong role, wrong owner, invalid input, rate limited.
- [ ] At least one E2E for the main journey plus one error path.
- [ ] axe passes for each page and state; keyboard path verified; focus management tested.
- [ ] Visual baselines for each new screen/state at three widths.

**Operations**

- [ ] Logs are structured and redacted; failures produce a request id; relevant alerts/queries documented.
- [ ] Feature flag and rollback note if the slice is risky or gated.

---

## 3. Shared component

- [ ] Lives in the correct layer folder (`ui`, `patterns`, `layout`, `domain`, `charts`) and imports only downward.
- [ ] Props typed; variants via `cva`; no inline styles; tokens only.
- [ ] Design Lab page shows all variants and states, including long-text and missing-data cases.
- [ ] Specification header present (purpose, props, responsive, a11y, states, dependencies, tests, design reference).
- [ ] Keyboard and screen-reader behaviour matches `final-ux/interaction-specifications.md` §14; axe clean.
- [ ] Tests: behaviour (RTL), registry entry, visual baseline.
- [ ] Complex accessible behaviour comes from Radix/shadcn or an established library, not a custom re-implementation.
- [ ] Reviewed by the design-system owner.

---

## 4. Database migration

- [ ] One concern; reviewed; named in the order of `06` §10.
- [ ] Applies to an empty database and on top of the previous chain in CI; idempotent where safe.
- [ ] RLS enabled with explicit policies; no broad grants; column grants for public tables; `SECURITY DEFINER` functions pin `search_path` and restrict `EXECUTE`.
- [ ] Constraints, indexes (with the query that needs them), and triggers included; vocab parity test updated.
- [ ] pgTAP tests for new policies/triggers/functions.
- [ ] Generated types regenerated and committed.
- [ ] Rollback note; destructive changes use expand/contract and a reviewed rollback script.
- [ ] Seed data updated; no production data in seeds.

---

## 5. Server Action / Route Handler

- [ ] Built with `defineAction` (or equivalent handler wrapper): parse → authenticate → authorise → rate limit → idempotency → run → invalidate → audit → normalise.
- [ ] Uses identity from the verified session; ignores client-supplied identity/role/owner/status.
- [ ] Returns `ActionResult` with a closed error-code set; no stack traces or DB messages.
- [ ] Webhook/cron handlers verify signature/token before work and are constant-time.
- [ ] Covered by integration tests for each caller class.

---

## 6. Stage exit

| Stage | Done when (summary; details in `10`)                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| S0    | Decision log signed; accounts exist; UX addendum brief issued; DLT and domain started                                                |
| S1    | CI green; preview deploys; spikes recorded; branch protection on                                                                     |
| S2    | Design Lab matches UX boards; axe clean; token parity; **you have signed off**                                                       |
| S3    | Fresh DB → all migrations + pgTAP green; auth works (test OTP locally and on dev); all routes guarded; no stray service-role imports |
| S4    | Public screens match UX at three widths; both hero layouts and fallback pass `E2E-09`; vitals meet NFR-01; sitemap/canonical correct |
| S5    | Buyer journeys `E02/03/04/05/13` pass; enquiries and forms safe against spoofing, duplication, rate abuse                            |
| S6    | Seller journeys `E06/07/08` pass; uploads hardened; admin listing moderation live                                                    |
| S7    | Admin/builder journeys `E11/12/14/15/16` pass; isolation and secrecy rules proven                                                    |
| S8    | Full E2E green three times; no Sev-1/2 a11y or security findings; budgets pass; staging rehearsal passes                             |
| S9    | Go-live checklist complete; restore and rollback rehearsed; production smoke passes                                                  |

---

## 7. Release

- [ ] Release PR lists requirements, migrations, config changes, flags, known issues.
- [ ] Staging/rehearsal migration succeeded; backup verified.
- [ ] Production approval recorded; migrate → deploy → smoke → 30-minute monitoring completed.
- [ ] Release tagged; error-tracker release created; runbooks current.

---

## 8. Acceptance standards by feature type

| Type                             | Extra requirement                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Search / list pages**          | Filters reproducible from URL; stable ordering; empty/invalid/failed states; no cached stale removed listings; count matches results  |
| **Forms**                        | Server validation equals client validation (same schema); rate-limited and failed states shown as designed; data preserved on failure |
| **Auth flows**                   | Safe-redirect tests; no account enumeration; OTP and email links single-use; abuse limits; session refresh only in `proxy.ts`         |
| **Uploads**                      | Spoofed MIME, oversize, SVG, EXIF, quota and foreign-prefix tests; orphan cleanup                                                     |
| **Moderation / admin actions**   | Confirmation for irreversible actions; audit entry; cache invalidation; DB trigger prevents bypass                                    |
| **Portals**                      | Role guard + RLS scope proven for each role; builder isolation tests; responsive shell at five widths                                 |
| **Charts**                       | Fixed series colours; legend; keyboard crosshair; table view                                                                          |
| **Sponsors**                     | Selection matrix tests; fallback leaves no gap or empty frame; ratio and file validation; `rel` attributes                            |
| **Gated features (map, PG, AI)** | Behind a flag; absent from navigation when off; documented activation steps                                                           |

---

## 9. What "done" does not allow

- Behaviour behind a hidden button but not enforced server-side or in RLS.
- A "temporary" duplicate component or inline style.
- Skipping states "for later" that the UX defines for the screen.
- Merging a migration without pgTAP for its policies.
- Merging with a flaky or skipped test unless tracked and dated.
- Shipping a Proposed UX item that has not been approved.
