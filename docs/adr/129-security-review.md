# ADR-129 · Security review (S8-T05)

- Status: Accepted for parts 1 (the checklist and the dependency audit), 2 (the content security policy is checked) and 3 (the policy is enforced). Part 3 closes S8-T05.
- Date: 2026-11-12
- Related: ADR-010 (authentication, "Review findings to fix before launch"), ADR-033 and DEC-37 (the content security policy), ADR-125 (authorization), plan 07 sections 8 and 15, `docs/engineering/security.md`, OWASP ASVS 4.0.3
- Plan for S8-T05 approved by the owner on 12 Nov 2026, including: the seven findings of ADR-010 are recorded here and left for S9 (the owner's decision of 3 Nov 2026 stands); `npm audit` run once locally; the CI audit gate is not changed.

## What this is

Plan 07 section 15 asks for three things at Stage 8: a pen-test style checklist (OWASP ASVS L1/L2, selected controls), the content security policy enforced, and a dependency audit that is clean. This ADR holds the checklist and the audit (part 1). It is a review of the code and tests as they are on `develop`; it adds one small test (the static headers) and changes no behaviour. Nothing was tried against the hosted projects.

How to read the result column:

- **Pass** the control is met and a named test, lint rule, check or file shows it.
- **Design** met by the way the app is built; no test is possible or needed.
- **Gap** a finding, listed below with its severity and the fix idea. Nothing is fixed in this change.
- **Owner** a setting in a dashboard or an account that only the owner can read.
- **S9** belongs to the production domain and the launch checks.

## The checklist (ASVS 4.0.3, selected controls)

### V2 Authentication

| Control                                                               | How it is met and proved                                                                                                                                                                                                                                          | Result                                                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| No passwords to store, reset or guess (V2.1, V2.4, V2.5)              | Customers sign in with a phone code, staff with Google only (decision of 1 Nov 2026). There is no password field anywhere.                                                                                                                                        | Design                                                             |
| Anti-automation on sign-in (V2.2)                                     | Our limits: 5 codes per phone per hour, 20 per address per day, 10 tries per phone per hour (`rate-limit/limits.ts`, `tests/integration/rate-limit.test.ts`). The CAPTCHA token is sent to Supabase with the request. Supabase's own limits are the hard control. | Pass for ours; the hosted values are **Owner** (ADR-010 finding 2) |
| One-time codes are random, short-lived and single use (V2.7, V2.8)    | The code is made and checked by Supabase Auth (6 digits). The local stack uses the defaults; the **hosted** expiry and the CAPTCHA switch were not read.                                                                                                          | **Owner**                                                          |
| Staff sign-in is decided on the server, not by the address (V2.1, V4) | `staff-callback.test.ts`, `route-access.test.ts` (ADR-125): a customer is signed out and refused, a foreign `next` is ignored.                                                                                                                                    | Pass                                                               |
| Verification links are single use and the type is checked (V2.5)      | `email-confirm.test.ts`: only `email_change`, a well-formed token, one expired page for every failure.                                                                                                                                                            | Pass; login CSRF is finding 1 of ADR-010                           |

### V3 Session management

| Control                                                              | How it is met and proved                                                                                                                                                                                                                                               | Result     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A session is refreshed in one place only (V3.3)                      | `proxy.ts` refreshes; the server client never does (ADR-008, `server.ts`). Refresh-token rotation is on in `supabase/config.toml`.                                                                                                                                     | Pass       |
| Identity is checked by signature, not trusted from the cookie (V3.5) | `getClaims()` everywhere; `getSession()` is not used on the server (AGENTS.md rule, review).                                                                                                                                                                           | Pass       |
| Sign-out ends the session (V3.3)                                     | `signOut` with scope local; `sign-out.test.ts` (ADR-010).                                                                                                                                                                                                              | Pass       |
| Cookie flags (V3.4)                                                  | The app passes no cookie options, so the library defaults apply: `SameSite=Lax`, `Path=/`, 400 days, `HttpOnly` off. **`Secure` is not set by the app.** `HttpOnly` must stay off while the browser client reads the session (it signs the photo and sponsor uploads). | **Gap** N1 |
| Idle and absolute timeout (V3.3)                                     | The JWT lifetime is Supabase's (3600 s locally); the hosted value was not read.                                                                                                                                                                                        | **Owner**  |

### V4 Access control

| Control                                                                      | How it is met and proved                                                                          | Result |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| Every table has row-level security and the right grants (V4.1, V4.2)         | ADR-125 part 1: 339 matrix checks over 23 tables, seven kinds of caller; 5 function-grant checks. | Pass   |
| Every Server Action checks the caller's level; the level cannot drift (V4.1) | ADR-125 part 2: all 66 actions pinned (31 admin, 9 builder, 18 phone, 7 open, 1 signed-in).       | Pass   |
| A foreign id is "not found" (V4.2, IDOR)                                     | ADR-125 part 2: each id-taking action has a wrong-owner test; two gaps were closed.               | Pass   |
| Machine callers prove themselves first (V4.1, V13)                           | ADR-125 part 2: the six route handlers refuse a missing or wrong token or signature.              | Pass   |
| The service role is used in allow-listed modules only (V4.1)                 | ESLint `no-restricted-imports` with an allow-list (`eslint.config.mjs`); `check-env`.             | Pass   |
| The admin cannot be reached from the public site (V4.3)                      | Staff pages are separate (`/admin`, `/builder`) and guarded in the layout; `page-access.test.ts`. | Pass   |

### V5 Validation, sanitization and encoding

| Control                                                                            | How it is met and proved                                                                                                                                                                       | Result |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| All input is parsed by a schema before use (V5.1)                                  | `defineAction` parses first (step 1); the schemas are Zod; `define-action.test.ts`.                                                                                                            | Pass   |
| No raw SQL built from input; no `select *` (V5.3)                                  | The app uses the Supabase client and database functions with typed parameters; `select('*')` is a lint error (R-BE-06).                                                                        | Pass   |
| Output is escaped; no dangerous HTML (V5.3)                                        | There is no `dangerouslySetInnerHTML`, `eval`, `new Function` or `innerHTML =` in `src` (checked by search on 12 Nov; the first is also a lint rule, `scripts/__tests__/lint-rules.test.mjs`). | Pass   |
| Redirect targets are ours (V5.1.5)                                                 | `safe-redirect.test.ts`, `return-path.test.ts`, the callback's `next` handling.                                                                                                                | Pass   |
| A URL an admin enters cannot reach inside our network or run script (V5.2.6, SSRF) | CRM addresses: `safe-url.test.ts`, `send.test.ts`. Sponsor links must be `https` (`sponsor-schemas.ts`).                                                                                       | Pass   |
| Search parameters are validated (V5.1)                                             | One schema parses the address; invalid values are dropped (R-FE-11).                                                                                                                           | Pass   |

### V7 Errors and logging

| Control                                                                                       | How it is met and proved                                                                                                                               | Result               |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| The caller gets a closed set of safe errors, never a stack trace or a database message (V7.4) | `normalise-error.ts`, `define-action.test.ts`, R-BE-05.                                                                                                | Pass                 |
| Nothing secret or personal is logged (V7.1)                                                   | The logger redacts a fixed list (`redact.test.ts`); `console.*` is a lint error. A raw database error is still logged as it comes (ADR-010 finding 7). | Pass; finding 7 open |
| Sensitive actions leave a trace (V7.2)                                                        | The audit log: ADR-123 (what is recorded, and why a customer's sign-in is not) and `tests/integration/audit.test.ts`.                                  | Pass                 |

### V8 Data protection

| Control                                                     | How it is met and proved                                                                                                                                                                                                  | Result                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Only the fields a page needs are sent to the browser (V8.3) | Public projections with named columns; `public-columns.test.ts` (no `owner_id`).                                                                                                                                          | Pass                      |
| Secrets are never in the browser bundle (V8.3, V14.3)       | `process.env` is read only in `env.ts` and `public-env.ts`, and their names match `.env.example` (`check-env`); the service-role key is a server variable without the `NEXT_PUBLIC_` prefix, so Next.js does not ship it. | Pass                      |
| Personal data is kept only as long as needed (V8.3)         | The nightly retention job (ADR-124); the windows are for counsel to confirm (DEC-28).                                                                                                                                     | Pass; **Owner** (windows) |

### V10, V12, V13 Code, files and API

| Control                                              | How it is met and proved                                                                                                                                                                   | Result |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| No known-vulnerable dependency in production (V10.3) | `npm audit --omit=dev`: **0 vulnerabilities** (12 Nov 2026); CI blocks high and critical. See "Dependency audit".                                                                          | Pass   |
| Build is reproducible and actions are pinned (V10.3) | `npm ci` from the lockfile; every GitHub Action is pinned by commit hash; gitleaks scans the history on every pull request.                                                                | Pass   |
| Uploads are checked by content (V12.1 to V12.5)      | `media.test.ts`: an SVG as JPEG, a PNG under a JPEG name, a file with camera metadata, over 10 MB and the seventh photo are refused and the file is deleted; the orphan sweep runs hourly. | Pass   |
| No open cross-origin access (V13.2)                  | No `Access-Control-Allow-*` header is set anywhere in `src`.                                                                                                                               | Pass   |
| Writes are idempotent where costly (V13)             | `idempotency.test.ts`; the key is claimed before the handler and given back on failure.                                                                                                    | Pass   |

### V14 Configuration

| Control                                                                                    | How it is met and proved                                                                                                                          | Result                                      |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `nosniff`, frame denial, referrer policy, permissions policy, `COOP` on every path (V14.4) | `next.config.ts`; the new `security-headers.test.ts` pins the five values; the smoke test checks two of them on a real response.                  | Pass                                        |
| The framework is not announced and the source is not published (V14.3)                     | `poweredByHeader: false`, no browser source maps; both pinned in `security-headers.test.ts`.                                                      | Pass                                        |
| Content security policy (V14.4.3)                                                          | Enforced in every production build (part 3); the end-to-end check of part 2 fails on any reported violation. See "Enforcing the policy (part 3)". | Pass; script keeps `unsafe-inline` (DEC-37) |
| Transport security (V9.1, V14.4.5)                                                         | The app sends no `Strict-Transport-Security`. `docs/engineering/security.md` sets the value (one year); the production domain is not final.       | **S9** (N3)                                 |

## Dependency audit

- **Production dependencies: 0 vulnerabilities** (`npm audit --omit=dev`, 12 Nov 2026). The CI step (`--omit=dev --audit-level=high`) is unchanged.
- **All dependencies: 7 moderate**, all one issue: `minimatch` 7.0.0 to 11.0.0 (GHSA-g3hv-75wg-m249, denial of service through glob patterns), reached through `typescript-eslint` 8.72.1 (`@typescript-eslint/typescript-estree`, `parser`, `type-utils`, `utils`, `eslint-plugin`). They are development tools: ESLint runs on our own files and configuration at build and in CI, and takes no pattern from a visitor. They are not in the shipped app. `npm audit fix --force` offers `typescript-eslint@8.36.0`, which is a downgrade, so there is no fix to apply today. A new `typescript-eslint` release that depends on a fixed `minimatch` is the fix; the update is a dependency change for the owner's approval.

## Findings

None of these is a hole that a visitor can use today; each is recorded for the owner. Nothing was changed.

- **N1 · Session cookie flags (low).** The app does not set `Secure` on the session cookies and `HttpOnly` is off (the library default; the browser client needs to read the session for uploads). On the production domain with HSTS (N3) a cookie is only sent over https in practice, and `SameSite=Lax` limits cross-site use. With the script policy still allowing `'unsafe-inline'` (DEC-37), a script injection bug would be able to read the session. React escaping and the absence of `dangerouslySetInnerHTML` make that unlikely. _Fix idea:_ pass `secure: true` in production in `proxy.ts` and in `server.ts`; keep `HttpOnly` off until uploads no longer need the browser client.
- **N2 · Development-tool advisories (low).** The seven moderate `minimatch` advisories above.
- **N3 · No HSTS from the app (S9).** Vercel sets it on `*.vercel.app`; a custom domain needs it set. Belongs with the domain, SPF, DKIM and DMARC checks of Stage 9.
- **N4 · Hosted Auth settings were not read (Owner).** The one-time-code lifetime, Supabase's SMS and verification limits, the CAPTCHA switch and the JWT lifetime on the hosted projects are the real controls behind ADR-010 finding 2. The local `config.toml` is not the hosted state.

### The seven findings of ADR-010, status on 12 Nov 2026

All stay as the owner decided on 3 Nov 2026 (fixed in the pre-launch review, S9). Where something has changed since, it is said here.

| #   | Finding                                                                         | Status                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login CSRF through `/auth/confirm` (medium)                                     | Open, unchanged.                                                                                                                                                                                                                                |
| 2   | The app's OTP limits can be bypassed by calling Supabase directly (medium)      | Open; needs the hosted values (N4).                                                                                                                                                                                                             |
| 3   | Targeted lockout of a phone number (low)                                        | Open (DEC-31 as written).                                                                                                                                                                                                                       |
| 4   | Email enumeration (low)                                                         | Open; owner decision.                                                                                                                                                                                                                           |
| 5   | Resend uses the address the browser sends (low, unverified)                     | Open and still unverified: `resendEmailLink` still passes the input to `supabase.auth.resend`. The tests have no mail inbox, so it cannot be shown in CI; the live email test or a one-line change (use the stored pending address) settles it. |
| 6   | Checklist gaps: no idempotency key on email sends; no audit of customer sign-in | The audit part is **closed by decision**: ADR-123 records that a customer's sign-in is not audited. The idempotency part is open.                                                                                                               |
| 7   | A raw database error is logged                                                  | Open. The redaction list is tested (`redact.test.ts`); a row inside an error's `details` is not.                                                                                                                                                |

## The content security policy check (part 2)

`e2e/csp.spec.ts` (tagged `@smoke`, so it runs in the existing end-to-end step and needs no gate change) loads 22 pages in the production build and fails on any `securitypolicyviolation` the browser reports: the public pages, the sign-in pages, the not-found page, seven Design Lab boards (they show every component, image and chart) and the phone menu. A Report-Only policy fires the same event an enforced one would, so a clean run means enforcing blocks nothing on these pages. A first test proves the collector can fail by loading a picture from a host `img-src` does not allow.

What the first run found (13 Nov 2026), and what was done:

- **Zod probes `new Function` in the browser** (the Design Lab domain board, and any page that builds a schema). The policy has no `unsafe-eval`, so the browser reported the probe on every such page. It is caught and harmless, but enforcing would put an error in the console of every visitor. Fixed with `src/instrumentation-client.ts`, which sets `jitless` for the browser bundle only; the browser uses the plain parsers. The policy is not loosened.
- **The Design Lab's preview frames** are same-origin iframes the policy does not list. They exist only with `DESIGN_LAB=1` outside production (ADR-020), and part 3 enforces in production only, so the check ignores a `frame-src` report for `/design-system/preview/` and nothing else. No visitor page has a frame.

What it cannot see, so part 3 must handle it by reasoning: the Turnstile script and frame (the site key is empty in CI, so they are never loaded; the policy allows `https://challenges.cloudflare.com` for both), pages that need rows from the database (a property or project page), and the Vercel preview toolbar.

## Enforcing the policy (part 3)

The header is now `Content-Security-Policy` (not Report-Only) in every **production build**: `next start` in CI, Vercel previews and production. `next dev` stays Report-Only and adds `'unsafe-eval'` (its overlay and hot reload need it), so a developer sees a violation in the console without a page breaking. The policy is built by one pure function, `src/server/csp.ts`, and pinned by `src/server/__tests__/csp.test.ts`; `proxy.ts` only chooses the settings.

What changed against the Report-Only policy of DEC-37:

- **Added `object-src 'none'`.** No plug-ins.
- **The local Supabase stack is allowed only when `APP_ENV=local`** (connect and picture hosts `http://127.0.0.1:54321`). Before, every environment's policy named it. The CI end-to-end job runs with `APP_ENV=local`, so it exercises the same value a developer gets.
- **Vercel's toolbar is allowed only when `APP_ENV` is not `production`** (`https://vercel.live` for script, style, frame, connect and font; its socket `wss://ws-us3.pusher.com`; `https://vercel.com` and `https://assets.vercel.com` for a picture and a font). Without it an enforced policy would break the toolbar on every preview. Production never names it.
- **Nothing else loosened.** Script still allows `'unsafe-inline'` (DEC-37 option A: a nonce would make every page dynamic, and the plan keeps the pages cached). With it, the policy does not stop an injected inline script; it does stop a script, frame, picture or call to any host not listed, framing, a changed base address, a form sent elsewhere and plug-ins. Moving to nonces is a separate decision with a cost in caching.

What was not tried, so the owner should look once on the first preview after merge: the Turnstile widget on the sign-in page (CI has no site key; the script and frame hosts are allowed as before), and the Vercel toolbar on a preview. If either is blocked, the browser console names the directive.

**For whoever builds the map view (`FLAG_MAP_VIEW`):** the policy has no map tile host and no `worker-src`. MapLibre needs both (`docs/engineering/security.md` lists `worker-src 'self' blob:` and the tile host). Add them in `csp.ts` with their test in the same change; until then the map would be blocked.

**An observation, not changed here:** the Design Lab shows each screen in an iframe, and `X-Frame-Options: DENY` (`next.config.ts`, every path) already refuses same-origin frames, so those frames are empty in the stored baselines. Enforcing the policy does not change that picture. It is a Lab matter only; no visitor page has a frame.

## Out of scope

- **Error tracking and redaction** (DEC-21) is S8-T07.
- **Production domain, HSTS, mail authentication, backups and the incident runbooks** are Stage 9.
- **Penetration testing by a person** against a deployed copy is not part of this review.

## Consequences

- Tests: `security-headers.test.ts`, `csp.test.ts` and the end-to-end spec `csp.spec.ts`. Part 3 changes behaviour (the policy is enforced); no migration, package, environment variable, CI or gate change.
- Rollback: part 3 is the header name in `proxy.ts` (send Report-Only again); parts 1 and 2 are tests and this ADR.
