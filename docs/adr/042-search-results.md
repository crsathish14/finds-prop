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

## Decision for step C: the page (`/properties`)

- **The address is the search.** `app/[locale]/(public)/properties/page.tsx` reads `searchParams` with `parseSearchParams` (the region's bounds from the site settings), reads one page through `getSearchResults`, makes the cards with `toPropertyCard` and gives everything to `ResultsScreen`, which fetches nothing. Reading the address makes the page dynamic, so `properties/loading.tsx` stands in (its own outline as skeleton lines and loading cards).
- **The canonical address** (`frontend.md` 6.1 rules 1 and 2): an address with an invalid value, a default, a lone coordinate or its parameters in another order is sent to the canonical one (`canonicalRedirect`; only the contract's own parameters are compared, so a campaign tag is left alone). Invalid values go silently: no notice (the owner's answer, 5 Nov 2026). Because the page streams under `loading.tsx`, the redirect arrives as a client navigation after the first bytes, not as a 307.
- **Every choice writes the address in one place** (`SearchNavigationProvider`): the rail, the bar, the chips and the label choice replace the address and keep the scroll position; the phone sheet's Show button pushes once; Try again asks the server again. A new search shows the loading skeleton; "Show more" keeps the cards, shows the button as loading and moves focus to the first new card. A changed search starts again from its first page (`show` is dropped).
- **Budget with All (open question 1, owner's answer: hide it).** While Looking to is All the budget field is left out and choosing All puts the budget back to Any (`budgetNeedsLooking` on the filters, off by default so the other boards do not change). An address that holds a `maxPrice` with no `listingType` still searches with it and shows its chip.
- **Words in the heading** (new, for the owner's approval): "{Homes | Apartments | Villas | Houses | Plots | Commercial properties} for sale | for rent | for sale and rent", then "in {place}" with the place in copper; the count line "48 homes found in Velachery, Chennai" (the region only when the site content has one, DEC-14); "0 homes match these filters"; "All localities" / "All of {region}"; the breadcrumb "Home > Properties > {place}" and "Back to Properties".
- **Locality choices** are the curated localities of the site content until the place search (S4-T05); a place or locality that is in the address and not in the list is added to the list so the box never lies. A curated place becomes `place`, `lat`, `lng` and `r`; any other text is a `locality` match.
- **The count on the phone sheet's button** is the page's total, only while the choices in the sheet are the applied ones; after any change it says "Show homes" (counting a draft would need a query per change, which is not built).
- **Clear all:** the chips' and the rail's Clear all remove every filter parameter (the quick label included) and keep sort and view. The sheet's Clear all resets its fields; applying it keeps the quick label and the keyword, which the sheet does not show.
- **A failed read is not cached** (the cached read throws, the wrapper turns it into `failed`), so Try again asks the database again. Next.js logs the thrown error as well as our own log line (which has the error code only).
- **Moved here from the homepage:** the listing row schema and the cache tag now live in `features/search/listing-row.ts` (the homepage re-exports them), so the search does not import the home feature and the two do not import each other.
- **Not built:** the canonical `<link>` tag (the site has no `metadataBase` yet), remembering the view per visit (the owner's answer: skip), the compare bar (S4-T02), save buttons (S5-T01), the sponsored card (S4-T07), place suggestions (S4-T05) and the map (S4b). The Design Lab shows the whole page with sample homes (Domain board, "Results page"). Not tried against real homes: the hosted dev database needs secrets, so the page was exercised against a database that is not there (failed-load state) and with sample data in the Lab.
