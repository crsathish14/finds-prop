# ADR-026 · Compare in browser storage

- Status: Accepted
- Date: 2026-10-29
- Related: Confirmed; approval: No; stage S4

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** `useSyncExternalStore` over `localStorage` key `findsprop:compare:v1`, max 3 ids, cross-tab `storage` event; page reads `?ids=` and fetches by id on the server.
