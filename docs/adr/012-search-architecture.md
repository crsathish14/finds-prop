# ADR-012 · Search architecture — **Approval required (`DEC-11`)**

- Status: Accepted
- Date: 2026-10-29
- Related: Proposed; approval: **Yes (`DEC-11`)**; stage S4

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** PostGIS `geography(Point,4326)` + GiST; `search_properties()` RPC (`security invoker`, stable) returning explicit public columns; `tsvector` for keyword `q`; place search = radius around picked coordinates (default 5 km, adjustable) OR text match on locality; viewport search = bounding box. URL contract in `05 §6`. "Show more" is `show=12|24|…|120` on the URL; `router.replace(..., { scroll: false })`.
- **Why not infinite scroll with client cache:** keeps URLs shareable (UX principle 4) and results server-rendered.
- **Risk:** re-querying N rows each step (cheap at NFR-12 scale); revisit with keyset pagination if needed.
- **As built (S4-T03, migration `20261103100000_search.sql`):**
  - The radius and the map box use `public_location` (rounded to about 100 m), not `location`. The function runs as the caller (`security invoker`) and no visitor can read the exact point (ADR-017), so this is the only point it can use. The same grant rule is why `search_vector` (title, locality and city only, never the address) is now readable by `anon` and `authenticated`.
  - `search_properties()` takes the map box as four numbers (`p_west`, `p_south`, `p_east`, `p_north`), checks every range itself and returns `total_count` on every row. `listing_label()` holds the BR-92 limits (`config/vocab.ts` mirrors them from S4-T04).
  - `map_properties()` is left for the map view (S4-T14), which waits on a UX design.
