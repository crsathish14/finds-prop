# ADR-008 · Supabase client topology

- Status: Accepted
- Date: 2026-10-29
- Related: Refined; approval: No; stage S1

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** four factories under `src/server/supabase/`: `browser`, `server` (per request, cookie-bound, publishable key), `publicAnon` (no cookies; for cacheable public reads), `admin` (service role; `server-only`; import-restricted by lint to an allow-list of modules). Session refresh happens **only** in `proxy.ts`. Identity checks use `getClaims()`.
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser-safe); `SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_HMAC_SECRET`, `SEND_SMS_HOOK_SECRET`, `CRON_SHARED_TOKEN`, provider keys (server only).
