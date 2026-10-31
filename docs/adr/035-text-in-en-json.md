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
