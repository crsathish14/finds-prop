# ADR-130 · Error tracking with Sentry (S8-T07, DEC-21)

- Status: Accepted for part 1 (the foundation). Parts 2 (call sites, content security policy) and 3 (releases, source maps, alerts) follow in later pull requests.
- Date: 2026-11-14
- Related: ADR-023 (observability, tool left open until S8), DEC-21, R-BE-10 (log redaction), ADR-033 and DEC-37 (content security policy), plan 09 sections 6.1 and 6.2
- Plan for S8-T07 approved by the owner on 14 Nov 2026 with the recommended defaults: Sentry on the free plan, the EU region, browser errors as well as server errors, one Sentry project for all environments told apart by an environment label, alerts to the owner's email.

## Decision

- **Sentry (`@sentry/nextjs` 11.12.0, MIT)** receives unexpected errors from the server and from the browser. Vercel's own error views stay available but have no alerts and no browser source maps, which is why ADR-023's recommendation is followed.
- **Everything is off until an address (DSN) is set.** `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser) are optional. Without them nothing is loaded, nothing is sent, and CI, local work and any deployment that has not switched tracking on behave as before.
- **Errors only.** No performance tracing, no session replay, no feedback widget, no breadcrumbs (clicks, requests and console lines can carry personal data).
- **Two locks on personal data.**
  1. `src/lib/error-tracking-options.ts` switches off every kind of data the SDK collects by default. Version 11 collects cookies, headers, request bodies, query strings, local variables and source lines unless told not to, so each is set to off by name.
  2. `src/lib/scrub-event.ts` is the `beforeSend` function. It is **deny-by-default**: the report is rebuilt from a short list of fields (id, time, level, environment, release, message, exception type and text, stack frames without variables or source lines, our own tags, browser and operating system, request method and path). Everything else the SDK adds is not copied. What is copied passes through the logger's redaction (`src/lib/redact.ts`, moved from `src/server/logger/` so the browser can use it). A new SDK field stays out until someone adds it.
- **Our own tags only:** `request_id`, `digest`, `route`, `error_code`, `role`, `source`, `runtime`, `route_type`. The request id is the same one the logger and the audit log use, so a customer's reference code finds the report. No user id, phone or email is ever a tag.
- **Server start-up** is in `src/instrumentation.ts` (`register`); the SDK is loaded on first use, so a deployment without a DSN does not even import it. `onRequestError` reports the errors Next.js catches itself (a page that fails to render, a route that throws).
- **Reporting never breaks the request.** `reportError` swallows its own failures and waits at most two seconds for the report to leave before a serverless function stops.
- **Release name** is the commit (`VERCEL_GIT_COMMIT_SHA`), set on the server now. The browser release and source maps come in part 3.

## Dependency note (R-DEP-01, R-DEP-05)

- **Need:** the plan asks for error tracking with alerts; the platform has none.
- **Size:** 43 packages are added, mostly the SDK's own packages, OpenTelemetry's API and platform builds of the Rollup binary. The browser SDK is not yet measured; the bundle check in CI and the performance runbook will show it, and the browser SDK can be loaded after the page is interactive if it is noticeable.
- **Licence:** all MIT, Apache-2.0, BSD or BlueOak except one: `sentry@0.49.0`, Sentry's command-line tool, licensed **FSL-1.1-Apache-2.0**. It is free to use, including commercially; it only forbids offering a competing product, and it becomes Apache-2.0 two years after each release. It is used at build time to upload source maps and never reaches visitors. **The owner approved a narrow exception on 14 Nov 2026**: `scripts/policy/licences.json` lists that one licence as acceptable only for the package named `sentry` (the same list that holds the exceptions for `axe-core` and `lightningcss`). Version 10 of the package would have needed the equivalent tool under FSL-1.1-MIT, so a lower version does not avoid it.
- **Install scripts:** none added; `npm ci --ignore-scripts` is unchanged.
- **Alternatives considered:** `@sentry/node` plus `@sentry/browser` wired by hand (no command-line tool, but no source maps); Vercel error views only (no new dependency, no alerts).

## Verification

- `UT-redact` for reports: a report full of phone numbers, emails, tokens, cookies, headers, a request body, a user, breadcrumbs, local variables and source lines is passed through the scrubber, and none of it comes out (`src/lib/__tests__/scrub-event.test.ts`).
- The shared settings are pinned so a Sentry upgrade that adds a new default cannot silently switch collection back on (`error-tracking-options.test.ts`); the server start-up and the reporting function are tested with the SDK replaced (`src/server/observability/__tests__/`).
- Part 3 adds a script that sends a deliberately personal-looking test error through the real scrubber to the dev project, for the owner to open in Sentry and confirm.

## Not decided here

- Which Sentry region is used is chosen when the owner creates the account (EU recommended; Sentry has no India region). The reports carry no personal data by design, so the choice is low risk; the cross-border question belongs to the S9 legal review.
- Alert rules (new issue, error-rate spike, any error from the Send SMS hook, the CRM retry job or photo finalising) are set in Sentry's screens; part 3 lists them in a runbook.
