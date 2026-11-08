# ADR-079 · The Units page, its form and the Leads table (S7-T01, part 2)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-078 (the table, the drawer and the Projects page), ADR-020 (Design Lab), FR-ADM-05, FR-ADM-06, FR-BLD-03, FR-BLD-04, BR-46, BR-47
- Plan approved by the owner on 8 Nov 2026 ("as recommended"): the status box works for the admin as well as the builder; form submissions and the CRM retry drawer belong to S7-T07.

## Decision

- **Three new domain parts, three Admin board entries.** `UnitsManager` (the Units page above its data), `UnitForm` (the fields of the Add unit and Edit unit drawer) and `LeadsTable` (the project leads). They hold no state, take their words as props and draw their lists with `ResponsiveTable` (ADR-078); the drawer is `ManagerDrawer`.
- **`UnitsManager` has no `mode`.** The admin and the builder see the same screen; what differs is which projects they may pick, and the backend decides that (RLS). Only the line under the heading differs, and the page passes it. This differs from the plan's wording ("with a `mode`"), because a prop with no effect on the part would be noise.
- **The unit's state and the lead's state are boxes and chips the page controls.** Edit and Delete are on each row; Delete asks in a `ConfirmDialog` that the page owns. A unit being deleted has both buttons off.
- **`LeadsTable` has one editable thing: the state box.** The contact details are text and a call link; the table cannot edit them (BR-46, BR-47). The builder's line "You can change a lead's status. Contact details can't be edited." is a prop, shown for builders only. The state box also works for the admin, as the approved screen shows.
- **A missing floor, area, facing, price, email or message is a dash the page passes**, not a rule in the part, so the part has no text of its own.
- **Not in this change:** the Insights panel (part 3), the admin's tabs, date and form filters and the form submissions (S7-T07), any data, action or page.

## Wording to confirm

Plain English in the Design Lab; the connected pages put the same words in `en.json`. From the approved admin-units, builder-units, admin-leads and builder-leads screens: "Units", "Manage the units of any project.", "Manage the units in your projects.", "Add unit", "Project", "Search unit number", the chips "All", "Available", "On hold" and "Sold", the column headings, "Edit", "Delete unit B-302" (as the button's name), "{n} of {total} units", "Units can't be moved to another project.", "No units in this project yet" with "Add units so buyers can see what is available.", the form's labels ("Unit number", "Floor", "BHK", "Area (sq.ft)", "Facing", "Price (₹)", "Status", "Available from", "Floor plan link", "(optional)"), "Cancel", "Save unit", "Enter a unit number.", "Delete unit B-302?" with "This removes the unit from the project. This can't be undone." and "Delete unit"; for leads "Leads", "Leads for your projects.", the column headings, the states "New", "Contacted" and "Closed", "{n} leads" and "You can change a lead's status. Contact details can't be edited."

New, for your confirmation:

- The lead's type is shown as "Enquiry", "Site visit" and "Brochure" with a capital letter (the approved screen shows the stored words "enquiry", "site visit", "brochure" in lower case).
- "Not set" for an empty bedrooms or facing choice, and a dash for any other missing value.
- The bedrooms choice offers 1 to 6 and the facing choice East, North, West and South (the approved screen shows only "2", "3" and the four directions as samples).
- "Available from" is the browser's own date picker (the approved screen has a text box with a calendar icon showing "1 Dec 2026").
- The three error lines in the Lab ("Enter the price in rupees, in numbers.", "Enter a full address, starting with https://"); the connected page takes its messages from the validation words already in `en.json`.
- The admin's empty Leads page ("No leads yet") is not drawn in the approved screens; it is the page's `EmptyState`, with its words, in S7-T07 and S7-T03.

## Consequences

- No migration, package, gate, environment, message or protected-document change. Three parts and three Design Lab entries on the Admin board; its three pictures change again (the entries make it longer) and are added from CI after the owner approves them.
- The drawer and the question open from buttons in the Design Lab and are not part of the pictures (overlays).
- Rollback: delete the three parts, their entries and their tests. Nothing is destroyed.
