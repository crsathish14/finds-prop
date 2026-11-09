# ADR-084 · The connected admin Units page (S7-T07, part C1)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-079 (the Units parts), ADR-078 (the drawer), ADR-081 (the server side), ADR-076 and ADR-077 (the same pattern for builders), FR-ADM-05
- Plan approved by the owner on 8 Nov 2026 ("all approved"). The connected pages are split in two changes (units here, leads next) so each is small enough to read.

## Decision

- **`/admin/units` stops being a placeholder.** The server page reads the projects and one page of that project's units as the signed-in admin and hands them to `UnitsBoard`, a client component that composes the parts of ADR-079 (`UnitsManager`, `UnitForm`) with the `ManagerDrawer` of ADR-078, a `ConfirmDialog` and the four actions of ADR-081. The role gate in the portal layout has already sent anyone else away.
- **The choices are in the address** (R-FE-11): `?project=`, `?state=` and `?search=`. A project that is not one of ours, or none, shows the first project; a state or search that is not valid is dropped. Picking a project goes to that project's page with all states; a state chip keeps the project and the search. The search is applied 350 ms after the last key (`router.replace`, so the back button does not fill with half-typed searches). The default state is left out of the address. The page cursor is never in it.
- **Show more adds the next units in place** with a button, and a page read again (after a change or for other choices) starts the list over from its first units, so what is shown is never older than what the server holds. The count ("6 of 320 units") is the number the filters match in all, from the server.
- **After each change the page is read again** (`router.refresh()`), as on the Builders page. A refusal that names a box (a repeated unit number) goes on that box and the drawer stays open; a unit that is gone or changed (not found, conflict) is said in one sentence and the page is read again; any other failure is said in the closed set of action-error words.
- **The form offers bedrooms 0 to 10** (the database's range) and the eight directions; a direction the database holds that the list does not know opens as "Not set". The floor plan box takes an https link, which is stored in `floor_plan_path` (ADR-081).
- **A "Blocked" chip** is added to the approved chips (All, Available, On hold, Sold), because a unit can be blocked and the admin should be able to list them.
- **No Design Lab change and no pictures:** every part of the page is already in the Lab (ADR-078, ADR-079). Behaviour is checked by tests with stand-in actions.

## Wording to confirm

The words go into `en.json` under `admin.units`. From the approved admin-units screen: "Units", "Manage the units of any project.", "Add unit", "Project", "Search unit number", the chips "All", "Available", "On hold" and "Sold", the column headings, "Edit", "{shown} of {total} units", "Units can't be moved to another project.", "No units in this project yet" with "Add units so buyers can see what is available.", the drawer's labels, "Cancel", "Save unit", "Delete unit B-302?" with "This removes the unit from the project. This can't be undone." and "Delete unit". New, for your confirmation:

- The "Blocked" chip.
- The drawer titles "Add unit" and "Edit unit", its lines "Add a unit so buyers can see what is available." (already in ADR-079) and "Change the details of this unit."
- The toasts: "Unit added" with "{number} is now in the project.", "Unit saved" with "The details of {number} have been updated.", "Unit deleted" with "{number} has been removed from the project."
- "This unit has changed since the page was loaded. The page has been refreshed." (a unit that is gone or changed).
- "Show more units" and "More units could not be loaded. Please try again."
- When there are no projects at all: "No projects yet" with "Add a project first, then add its units here."
- The accessible names "Edit unit {number}" (a visible "Edit" and hidden text), "Delete unit {number}", "Search units" and "Filter by state".

## Consequences

- No migration, package, gate or environment change. A page, a client board, three small helpers (the address, the form's boxes and values) and the words.
- Rollback: restore the placeholder page and delete the board, helpers, words and tests. Units already written stay as they are.
