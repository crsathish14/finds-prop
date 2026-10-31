# ADR-033 · Stage 1 spike outcomes

- Status: Accepted
- Date: 2026-10-31
- Related: ADR-003, ADR-007, ADR-018, DEC-10, RISK-09, RISK-10

Outcomes of the four Stage 1 spikes (plan 12 section 4). What was run, what it showed, what remains open.

## S1-SPK-01 · Cache Components, session refresh, cached public read, per-user hole

**Status: partly done. Needs a signed-in Supabase session (Docker or a dev project) to finish.**

Done on Next.js 16.4.3 with `cacheComponents` and `partialPrefetching` enabled:

- `proxy.ts` with `@supabase/ssr` and `getClaims()` builds and runs. With no session cookie `getClaims()` makes no network call and the proxy adds the request id, noindex and CSP headers on prerendered pages (`x-nextjs-prerender` pages still receive proxy headers).
- A throwaway page with a `"use cache"` component (`cacheLife("minutes")`, `cacheTag`) next to a `<Suspense>` hole that reads `cookies()` built as `Partial Prerender` (static shell plus streamed dynamic content), revalidate 1m, expire 1h, with no blocking-route error. The cached part was identical for every request; the hole changed with the cookie.
- A dynamic route handler needs `await connection()`; without it a plain GET handler is prerendered at build time (`/api/health` fixed accordingly).

CI (first run of the `db` job) also showed that the Supabase CLI 2.122.0 local stack starts with `supabase/config.toml` as written (test OTP numbers, TOTP, email signup off), `supabase db reset` applies `seed.sql`, `supabase db lint` is clean and the pgTAP smoke test passes. The generated types for the empty schema are committed.

Not yet shown: a signed-in Supabase session refreshing in the proxy, a cookie-less `publicAnon` query inside `"use cache"` against a database, and a per-user save heart reading a verified session. These run in the first slice that has a database (Stage 3) or earlier if Docker is installed.

**Recommendation:** keep `cacheComponents: true` (DEC-10 option A). `partialPrefetching` stays on because the template enables it with Cache Components; turn it off if it causes trouble. ADR-003 remains Proposed until the Supabase half passes.

## S1-SPK-02 · Content Security Policy with the prerendered shell

**Status: done. Result: a conflict, decided on 31 Oct 2026 as DEC-37, option A.**

- Next.js documents that nonce-based CSP requires dynamic rendering of every page, and that **Partial Prerendering is incompatible** with nonces because the static shell cannot carry a per-request nonce.
- Tested the alternative the docs offer, experimental Subresource Integrity (`experimental.sri`, sha256), with a strict `script-src 'self'` in a report-only header: on the prerendered home page, **8 of 17 scripts are inline** (Next.js bootstrap and flight data) and every one violates `script-src 'self'`; SRI added `integrity` to the 5 external scripts but does not cover inline scripts. So a strict script policy without nonces is not achievable today.
- Everything else in the policy is strict and works: `default-src 'self'`, `object-src` none, `base-uri`, `form-action`, `frame-ancestors 'none'`, `img-src` and `connect-src` allow-lists, no `unsafe-eval` in production.

**Options for DEC-37:**

| Option                     | Script policy                                                                                                               | Cost                                                                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A (recommended for v1)** | `script-src 'self' 'unsafe-inline'`, all other directives strict; Report-Only now, enforced after Stage 4 with an E2E check | Weaker defence if an XSS bug exists; mitigated by React escaping, no `dangerouslySetInnerHTML` (lint), user text rendered as text only, `object-src 'none'`, `base-uri 'self'` |
| B                          | Nonce-based `strict-dynamic`; every page rendered dynamically                                                               | Loses Cache Components and the static shell, CDN caching and most of the performance plan; more server load                                                                    |
| C                          | Hash-based CSP through experimental SRI                                                                                     | Not viable now (inline scripts); revisit when Next.js supports it                                                                                                              |

**Decision (31 Oct 2026): option A.** The header stays Report-Only with `'unsafe-inline'`, as implemented in `src/proxy.ts`, and is switched to enforcing after Stage 4 once an E2E check confirms no violations on the main flows. Revisit when Next.js supports hashes for inline scripts.

## S1-SPK-03 · Trustworthy client IP header on Vercel

**Status: documented; needs a deployed check.**

Vercel documents that `x-forwarded-for` carries the client's public IP and that Vercel overwrites it and does not forward external IPs, to prevent spoofing; `x-real-ip` and `x-vercel-forwarded-for` are identical, and `x-vercel-forwarded-for` is not overwritten when a proxy sits in front of Vercel. Rule for the visitor hash (R-BE-10, ADR-018): read the first value of `x-vercel-forwarded-for`, fall back to `x-forwarded-for`, and outside Vercel (local, tests) treat the caller as `127.0.0.1`. The spoofed-header test runs on the first Vercel preview deployment (S1-T07).

## S1-SPK-04 · Zod, React Hook Form resolver, server action validation

**Status: done for versions and parsing; the `useActionState` form is built with the first form.**

Zod 4.6.7 with `@hookform/resolvers` 6.0.2 (peer range `zod ^3.25 || ^4`) and `react-hook-form` 7.91: for the same schema (trim, min length, regex, transform to digits, optional email) the resolver returned the same field messages and the same transformed values as `z.flattenError(schema.safeParse(...))` on the server. Use one schema in `schemas.ts`, `zodResolver` on the client and `safeParse` in `defineAction`. The two packages are added when the first form is built (Stage 2 or 3).
