# ADR-012 · Search architecture — **Approval required (`DEC-11`)**

- Status: Accepted
- Date: 2026-10-29
- Related: Proposed; approval: **Yes (`DEC-11`)**; stage S4

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** PostGIS `geography(Point,4326)` + GiST; `search_properties()` RPC (`security invoker`, stable) returning explicit public columns; `tsvector` for keyword `q`; place search = radius around picked coordinates (default 5 km, adjustable) OR text match on locality; viewport search = bounding box. URL contract in `05 §6`. "Show more" is `show=12|24|…|120` on the URL; `router.replace(..., { scroll: false })`.
- **Why not infinite scroll with client cache:** keeps URLs shareable (UX principle 4) and results server-rendered.
- **Risk:** re-querying N rows each step (cheap at NFR-12 scale); revisit with keyset pagination if needed.
