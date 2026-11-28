# ADR-219 · A rent search on the results page shows projects for rent under the homes

- Status: Accepted. Owner decision in chat on 28 Nov 2026 ("add them to /properties too"); the layout and the words "Projects for rent in {area}", "Projects for rent" and "See all projects" were approved by the owner the same day.
- Date: 2026-11-28
- Related: ADR-214 (a residential project may be for rent), ADR-215 (the assistant's one list of homes and projects), ADR-137 (the "Also near" section), ADR-171 (the login wall)
- Class: C1. No migration, no dependency.

## Context

ADR-214 let a residential project be for rent. The Projects page and the assistant show those projects, but the results page `/properties` read homes only, so a visitor searching for a home to rent never saw them.

## Decision

1. **Only on a rent search** (`listingType=rent`) for a kind a residential project can be: no property type, apartment, villa or plot. A house or a commercial search shows none.
2. **Its own section under the homes** (after "Also near" when that shows): the heading "Projects for rent in {area}" when an area is searched, "Projects for rent" without one, a "See all projects" link to `/projects`, and at most six project cards (the Projects page's own card, which shows the rent per month), always in the grid.
3. **Which projects:** residential projects for rent, priced per month, from the same list the Projects page reads for the selected city (`live_project_list()`, live projects of active builders). The property type, the bedrooms and the budget (minimum and maximum monthly rent) narrow them; a project with no price never meets a budget. The ones whose locality holds the searched area come first, then the rest of the city, each in the list's own order (featured first, then the newest).
4. **The homes are untouched:** the headline count, the order, "Show more" and the pages are the homes' own. The section shows only when at least one project fits and the homes' read did not fail; otherwise nothing is drawn.
5. **The kind** (residential or commercial, and the property type) is not in the list, so `getProjectKinds()` reads it for the candidates with the visitor's own client (signed-in readable columns). A failed read shows no project rather than a wrong one.

## Consequences

- One more read of the project list (the one the Projects page makes) and one small read of the candidates' kinds on a rent search; nothing on a buy search.
- The assistant's rule (ADR-215) and this section agree on which projects fit a rent search; the assistant keeps its own ranking.
- No Design Lab specimen was added for the section, so no screenshot baseline changes; the owner approved the layout from its description.

## Tests

`UT-project-rent-projects` (`src/features/projects/__tests__/rent-projects.test.ts`), the section in `results-screen.test.tsx`, the page's read in `properties-page.test.tsx`.
