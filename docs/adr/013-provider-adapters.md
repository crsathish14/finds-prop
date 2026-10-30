# ADR-013 · Provider adapters

- Status: Accepted
- Date: 2026-10-29
- Related: Confirmed; approval: No; stage S3

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** `src/server/sms`, `src/server/places`, `src/server/mail` each expose a small interface. Ola Maps is the `places` implementation; keys server-only; Tamil Nadu bounding filter in one place (ARC). A fake implementation is used in tests/CI.
