# ADR-042 · The results page (S4-T04)

- Status: Accepted (data layer); the screens are added by the next two changes
- Date: 2026-11-05
- Related: ADR-012 (search architecture), ADR-040 (search address), ADR-041 (homepage data), `docs/engineering/frontend.md` section 6, BR-90, BR-91
- Plan approved by the owner on 5 Nov 2026 ("all recommended"): three changes, A (data), B (results bar and states), C (the page).

## Decision for step A: the data layer

- **One function reads a page of results:** `getSearchResults(params)` in `src/features/search/results.ts` (server only). It calls `search_properties()` as an anonymous visitor, so only approved listings and public columns can come back (BR-90).
- **A parsed search becomes the function's arguments in one place** (`toSearchRpcArgs`, pure). Only what the visitor chose is sent; the function has its own defaults and checks every range. The radius travels only with a place. `show` is the length asked for (`p_limit`): "Show more" asks again for a longer list, so no offset is needed and `sort` plus the function's tiebreaker keeps the order stable (`frontend.md` 6.2). The place's label is for display and is never sent.
- **The total is the function's `total_count`** (rule 6): no second query. No rows means a total of 0. A first row whose total cannot be read falls back to the number of homes held; a missing total is never read as 0.
- **Failures:** a failed read gives `{ status: "failed" }` with no detail and logs only the error code, never the filters (they can hold what a person typed). A row that does not fit is skipped and counted, as on the homepage.
- **Cache:** minutes, under the same tag as the homepage homes (`home-listings`), so an approval refreshes both. The cache key is the parsed search, which has one canonical form.
- **Not exported from `features/search/index.ts`:** `results.ts` is server only, and the index is read by a client island. Step C decides how the page reaches it (a server-only entry next to the index) and records it here.

## Consequences

- The page (step C) adds no query of its own; the cards come from `toPropertyCard` (ADR-041).
- The first read with a bad value (for example a budget the function refuses) shows the "couldn't load" state, not a crash; the address rules already drop such values before they get here.

## Decision for step B: the results bar and the body (components only)

Built in `src/components/domain` (`results-bar.tsx`, `results-list.tsx`) and shown at the end of the Domain board. Controlled and fetch-free, like the other organisms (ADR-039): values in, the choice out, no address logic (step C).

- **ResultsBar** (sort select, grid and list toggle, a slot for the Filters button below 1024 px, rows underneath), **ActiveFilters** (one removable chip per applied filter, each remove button named "Remove filter: 3 BHK", plus Clear all; nothing drawn when none), **LabelFilter** (Show: All, Featured, Prime, Budget, toggle chips).
- **ResultsGrid** (1, 2 or 3 across by the width of the results area itself, container queries at 576 and 896 px, since the rail takes a share of wide screens), **ResultsSkeleton** (PropertyCard skeletons, busy and named "Loading homes"), **ResultsLoadMore** (the existing `ShowMore`; at the 120-home cap the button is "Refine your search"), **ResultsEmpty** (the existing `EmptyState`; the "Describe it in words" link only when given an address, so AI search off leaves no trace), **ResultsError** (the existing `Alert`, danger, with Try again).
- **Not as drawn, decided here** (the owner can change them): the open sort list is the browser's own list, as in the filter sheet, not the UX's custom list; the removable chips are 40 px tall (the UX draws a smaller chip); the sort label shows from 768 to 1023 px only (on a phone the select is named for screen readers, so the row fits at 390 px); "Refine your search" is new wording from `frontend.md` 6.2, not drawn in the UX, and needs the owner's approval; the UX's "Proposed" flag is a design note and is not drawn.
- **Not built here:** the compare bar (S4-T02), the sponsored card (S4-T07), the heading and count line (they belong to the page, step C), focus moving to the first new card after Show more (the list owns it; step C).
