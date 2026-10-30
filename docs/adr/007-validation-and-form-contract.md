# ADR-007 · Validation and form contract

- Status: Accepted
- Date: 2026-10-29
- Related: Refined; approval: No; stage S1

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** one Zod schema per input in `features/<x>/schemas.ts`, imported by both the client form resolver and the server action; `ActionResult<T>` = `{ ok: true, data } | { ok: false, code, message, fieldErrors? }`; messages are safe to show; internal errors are logged, not returned.
- **Note:** confirm resolver compatibility with the Zod major in use at `S1-SPK-04`.
