# ADR-035 · All visitor-facing text in `en.json`

- Status: Accepted (owner decision, 31 Oct 2026); the library choice is confirmed by spike I18N-SPK-01
- Date: 2026-10-31
- Related: NFR-11, R-FE-19, CH-11, DEC-39 to DEC-43, ADR-003, DEC-37

## Context

`NFR-11` asked only that strings be extractable later, and `docs/engineering/frontend.md` kept copy in components for now. The owner wants every label and sentence in an `en.json` from the start so that adding a language (Tamil first) needs no component changes. Only nine strings exist today, so this is the cheapest moment.

## Decision

1. **One message file:** `src/i18n/messages/en.json`, grouped by area (`common`, `errors`, `home`, ...). Split per area, merged at build, only if it passes about 1,500 lines (DEC-43). Keys are by meaning; sentences are whole; variables are named; no HTML.
2. **Library:** next-intl (DEC-39). If spike I18N-SPK-01 fails, a small in-house `t()` helper reads the same file. The spike passes only if `/` is still prerendered on Vercel, the build passes, `proxy.ts` still runs, an unknown language gives our 404 and `global-error` renders.
3. **URLs:** English has no prefix; a later language gets one (`/ta/...`); `/en/...` redirects to the unprefixed URL (DEC-40). Routes live under `src/app/[locale]/`.
4. **Server errors** return codes (and variables); the screen looks up `errors.<code>`. The server does not produce visitor-facing sentences.
5. **Out of scope for now** (DEC-41): admin-edited `site_settings` copy, SMS and email templates, legal pages, logs. Vocabulary ids stay in `config/vocab.ts`; their labels move to `en.json`.
6. **Enforcement:** a lint rule against literal visitor-facing text (R-FE-21), typed keys, a `check-messages` gate (G-21), formatting only through the helpers (R-FE-23), and a pseudo-language smoke test. Added by tasks I18N-T06 and I18N-T07.

## Consequences

- One new dependency (class C2, approved with this decision, pending the spike).
- Every new string needs a key; the playbooks and the lint rule make that routine.
- `en.json` becomes the source of text in code. The UX documents stay the design reference; copy outside the approved text is flagged in the PR (R-FE-19).
- A language switcher is not in the approved UX and needs an addendum item before it appears.
- Plan: `property-platform-implementation-plan/14-text-externalisation-plan.md`, tasks in plan 10 under Stage 2.

## Spike I18N-SPK-01 result (31 Oct 2026): passed locally

next-intl 4.14.9 on Next.js 16.4.3 with Cache Components, language taken from the `[locale]` segment through `next/root-params` (no `setRequestLocale` needed).

| Criterion                                            | Result                                                                                                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` stays prerendered                                | Yes: `x-nextjs-prerender: 1`; `/en` is fully static, `/[locale]` is partial prerender                                                                                               |
| Build passes, client-bundle scan                     | Yes                                                                                                                                                                                 |
| `proxy.ts` still runs alongside the language routing | Yes: request id (kept or replaced), Report-Only CSP, noindex outside production, security headers; `/api/*` skips language routing                                                  |
| `/en/...` redirects to the unprefixed URL            | Yes (307)                                                                                                                                                                           |
| Unknown path or language gives our 404               | Yes, with status 404 and the styled page in the server HTML. Needs `experimental.globalNotFound` and `src/app/global-not-found.tsx`; a catch-all route rendered it client-side only |
| `error.tsx` and `global-error.tsx` render with text  | Yes in Chromium, including the `{id}` variable. `global-error` and `global-not-found` read `en.json` directly because no language provider exists there                             |
| Browser smoke suite                                  | 5 of 5                                                                                                                                                                              |

Not yet shown: a refreshed Supabase session passing through the combined proxy (no session exists until Stage 3; the order is session refresh first, then language routing, then refreshed cookies copied onto the response) and the prerender header on a deployed Vercel Preview.

Findings for the owner:

1. **Dependency footprint.** 4.14.9 adds `@swc/core` and `@parcel/watcher` (native, install scripts) and `@eloqnt/*` (first-party, from the same author, published August 2026). They belong to the optional message extractor and are not used here. Installs use `--ignore-scripts`, but R-DEP-04 requires the two install scripts to be approved by name in `scripts/policy/licences.json`. Releases up to 4.4.x avoid them but lack root-params support and are a year old.
2. **`globalNotFound` is an experimental Next.js flag.** It is the documented answer for a top-level dynamic segment. If it changes, only `global-not-found.tsx` and one line of config are affected.
3. The fallback (own helper) is not needed.

**Owner decision, 31 Oct 2026:** approved next-intl 4.14.9 and the two install scripts by name (ADR-031).
