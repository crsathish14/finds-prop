# ADR-025 · SEO and URLs — **Approval required (`DEC-12`)**

- Status: Accepted
- Date: 2026-10-29
- Related: Proposed; approval: **Yes (`DEC-12`)**; stage S4

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** property URL `/properties/{descriptive-slug}-{shortId}` (8-char public id column `short_id`); lookup by `short_id`, `308` to canonical if slug differs. Projects keep `slug` (already unique). Metadata via `generateMetadata`; `sitemap.ts` covers approved properties and live projects; `robots.ts` disallows `/admin`, `/builder`, `/dashboard`, `/api`; JSON-LD `RealEstateListing`/`Product`-style where valid; canonical strips tracking params and sorts filter params.
