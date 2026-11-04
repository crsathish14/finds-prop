# ADR-041 · The homepage's data: three cached reads and the mapping to the cards

- Status: Accepted
- Date: 2026-11-04
- Related: ADR-012 (search architecture), ADR-025 (URLs), ADR-040 (the search address), ADR-017 (column grants), roadmap S4-T06, FR-PUB-05, BR-42, BR-90, BR-92, BR-94

## Context

The homepage sections "Featured homes", "New launches from developers" and "Newest on Find Prop" need data, and no application code read the database yet: `search_properties()` existed (S3) but nothing called it. The owner approved the plan on 4 Nov 2026 ("all recommended"): the data first, in its own change with no screens, then the sections on the page.

## Decision

- **A new module, `src/features/home`:** reads in `queries.ts` (server only), the mapping to the cards in `cards.ts` and `new-launches.ts` (pure), the checks on what comes back in `schemas.ts` (Zod).
- **Three reads, as the anonymous visitor** (the cookie-less public client, so only what Row Level Security and the column grants allow can come back):
  - `getFeaturedHomes()`: `search_properties(label featured, sort newest, limit 6)`.
  - `getNewestHomes()`: `search_properties(sort newest, limit 8)`. A featured home can also appear here; the UX does not remove it.
  - `getNewLaunchDevelopers()`: builders with approved, published projects, featured projects first and then the newest. One read ranks the builders and counts their projects (up to 1,000 public projects; beyond that the counts stop there); then one small read for each of the first three gets its first two projects. No migration: an inactive builder is already invisible to visitors (BR-94) and an unapproved or unpublished project too (BR-42), so the reads cannot show them.
- **Cached for minutes and tagged** (`home-listings`, `home-projects`) like the site content, so approving a listing or project in the admin can refresh them later. The reads return plain rows, not card data: the words ("3 days ago", "Apartment") depend on the request's language, which a cache cannot see. The **age is read inside the cache** (the clock may not be read while a page is prerendered) and kept as whole days, so it can be out of date by the cache's few minutes.
- **A failed read leaves the section out:** it is logged by its error code only and gives no rows, so the page still renders (as the site content does). A row that does not fit its schema is skipped and only the number skipped is logged, never the row. A label this site does not know counts as no label.
- **The mapping:** a home is `/properties/{slug}-{shortId}` (ADR-025); a project is `/projects/{slug}`; the picture is the public address of the file in the `listing-photos` bucket (a home's cover) or the `project-media` bucket (a project's first picture), both already allowed by `next.config.ts`; the kind of property is shown only when this site knows it. Save and Compare are not part of the data: the page gives the cards those controls once they exist (S5-T01, S4-T02).
- **"Listed ago" words** are in the message catalogue: Today, days up to 29, then months of 30 days and years (`formatListedAgo` in `lib/format.ts`).
- **Not decided here:** what "Newest" does with a home that is also featured; the order of "New launches" by project status (all public projects count, not only those marked as new launches); the developers' logos (the card shows the monogram, as decided for S4-T01).

## Consequences

- The sections of the homepage (the next change) read these functions and map the rows with `toPropertyCard` and `toDeveloperCard`; they add no query of their own.
- Approving or changing a listing or project must call `revalidateTag` on the matching tag when the admin screens are built (S7), or the homepage shows the old rows for up to a few minutes.
- The tests use a stand-in for the database client; the visibility rules (only approved, only published, only active builders) are covered by the existing database tests.
