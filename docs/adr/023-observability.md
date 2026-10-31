# ADR-023 · Observability — **Approval required (`DEC-21`)**

- Status: Accepted
- Date: 2026-10-29
- Related: Proposed; approval: **Yes (`DEC-21`)**; stage S1/S8

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** JSON logs through one `logger` (levels, request ID, redaction of phone/email/tokens/passwords/keys) to Vercel Logs from S1; error tracking added by S8. **Recommended tool: Sentry** (browser + server, source maps, alert rules); alternative is Vercel's own error views for v1. Pick before S8.
