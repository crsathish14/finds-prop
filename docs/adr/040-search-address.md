# ADR-040 · The search address: one contract, in one place

- Status: Accepted
- Date: 2026-11-04
- Related: `docs/engineering/frontend.md` section 6.1, ADR-036 (names are words), ADR-039, roadmap S4-T06 and S4-T04, BR-91, R-FE-11

## Context

Every link to the results page (the home page's search card, its Popular chips, the locality tiles, the "Browse by what matters" cards, the header's Buy and Rent) and the results page itself must agree on what an address means. `frontend.md` 6.1 defines the parameters, but no code held them, and the home page needs them before the results page (S4-T04) exists. The owner approved the plan on 4 Nov 2026.

## Decision

- **One module, no framework code:** `src/features/search` (`schemas.ts`, `params.ts`, `from-card.ts`, `index.ts`). It can run on the server (reading `searchParams`) and in the browser (building links). S4-T04 adds the page, the count and the rest of the slice on top of it.
- **Invalid values are dropped, never thrown on** (`parseSearchParams`): each parameter is checked on its own, a repeated parameter counts once (the first), text is trimmed, and a search always has a sort, a show and a view (their defaults when left out). A place needs both `lat` and `lng` (and to lie inside the region's bounds when the caller passes them); without a place the radius is dropped too.
- **One address per search** (`buildSearchHref`): `/properties` plus the parameters that are not their default, alphabetical by their address name. Values go through the same rules, so a value that does not fit is left out, not written. Coordinates are rounded to six decimals. Defaults are sort `newest`, show 12, view `grid` and radius 5 km.
- **Names are words in code, the address keeps its names:** the address calls the radius `r` and the keyword `q` (kept from Phase 1). The naming rule (R-GEN-11) forbids one-letter property names, so in code they are `radiusKm` and `keyword`, and `ADDRESS_NAMES` maps them at the edge. The sort order of the address is by the address name.
- **The search card as an address** (`searchParamsFromCard`): Buy is `listingType=sale` and Rent is `rent`, and it is always set, since the card always has one of them chosen; the kind of property, bedrooms (`bhk`) and maximum budget (`maxPrice`) are written only when chosen. Text that is one of the curated localities of the site settings (any capitals) is that place: `place`, `lat`, `lng` and `r` (the curated radius kept within 1 to 50 km). Any other text is a `locality` text match, which is the fallback the contract names.
- **Clear all** removes every filter parameter and keeps sort and view (`clearSearchFilters`, `frontend.md` 6.1 rule 3). The filter rail and sheet's `clearFilters` now agree with it: it also puts Looking to back to All. The first version of the filters kept Looking to, which contradicted the rule; it is corrected here, before anything was wired to the address.

## The homepage search (second step of S4-T06)

- **`HomeSearch`** (a client island in `features/search`) joins the search card to the address: Search opens `searchHrefFromCard(values, curated)`. Suggestions are the curated localities that match what is typed, with no pause, until the place search (S4-T05).
- **Popular chips** are the first four curated localities (`popularLinks`), each a link to the homes around that place, with no Buy or Rent since a chip is not part of the card's choice. **Quick picks** are `bhk=3` and `label=budget`. With no curated localities the Popular chips are left out and nothing else changes (DEC-13).
- **The AI link** is drawn only when `FLAG_AI_SEARCH` is on.

## Consequences

- A link or a form that goes to the results page builds its address with `buildSearchHref` and never writes a query string by hand.
- `bbox` (the map viewport) is not part of the contract until the map view (S4b).
- Changing a parameter is a change to `schemas.ts` and `frontend.md` together.
