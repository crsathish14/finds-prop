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

### Filter rail and filter sheet (fourth pull request)

The owner approved this plan on 4 Nov 2026 (it was the second half of the search card plan).

- **One set of fields:** `FilterFields` (Looking to, locality, kind of property, bedrooms, maximum budget, and Sort by in the sheet) is used by both the rail and the sheet, so they cannot differ. They are controlled by the page: values in, the whole new set out, no address logic (S4-T04).
- **Rail:** a card of fields in which every change is reported at once, with Clear all. It is a complementary landmark named by its heading. The page decides where it sits (sticky, from 1024 px); it does not hide itself, so the Design Lab can show it at every width.
- **Sheet:** the "Filters" button (with the count of filters set, and the name "Filters, 4 applied") opens the shared bottom Sheet. Choices are kept in a draft and applied only by "Show N homes"; closing the sheet any other way drops them. "Clear all" in the sheet resets the draft and leaves it open. The count in "Show N homes" and a way to follow the draft (`onDraftChange`) are given by the page; with no count it says "Show homes", and "Show 1 home" for one.
- **Not in the UX, so decided here (the owner can change them):** "Clear all" resets every filter, Looking to included, and leaves the sort order alone (first built keeping Looking to, which contradicted `frontend.md` 6.1 rule 3; corrected in the search address change); the button's count is the four filters locality, kind of property, bedrooms and budget, as in the UX's example (4 for Velachery, Apartment, 3 BHK and up to 1.5 Cr). With Looking to set to All the budget list is the sale list, as drawn in the UX, which compares a sale cap with rents; S4-T04 decides what a budget means with no listing type.
- **Locality is a dropdown, as drawn:** "All of the city" (words given by the page, since the region wording is undecided, DEC-14) and the localities the page supplies. A locality that is not in the list is added to it, so the box never shows a different one. The place search of ADD-07 (Proposed) can replace the dropdown later.
- **Bedrooms:** one value, as toggle buttons in a labelled group: Any, 1, 2, 3, 4. The chosen one is filled and has no tick, as the UX draws it (the shared Chip's tick style is not used here); each is named "3 BHK" for a screen reader.
- **Small differences from the UX:** the panel's corner radius is 18 px (UX 20 px), the gap between fields is 20 px (UX 18 px), "Clear all" is a ghost button rather than a link, and the sheet uses the shared Sheet, so its title row has a rule under it and its buttons sit in a footer with a rule above (the UX has neither).
- **No loading state:** the fields are static (the page gives them their lists), so there is nothing to show while loading.
- **Not built:** the results bar (sort at the right, grid and list toggle, active filter chips, label pills), which belongs to S4-T04, and the place search.

### Home hero (second step of the homepage, S4-T06)

The owner approved the plan on 4 Nov 2026 ("all recommended"): four steps, the hero second. The step makes the real homepage top: the headline, the line under it and the search card, joined to the results address (ADR-040).

- **`HomeHero`** (`components/domain`) is the "Search Desk" layout without a sponsor strip: the headline (the page's h1), the line under it, and the search card as `children`, on three faint green half-circles drawn at each side (SVG, cropped, never squeezed). It holds no words; the page passes them. The sponsor strip joins under the card in S4-T07, which also builds the "Split" layout, so a site content setting of `split` shows this layout for now.
- **The words** (`buildHero` in `features/site`, decided with the owner): a headline written in the site content is shown as given, with no copper word (the site cannot know which word it would be); otherwise the catalogue's "Find the place that fits your life." which, when the site content names a region, becomes "... in {region}." with the region in copper (display-size text, so it passes the large-text contrast limit); the line under it is the site content's or "Shortlist, compare and enquire directly." An empty or blank setting counts as no setting. The default names no place (DEC-14). The site content's eyebrow has no place in this layout (the UX draws one only in the Split layout), so it is not shown yet.
- **The shared `TitleWithEmphasis`** (from the error screen, now in `ui/heading.tsx`) sets the named part of a title in italic copper; a second screen needed it (R-DS-02).
- **The card's extra prop:** `SearchCard` gained `localityDebounceMs` (default 300 ms, as before). The home page's suggestions are a local list, so it sets 0: with a pause, an Enter pressed straight after typing text that matches nothing would pick a suggestion left over from the shorter text instead of searching what was typed.
- **Small differences from the UX:** the headline is balanced and held to a width instead of broken by hand after "fits"; the line is 16 px on a phone (UX 15 px); the gaps follow the 4 px scale (UX 10 px and 22 px become 8 and 12 px, and 16 and 24 px).
- **Design Lab:** the hero previews use the real search card in place of the "built in Stage 4" stand-in, so their pictures change.

## Consequences

- The Domain board's pages need new baselines each time an entry is added; each pull request needs a second push for them.
- Cards are tied to the shape of `search_properties()` through the page's mapping, not through types, so a change to that function is a change to one mapping function.
