# ADR-093 · Site content: the Hero and Homepage parts and the localities editor (S7-T10, part B2)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-089 (the server side), ADR-090 (the frame, the link list and the Header and Footer parts, whose frame, save bar and section card are reused), ADR-087 (the project form parts), FR-ADM-10, FR-ADM-11, BR-81, BR-82, ADD-11, DEC-13
- Plan approved by the owner on 9 Nov 2026 ("approved"). This is the second of two Design Lab changes; the connected pages follow in two changes.

## Decision

- **Parts first, in the Design Lab, three more entries on the "Site content" board** (the board ADR-090 made). No page is connected here. Like the other Site content parts, none of them holds state of its own: the page keeps the values, the errors and the words, already translated.
  - **`SiteHeroFields`** (domain): the Hero page's boxes (eyebrow, headline, subtitle) and the choice between the two layouts, Search Desk and Split. The headline is needed; an empty eyebrow or subtitle means "use the standard one" (BR-81).
  - **`SiteHeroPreview`** (domain): a small picture of the hero in the chosen layout. The eyebrow shows in Split only, as it does on the home page. The banner is a plain stand-in, because which sponsor shows is chosen elsewhere. Hidden from screen readers (the boxes say the same things).
  - **`SiteHomepageFields`** (domain): a switch for each section below the hero (the whole row is the click target, the line under the name is read with the switch) and the localities list.
  - **`SiteHomepagePreview`** (domain): a small picture of the home page with each section On or Off (said in words as well as dimmed), the Popular chips (the first four localities) and the locality tiles; with no localities it draws the note that the section is hidden. Hidden from screen readers.
  - **`SiteLocalitiesEditor`** (domain): the list of curated localities, each a label, a latitude, a longitude and a radius, reordered with the grip or the two arrows (the shared sortable row), removed with a button that names the locality. Add is off at the limit and a notice says so; an empty list shows a note with its own Add button. A radius the row already holds that is not among the choices is kept and listed, so opening old data never changes it silently.
- **`ChoiceCards` (the wizard's cards) gains two optional props, additive and with no effect on its current use:** `visual` (a small drawing above a card's name, hidden from screen readers) and `hideLegend` (say the question to screen readers only when a heading above already names the group). The Hero page uses both for the two layout cards.
- **Departures from the approved screens** (all agreed in the plan):
  - **Latitude and longitude are two typed boxes** where the approved localities screen has one "Place" search box. The place search (S4-T05) was left out by the owner, so the numbers are typed; a place picker can fill the same two boxes later. The server checks that the point lies inside the region (ADR-089).
  - **The radius choices are 2 to 6 km**, not 2 to 5: 6 km is already used in the stored data. The new row starts at 3 km. The screen's "Default radius to confirm" flag is a review note and is not part of the product.
  - **At most 8 localities** can be saved (the read side still accepts 30). The notice at the limit says "8".
  - **"Background image" (Hero) and "Featured section title" (Homepage) are left out.** Neither approved layout draws an image, and the section's title is part of the page's own wording; a box for either would have no effect.
  - **The "Proposed setting" and "To decide" chips** of the prototype are review notes and are not part of the product.
- **Not in this change:** any page, action call, toast or locale file entry (the pages), the place search.

## Wording to confirm

From the approved screens and used as written: "Hero", "Text", "Eyebrow", "Headline", "Subtitle", "A small line above the headline. Shown in the Split layout.", "Layout", "Both layouts use the same text, search and header. If no sponsor is booked, the page shows Search Desk without a banner.", "Search Desk" and "Centred search with a banner strip underneath.", "Split" and "Search on the left and a larger sponsored image on the right.", "Sections", "Turn sections on or off. A hidden section is not rendered at all.", the five switches ("Featured listings", "Browse by what matters", "Explore by locality", "Why Find Prop", "Post-property call to action") with their lines, "Explore by locality", "Tiles shown under the search. The first 4 also appear as Popular chips in the search card. Visitors who click one see homes within the radius.", "Add locality", "No localities yet", the note under it, "Order matters. Use the arrows (or drag the handle) to change it. Radius is how far from the place a visitor's search reaches.", "Label", "Radius", "Remove", "Section hidden" and its line, "Popular chips in the search card" and the sections' names in the preview. New, for your confirmation:

- "Latitude" and "Longitude" as the two boxes that stand for the place (the words are the ones the project form already uses).
- "(optional)" beside the Eyebrow and Subtitle boxes.
- The limit notice: "You've reached the limit of 8 localities" and "Remove one to add another."
- The accessible names "Locality 2" (a row), "Label 2", "Latitude 2", "Longitude 2", "Radius 2", "Remove: Adyar", "Drag: Adyar", "Move up: Adyar" and "Move down: Adyar", and "km" after a distance.
- In the Lab demos only (the pages will use the real messages): "Add a headline before saving." and "1 thing needs attention".

## Consequences

- No migration, package, gate, environment or server change. Three more entries on the Site content board (its page, its row in `docs/ux-reference.md` and its registry entry already exist, with their descriptions widened). The board's three pictures change, taken in CI at 390, 820 and 1440 px and committed as baselines after your approval; no other board's pictures change.
- Rollback: delete the five new parts, the demos and the three entries, the two optional `ChoiceCards` props, the tests and this ADR. Nothing else uses them yet.
