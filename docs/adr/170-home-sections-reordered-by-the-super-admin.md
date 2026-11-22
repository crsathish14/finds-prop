# ADR-170 · The home page sections are reordered by the super admin

- Status: Accepted (owner change request, 22 Nov 2026; autonomy rule of the same day)
- Date: 2026-11-22
- Related: ADR-089 and ADR-099 (site content, Homepage page), ADR-150 (one AI search bar), FR-ADM-10, BR-81, BR-82
- Class: C1 (a new optional field of an existing setting; no migration)

## Decision

- **What can move:** the seven sections below the hero: Explore by locality, Featured listings, New launches, Browse by what matters, Newest listings, Why findsprop and the closing call to action. The hero and the search bar always stay first.
- **One order for every screen:** desktop and mobile share it; the page renders the sections in one list.
- **Storage:** an optional `order` list of section keys inside the existing `homepage` key of `site_settings`. No migration; the existing audit trigger records that the setting changed.
- **Reading is forgiving (BR-81):** unknown keys are dropped, repeats are ignored, and a section missing from the saved list is added at the end in its built-in place. No saved order means the order the page always had. So a section added to the page later, or a damaged value, can never hide a section or break the page.
- **Writing is strict:** a save must list every section exactly once; anything else is refused.
- **Hidden or empty sections:** the existing switches still hide a section whole (not rendered, no gap). A section with nothing to show (no localities, no listings) is left out wherever it sits. New launches and Newest have no switch and are only movable.
- **Admin screen:** on the Homepage page, the Sections card becomes a sortable list: each row has the grip (drag with mouse, touch or keyboard: Space, arrows, Space), Move up / Move down buttons, and the section's switch. The preview beside it follows the order.
- **Caching:** the save refreshes the `site-settings` tag as every site content save does; the home page reads cached site content, so a change shows at once and the page stays static.

## Consequences

- The admin words for the order (hint, row labels, the two sections without a switch) are unapproved until the owner reviews them.
- The Design Lab specimen of the Homepage fields still shows the plain switch list (the order is optional in the component), so no picture baseline changes; the new rows are covered by tests only. A Lab entry for the sortable rows is a possible follow-up.
