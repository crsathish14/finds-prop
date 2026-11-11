# Backend and server standards

> Source: distilled from the approved implementation plan and AI harness design (30 Oct 2026). References such as `plan 07 §4.2`, `03` §10 or `ADR-009` point to the archived plan, the harness design documents, or `docs/adr/`. From Stage 1 (S1-T12) this repository is authoritative (HD-11).

Scope: Server Actions, Route Handlers, services, queries, provider adapters, caching, logging. Database rules are in `database.md`; authorization and secrets in `security.md`.

## Rules

| ID      | Rule                                                                                                                                                                                                                                                     | Enforced by                                                      | Source                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------ |
| R-BE-01 | Every mutation from our UI is a Server Action exported from `actions.ts` through `defineAction`. `"use server"` appears only in `actions.ts`. Machine and client fetch callers use Route Handlers                                                        | G-02 (`no-restricted-syntax`), G-05 (`UT-define-action`)         | ADR-006                  |
| R-BE-02 | `defineAction` order is fixed: parse, authenticate (`getClaims`), authorise, rate limit, idempotency, handler, cache invalidation, audit, normalise. Never reorder or bypass                                                                             | G-05 (`UT-define-action`)                                        | plan 05 §5               |
| R-BE-03 | Never take user id, role, owner id, status or price flags from client input. Derive identity from `getSessionView()`; pass only the entity id                                                                                                            | G-08 (`IT-AUTHZ`); Review                                        | plan 05 §5               |
| R-BE-04 | A foreign entity id returns `NOT_FOUND`, never `FORBIDDEN`, and no data in the response                                                                                                                                                                  | G-08 (`IT-AUTHZ`, E2E-10)                                        | plan 07 §2.6             |
| R-BE-05 | One Zod schema per input in `schemas.ts` (isomorphic), types from `z.infer`. `ActionResult` with the closed `ErrorCode` set; `normalise-error.ts` is the only mapper; no stack trace or database text reaches a user                                     | G-05, G-08                                                       | ADR-007, plan 05 §4.1    |
| R-BE-06 | Reads live in `queries.ts` (`import 'server-only'`): explicit columns, rows mapped to view models, no `.select('*')`. Writes live in `service.ts`; multi-step writes use RPC                                                                             | G-02 (`no-restricted-syntax`, boundaries), G-08 (`IT-queries`)   | ADR-017, plan 06 §8      |
| R-BE-07 | Four Supabase client factories only (`browser`, `server`, `publicAnon`, `admin.server.ts`). The service role is imported only by the allow-listed modules in plan 07 §4.3. Extending the list is class C2                                                | G-02 (restricted imports with allow-list, negative test in `08`) | ADR-008, plan 07 §4.3    |
| R-BE-08 | Anonymous or abusable actions are rate limited through `rate_limit_hit()` with the values in plan 07 §11. Creates that cost money or notify someone carry an idempotency key                                                                             | G-06, G-08                                                       | plan 07 §11, plan 05 §10 |
| R-BE-09 | SMS, places and mail go through adapters with timeouts and fakes. Features never call a provider directly; provider hostnames appear only in adapters                                                                                                    | G-14 (hostnames outside adapters), G-08                          | ADR-013                  |
| R-BE-10 | Log through the logger only, with the fixed redaction list. Never log phone, email, OTP, token, cookie, authorization header, service key, CRM credentials or message bodies                                                                             | G-02 (`no-console`), G-05 (`UT-redact`)                          | plan 07 §12              |
| R-BE-11 | Cacheable public reads use `publicAnon` inside `"use cache"` with tags. Anything reading cookies, headers or search params is under `<Suspense>`. Writes to public data call `updateTag` or `revalidateTag(tag, 'max')`. Search results are never cached | G-08 (`IT-cache`); Review                                        | ADR-003, plan 05 §3      |
| R-BE-12 | Sensitive actions write an audit entry (moderation, roles, builders, CRM secrets, CMS publish, staff sign-in)                                                                                                                                            | G-06 (`DB-AUDIT`), G-08                                          | ADR-028                  |
| R-BE-13 | Webhook and cron handlers verify the signature or token before any work, compare in constant time, ignore cookies and return minimal bodies                                                                                                              | G-08 (`IT-send-sms-hook`, `IT-crm`)                              | plan 07 §14              |
| R-BE-14 | No separate backend, queue, cache service or background worker beyond `pg_cron` plus `pg_net`                                                                                                                                                            | Review (ADR)                                                     | ADR-001, ADR-019         |

## Server Action pattern

Every mutation follows the same pipeline, implemented once in `server/actions/define-action.ts`:

```text
defineAction({ name, input: ZodSchema, auth: 'none' | 'user' | role-spec, rateLimit?, audit?, handler })
  1. parse input (FormData or object) → on failure: VALIDATION + fieldErrors
  2. authenticate  (getClaims)            → UNAUTHENTICATED
  3. authorise     (role / ownership)     → FORBIDDEN
  4. rate limit    (visitor hash / user)  → RATE_LIMITED + retryAfter
  5. idempotency   (key check, §10)       → return previous result
  6. run handler   (service.ts, user-scoped client; admin client only if allow-listed)
  7. cache invalidation (updateTag / revalidateTag)
  8. audit         (if configured)
  9. normalise errors, log with request id, return ActionResult
```

