# Server infrastructure

Read `docs/engineering/backend.md` and `docs/engineering/security.md` first. Use `docs/engineering/playbooks/new-action.md` for a new action or handler.

1. Four Supabase clients only: browser, server (cookie-bound, publishable key), public (no cookies, cacheable), admin.server (service role). They live in `src/server/supabase/`. Never create another factory. (R-BE-07)
2. The admin client may be imported only by the allow-listed modules in `docs/engineering/security.md`. Extending the list is class C2.
3. The `defineAction` order is fixed: parse, authenticate (`getClaims`), authorise, rate limit, idempotency, handler, cache invalidation, audit, normalise. Never reorder or bypass it. (R-BE-02)
4. Return `ActionResult` with the closed `ErrorCode` set. Only `src/server/actions/normalise-error.ts` maps database and provider errors. Never return stack traces or database messages. (R-BE-05)
5. Identity comes from the session view helper. Call a `require*` helper before any write. A foreign id returns `NOT_FOUND`. (R-BE-03, R-BE-04)
6. Webhook and cron handlers verify signature or token first, compare in constant time, ignore cookies, return minimal bodies. (R-BE-13)
7. SMS, places and mail go through adapters with timeouts. A fake exists for tests. Features never call a provider directly. (R-BE-09)
8. Only `src/server/env.ts` and `src/lib/public-env.ts` read `process.env`. A new variable is added to the schema and `.env.example` in the same PR. (R-GEN-07)
9. Log through `src/server/logger/` only; the redaction list is fixed; request id on every line; no `console.*`. (R-BE-10)
10. Rate limits use `rate_limit_hit()` with the values in `docs/engineering/security.md`. (R-BE-08)
