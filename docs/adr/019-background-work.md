# ADR-019 · Background work

- Status: Accepted
- Date: 2026-10-29
- Related: Confirmed; approval: No; stage S7

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** `pg_cron` + `pg_net` call a token-protected Route Handler for CRM retries (BR-66/67) and the media sweeper. The app base URL is stored in a service-role-only config table (or Vault), **not** a manually-set database GUC, so each environment is configured by migration + seed. No queue service.
