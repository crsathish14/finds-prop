# ADR-039 · Domain organisms and the Design Lab's Domain board

- Status: Accepted
- Date: 2026-11-03
- Related: ADR-020, plan 04 section 7 and 7.2, roadmap S4-T01, R-DS-02, R-DS-03, R-FE-12, R-FE-20

## Context

S4-T01 builds the organisms that appear only inside the screens: the property, project and developer cards, the locality tile, the search card and filters, the gallery, the sticky mobile bar and the enquiry card. The five approved design-system boards do not show them, and the Design Lab has one board per approved UX board (ADR-020). Their approved look is inside the `search`, `property`, `projects` and `home` screens. The owner approved the plan on 3 Nov 2026.

## Decision

- **Where they live:** `src/components/domain/`, a layer beside `ui`, `patterns` and `layout`. The registry test and the spec-header test now include it, so a component there without a Design Lab entry or a specification header fails.
- **The Lab:** a sixth board, **Domain** (`/design-system/domain`), mirrors the `search` screen (the test needs one existing screen file; the board summary names the others). Entries are added with each component. Its screenshot baselines are made by the Linux CI runner and added in their own commit, after the owner compares them with the UX render (R-TEST-06).
- **No data, no state:** each organism takes plain props and slots, and fetches nothing. The page or a feature island wires saving (S5-T01), compare (S4-T02), search and URLs (S4-T04), places (S4-T05) and enquiries (S5-T03). The heart and Compare controls are separate client components passed in as slots, so the card itself stays a server component.
- **Pictures:** `next/image` with `fill`, a `sizes` for the card's column and a fixed ratio. `next.config.ts` allows the public Supabase storage paths (`*.supabase.co`, and the local stack on 127.0.0.1:54321). A missing or failed picture shows the illustrated tile. The Lab uses drawn SVG tiles in `public/design-lab/listings`, never photographs.
- **List layout:** chosen by a prop and collapsed by a container query on the card's own width, not the screen width (plan 04 section 11, item 2).
- **Proposed items stay unbuilt:** the grid and list toggle, active filter chips, Show more on search, the sponsored banner inside results and the locality filter on Projects.
- **Wording:** visible text comes from `en.json` under `domain.*`; text that depends on dates or on several facts (how long ago a home was listed, the list summary) is passed in already translated by the page, so no date or sentence rule is invented here.

### Project card, developer card and locality tile (second pull request)

The owner approved this plan on 4 Nov 2026.

- **Loading:** each has a skeleton with the same box (`ProjectCardSkeleton`, `DeveloperCardSkeleton`, `LocalityTileSkeleton`). The UX shows a loading state for the project card only; the other two follow the property card's pattern, at the owner's request.
- **Colours:** the UX hard-codes the five tile tints and the sand monogram. These use the nearest palette tokens and no new token was added. Tints 1 and 2 and the green and copper monograms match the UX exactly. Tint 3 ends at sand 200 (the UX ends at a slightly darker sand), tint 4 uses the same colours as tint 1 (the UX's are nearly the same), tint 5 runs from copper 100 to sand 100 (the UX is a warmer straw), and the sand monogram's text is the neutral grey-green (the UX uses a brown). The owner compares the rendered boards with the UX.
- **Developer logo:** the database stores a logo link, but the UX never shows one: the developer card uses a monogram. The card shows the monogram only. Showing logos needs a design for the logo (size, crop, broken link) and a decision on loading pictures from any web address, since `next.config.ts` allows only our own storage.
- **Where the tile list comes from:** the tile takes its name, link and subtitle as props. The curated list of localities (ADD-11, still Proposed) is not part of this change.
- **Small differences from the UX:** the project name uses the display heading size (19 px on a phone, 22 px from the desktop width; the UX is 22 px everywhere); spacings use the 4 px scale; the tile's corner radius is 18 px (the UX 20 px).

### Search card (third pull request)

The owner approved this plan on 4 Nov 2026. The filter rail and sheet follow in their own pull request.

- **Controlled by the page, no address logic:** the card keeps only what the visitor has chosen and calls `onSearch({ intent, locality, propertyType, bedrooms, maxBudget })`. The page (S4-T04) turns the values into the results address, as `frontend.md` says (the search form has no submit action). The same applies to the links: "New projects", "Describe it in words" (drawn only when the page gives the link, so AI search off leaves no trace), the Popular localities and the two Quick picks are all given by the page.
- **Locality:** the existing Combobox (ADR-037) with the suggestions the page supplies (the twelve Chennai localities of the approved UX for now, one letter is enough). The place search of ADD-07 is still Proposed and is not built; it can replace the list later without changing the card, since the card only passes the typed text to the page. Combobox gained two optional props, `icon` and `inputClassName`, so the card can show a pin and draw the box itself; without them it is unchanged. Enter in the locality box searches unless that Enter picked a suggestion (cmdk otherwise swallows it).
- **Choices in one place:** `src/config/search-options.ts` holds the kinds of property, bedrooms 1 to 4 and the budget steps (sale: 50 L, 75 L, 1 Cr, 1.5 Cr, 2 Cr, 3 Cr; rent: 15,000, 25,000, 40,000, 60,000, 1 L, as drawn in the UX and confirmed by the owner). The filter rail and sheet will use the same lists. Switching Buy and Rent keeps the budget only if the new list has the same amount, otherwise it goes back to Any.
- **Layout answers to the card's own width:** the UX breaks at 640, 768 and 1024 px of screen width, and 640 is not a declared breakpoint (plan 04 section 10), so the card uses container queries on its own width instead. Under 576 px it is the phone layout. From 576 px the tabs and the AI link share a row, the locality and Search share a row and the chips show (the UX's 640 and 768 px layouts are one here, which also gives the stacked card at about 650 px on the homepage the UX's two-row layout). A wide card joins everything into one bar from 896 px (the UX's 1024 px screen).
- **Small differences from the UX:** the "Any ..." values are in the muted text colour (the UX uses a lighter one that is below the contrast limit); spacings use the 4 px scale (UX 10, 14 and 58 px become 8 px on a phone and 12 px from 576 px, 16 px and 56 px); the field text is 14 px on a phone and 16 px from 576 px. On a phone the labels are set with no letter-spacing and the chevron is 12 px, so the longest label (Bedrooms) never touches its chevron: measured clear down to a 360 px screen. When the card is narrower than 320 px (a 320 px screen) the tabs get tighter padding so they fit, and the chevrons move to the value row so nothing scrolls sideways; the values then truncate more.
- **Chips:** Popular and Quick picks are links (the UX draws links too); up to four Popular on a wide card and three on a stacked one, as in the UX. Without any, the row is not drawn. They are hidden below 576 px of card width.
- **Not built:** the place search and its attribution (ADD-07), the curated list behind Popular (ADD-11), the keyword-search rule for text that is not a locality (to confirm in the UX), and the swap of the hero stand-in in the Design Lab previews (the hero change of S4-T06).

## Consequences

- The Domain board's pages need new baselines each time an entry is added; each pull request needs a second push for them.
- Cards are tied to the shape of `search_properties()` through the page's mapping, not through types, so a change to that function is a change to one mapping function.
