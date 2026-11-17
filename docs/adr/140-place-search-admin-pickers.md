# ADR-140 · Place pickers for the admin and builder forms (S4-T05 reopened, plan PR 8)

- Status: Proposed. Built in this change; the owner approves before it merges. The homepage localities picker follows the approved screen (ADD-11); the project form's picker is new and has no approved screen, so the owner approves it from the CI pictures.
- Date: 2026-11-17
- Related: ADR-099 and ADR-102 (the Homepage page and its localities editor), ADR-089 (a place must lie inside the region: the server's check, unchanged), ADR-087 (the project form's parts), ADR-131 and ADR-132 (the adapter, the panel and its words), ADR-133 (the route, `source=admin_picker`), ADR-134 (the usage count), ADR-136 (the search box and the hook), FR-GEO-01 criteria 1 to 5, `OLA_MAPS_PLAN.md` (outside the repository) row 8 of the table of changes
- Class C1 (a feature inside existing patterns). Plan in the pull request.

## Decision

- **A picker that only writes into the two boxes.** The admin and a builder no longer have to look up coordinates. A "Find a place" box (the search box's behaviour: three characters, a 300 ms pause, our route `GET /api/places/autocomplete?q=&source=admin_picker`, the approved suggestion panel with its Ola Maps credit, never blocking) writes the chosen place's latitude and longitude into the existing Latitude and Longitude boxes. The boxes stay as they were: editable, typed text, the source of truth. Saving, the server's parsing and the "point must lie inside the region" check (ADR-089) are not touched; a place outside the region comes back as the same problem on the latitude box.
- **Numbers.** The boxes hold text, so a point is written as text: rounded to at most six decimals (about ten centimetres, what the schemas accept) with no trailing zeros, as a saved number is shown (`formatCoordinate`). Nothing else is derived from the pick.
- **The name.** In a homepage locality row the place's name fills the Label box only while that box is empty (blank text counts as empty), cut to the label's 60 characters; a name the admin typed is never overwritten. The project form's picker writes the point only: the locality and address of a project are the admin's own words and stay untouched.
- **When suggestions are unavailable.** The panel says so with its own title ("Suggestions aren't available right now") and a new line that points at the boxes ("Type the latitude and longitude below instead."); the search box's line about pressing Search and the keyword row are not used, because there is no search to send the text to. "No places found" and "too many searches" use the panel's words as they are. The typed boxes work in every state, and Enter in the picker never saves the form around it.
- **Parts.**
  - `PlacePicker` (`src/components/domain/place-picker.tsx`): pure, no fetching. It takes the text, the options and the panel state from its host, uses `usePlacePanel`, and reports the option chosen. It also exports `formatCoordinate`, `pickedCoordinates` and the types `PlacePick` ({ label, lat, lng }), `PlacePickerFieldProps` ({ id, suffix, disabled, onPick }) and `PlacePickerComponent`.
  - `SiteLocalitiesEditor` and `SiteHomepageFields` accept an optional `placePicker` component and draw it in every row, above Latitude, Longitude and Radius; `ProjectFields` accepts the same prop and draws it across both columns of the Location section, above the two boxes. Left out, they are exactly as before.
  - `AdminPlacePicker` (`src/features/search/admin-place-picker.client.tsx`) is the connected island: it holds the box's text, calls `usePlaceSuggestions(text, "admin_picker")` and gives `onPick({ label, lat, lng })` to the form. The hook gains an optional second argument, the route's `source` ("search_box" by default, so nothing else changes), and the search index exports the island.
  - **Why the page gives the picker to the form.** A form belongs to another feature (site-content, project-editor), and its client file cannot import the search index: the index also exports `results.ts`, which is `server-only`, so a client import of the index would put it in the browser bundle. The feature rules also allow only the index for a cross-feature import. So the five pages (admin Homepage, admin and builder project new and edit) import `AdminPlacePicker` from the index, which a server page may do, and pass it as the `placePicker` prop of `HomepageForm` and `ProjectForm`, which hand it down to the domain parts. A client reference can be passed as a prop from a server page; the form files import nothing from the search feature. The hook is not copied.
- **Usage.** Calls count under `admin_picker` (ADR-134), which the dashboard card already lists as "Admin pickers". Typed text goes only to our route, as the privacy page already says for the search box; the picker sends nothing else about the admin.
- **Design Lab.** A new entry "Place picker" on the Admin board (empty, typing, results open, picked, unavailable, in a locality row, in the project form's Location section) and the existing entries "Localities editor", "Homepage page" (Site content board) and "Project form" (Admin board) now show the picker (a short fixed list stands in for the route, so no picture calls the network). Those three boards' pictures change; the baselines are updated from the CI pictures and shown to the owner.

## New words (for the owner to confirm)

All in `domain.placePicker`; the panel's other words are the existing `domain.places.*`.

- Label: "Find a place"
- Placeholder: "Search for a place" (the approved screen's words)
- Hint: "Choose a place to fill the latitude and longitude below. You can still change them by hand."
- After a pick: "Filled in from “{place}”. You can still change the numbers below."
- Unavailable, second line: "Type the latitude and longitude below instead."

## Decisions for the owner

- **The project form's picker has no approved screen.** It is the localities picker's parts in the Location section. Approve it from the CI pictures, or say what to change.
- **The locality row keeps the two numeric boxes under the picker.** The approved screen shows one Place box with a "Change" button and no numbers. The owner asked for the boxes to stay editable, so they stay; the picker is above them.
- **Only the point is written for a project.** The name of the place is not copied to the project's Locality or Address. If the owner wants Locality filled while it is empty (as the locality row's Label is), that is a small follow-up.

## Consequences

- Typing three characters in the picker calls `/api/places/autocomplete`, which is rate limited (ADR-133), counted (ADR-134) and can be switched off with `PLACES_DISABLED=1`. With the route off or failing, the picker says so and the typed boxes work as before.
- A form given no picker (every existing test and any other caller) is unchanged.
- Left to later changes (plan): the listing location (PR 7) and the AI tool (blocked on Ola's written answer about AI use). No map.

## Verification

Unit tests, no network (`fetch` is stubbed): `PlacePicker` (label, hint, the notes, the credit, a click and the keyboard pick, Enter never submits the form, no keyword row, the unavailable and limited states, the picked line, disabled; `formatCoordinate` rounding); the island (the route is asked as `admin_picker` after three characters and a pause and not before, the name and point reported, the keyboard path, unavailable, empty and limited states); `usePlaceSuggestions` with the second source; `SiteLocalitiesEditor` and `SiteHomepageFields` with a picker (one per row, numbered, the point written to that row only and formatted, the name only while empty and cut to 60, boxes still editable, off while saving); `ProjectFields` with a picker (the two boxes written, the locality and address untouched); the Homepage form and the project form for the admin and a builder with the real island (the pick fills the boxes, a hand-corrected value is what is saved, unavailable still saves typed numbers, Enter does not save). The existing tests for typed coordinates pass unchanged. Not run locally by the owner's rule: pictures, axe and the keyboard specs of the Design Lab (CI).
