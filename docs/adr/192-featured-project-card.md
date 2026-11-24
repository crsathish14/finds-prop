# ADR-192 · The Featured project card in the homes and projects lists

- Status: Accepted (owner decisions of 23 Nov 2026 on the sponsor ads redesign; the owner said "Start" on 24 Nov 2026; the new words were approved by the owner on 24 Nov 2026 ("approved")).
- Date: 2026-11-25
- Related: ADR-191 (who it draws from), ADR-179 (builder logos), ADR-045 (the banner in the results it replaces), ADR-171 (login wall)
- Class: C2 (a deviation from the approved UX: the results had a picture strip). No migration, no dependency.

## Context

The owner decided that the Featured project card (concept C) replaces the picture strip after the sixth result, on the homes list (`/properties`) and the projects list (`/projects`); that it shows a project of a builder or agent the admin picked (ADR-191), drawn only from what they uploaded; that a project in the searched area comes first; and that each visit shows a different one.

## Decision

- **The reader** (`getFeaturedProject` in a new `src/features/sponsored`): with no builder picked it reads nothing. Otherwise, as the signed-in visitor (both lists are behind the login wall), it reads the live projects of the selected city through `live_project_list()` (up to 120, the function's own limit), keeps those of the picked builders, picks one with `pickFeatured` (a project in the searched area first, matched on the locality either way round, ignoring case and punctuation; otherwise any; by chance, so each visit differs), then reads that project's details through `public_project()` and its builder's logo (the uploaded one, else the logo link, else initials). Only approved, published projects of active builders can show, as both functions give nothing else. A failed read is logged by its code and shows no card: the list is never broken by it. No database change: the existing functions and the public builder columns are enough. (A picked builder whose projects are all beyond the 120 newest of the city is not shown; a dedicated function can replace the list read if that ever matters.)
- **The card** (`FeaturedProjectCard`, domain): an amber ring and a "Featured project" ribbon; a big photo with two more and "+N photos"; the developer's logo or initials and "Sponsored"; the project as a heading; the locality; chips for the BHK sizes, the size range, the status and "RERA registered"; up to three highlights (the first amenities, then the possession month); the price in the project cards' own words; "Request a call back" (the project page's enquiry form, `#enquiry`) and "View project". It spans the whole row of the list.
- **Placement**: after the sixth home on `/properties` (the searched locality or place is the area) and after the sixth project on `/projects`, only when a card can show: no empty row and no gap. The picture strip is no longer shown in the results. The page reads for each request (the address or `connection()` first), so the chance is the visit's own.
- The logo bucket's name moves to `src/lib/storage-url.ts` beside the project bucket, so the reader does not import the builders feature.

## Words (new, approved by the owner on 24 Nov 2026)

`domain.featuredProject.*`: "Featured project", "Sponsored", "{sizes} BHK", "{from} to {to}", "Possession {date}", "RERA registered", "+{count} photos", "Request a call back", "View project".

## Consequences

- Tests: the picking rule, the reader (nothing picked, the picked builder's project with its details and logo, none live, failures, the logo fallbacks), the card, the results page with the reader stood in; Design Lab "Featured project card" on the Ads board.
- With no builder picked on the Sponsored builders page, no card shows.
- Rollback: revert this change; the results show the picture strip again.