Rules:

- **Never** trust a client-supplied user id, role, owner id, status or price flag. Derive from the session; pass only the entity id.
- Actions are named by intent (`submitEnquiry`, `approveListing`) not by CRUD verb.
- Admin actions use `auth: { role: 'super_admin' }` (builders: `{ role: 'builder' }`, customers' writes: `'verified-phone'`) and re-check in the handler (ARC: "re-checked in every server action").
- A Server Action is a public POST endpoint: treat arguments as hostile even if only your UI calls it.
- Server Actions are not for data fetching (they run sequentially per client); reads use RSC or Route Handlers.

## API boundaries

| Need                                                               | Mechanism                                                       | Notes                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Page data                                                          | Server Component → `queries.ts`                                 | Explicit columns; maps rows to view models                             |
| User mutation                                                      | Server Action (`actions.ts`) → `defineAction` → `service.ts`    | Single entry point per intent                                          |
| Client-side fetch (autocomplete, map viewport, live admin filters) | Route Handler (`GET`)                                           | Validate query with Zod; rate limit; JSON `ActionResult`-like envelope |
| Auth hook, cron, health                                            | Route Handler                                                   | Signature/token checked before any work; no cookies                    |
| Uploads                                                            | Action returns signed URL → browser uploads → `finalize` Action | `07` §7                                                                |
| External calls (SMS, Ola Maps, CRM webhooks)                       | Provider adapters in `server/`                                  | Timeouts, retries, redaction (`09` §6)                                 |

### 4.1 API contracts

- **Request validation:** every action/handler starts with `schema.safeParse`.
- **Response envelope:** `ActionResult<T> = { ok: true, data: T } | { ok: false, code: ErrorCode, message: string, fieldErrors?: Record<string, string[]>, retryAfter?: number }`.
- **Error codes (closed set):** `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `UPSTREAM_FAILED`, `INTERNAL`. Each maps to a UI treatment (`§9`). Database error codes are normalised in one function (`server/actions/normalise-error.ts`), e.g. unique violation → `CONFLICT`, RLS denial (`42501`) → `FORBIDDEN`, trigger exceptions with custom `SQLSTATE` → specific codes.
- **Types are inferred from Zod** (`z.infer`) and exported from `schemas.ts`; no hand-written duplicate interfaces.
- **No `any` across the boundary**; generated `Database` types are used only inside `queries.ts` / `service.ts`.

## Rendering, caching and revalidation

Assuming `cacheComponents: true` is approved after `S1-SPK-01`:

| Page                            | Static shell                             | Cached data (`"use cache"`)                                                                                                             | Dynamic holes (`<Suspense>`)                             | Tags | Invalidated by                                                                                         |
| ------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------ |
| `/`                             | header chrome, hero copy, section frames | `site_settings` (tag `site-settings`), featured/new homes (tag `listings:home`), live projects (tag `projects:live`), sponsor selection | avatar/auth state, per-user save hearts                  |      | CMS save → `updateTag('site-settings')`; listing approve/sold → `revalidateTag('listings:home','max')` |
| `/properties/[slug]`            | page frame                               | listing + media (tag `property:{id}`) with `cacheLife('hours')`                                                                         | enquiry card state, heart, compare state                 |      | moderation / edit / sold → `updateTag('property:{id}')`                                                |
| `/properties`                   | frame                                    | none (query depends on params; result list is dynamic)                                                                                  | the list under `<Suspense>` with `loading.tsx` skeletons |      | n/a                                                                                                    |
| `/projects`, `/projects/[slug]` | frame                                    | live projects, units, trends (tags `projects:live`, `project:{slug}`)                                                                   | lead form state                                          |      | project moderation, builder edit, unit change                                                          |
| `(account)`, `(portal)`         | shell                                    | none                                                                                                                                    | everything                                               |      | n/a                                                                                                    |

Rules:

1. Cacheable reads use the **cookie-less** `publicAnon` Supabase client inside `"use cache"` functions; they never touch `cookies()`.
2. Anything that reads cookies/headers/search params is wrapped in `<Suspense>` with a skeleton shaped like the final layout (UX loading states).
3. Mutations that change public data call `updateTag` (read-your-writes) or `revalidateTag(tag,'max')` in the same Server Action, after the DB write succeeds.
4. **Sold/rented/rejected listings must disappear quickly:** `updateTag('property:{id}')` + `revalidateTag('listings:home','max')` + search is never cached. Cache life for detail pages is minutes to hours but the tag guarantees eviction.
5. If the spike fails, fall back to the default dynamic model with `unstable_cache` on the same functions and tags; the call sites do not change because caching sits inside `queries.ts`.
