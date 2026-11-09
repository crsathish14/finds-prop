# ADR-101 · The admin's Projects page (S7-T04, part B)

- Status: Accepted (the wording below awaits the owner's confirmation)
- Date: 2026-11-09
- Related: ADR-100 (the decisions and the list), ADR-078 (`ProjectsManager`), ADR-091 (the project form pages), ADR-093 (the builder's Projects page), FR-ADM-03, BR-44
- Plan for S7-T04 approved by the owner on 9 Nov 2026 ("approved").

## Decision

- **The admin's screen is the shared manager in admin mode.** `/admin/projects` shows `ProjectsManager` (mode `admin`, from `admin-projects` in the UX): the heading and Add project, the status tabs with their numbers (the Pending number marked as new while any project waits), a search, a filter by builder, the table with the builder's name, and the one thing each state needs: **Approve and Reject** on Pending, **Approve** on Rejected, **Publish** or **Unpublish** on Approved. The More menu has Edit project (to the form), **Feature** or **Remove from featured** (approved projects only), **View live page** (live projects only) and **Delete**. There are no drafts in v1 (every new project starts pending), so the Draft tab says 0; it is kept as the screen draws it.
- **Reject and Delete ask first,** with the approved dialogs ("Reject {name}?", "Delete {name}?"). The other decisions happen at once, and say so in a toast.
- **Delete is not offered for a project with leads.** The menu item reads "Delete (has N leads)" and is disabled (BR-44). If leads arrive after the page was read and the database refuses the delete, the page says the project has changed, reads itself again and then shows the "This project can't be deleted" notice with the new number of leads.
- **The list is filtered in the browser.** The page reads up to 500 projects (`admin_project_overview()`, ADR-100) and filters them by status, builder and a search of the name, the place and the builder's name, as the builder's page does. When the list was cut at 500, a notice says so. If the platform outgrows this, the list can be paged later.
- **After a change the page is read again,** so it shows what the server holds; a conflict (another admin decided first) or a project that is gone is said in one sentence and the page is refreshed.
- **Words in `admin.projects`.** The covers use the shared storage address helper, so the page does not reach into another feature.

## Wording to confirm

From the approved `admin-projects` screen (nothing to confirm): "Projects" with "Review, moderate and manage every builder project.", Add project, the tab names, "Search projects", the Builder filter and "All builders", the column names, Approve, Reject, Publish, Unpublish, Published, Unpublished, Featured, Edit project, Feature, Remove from featured, View live page, "Delete (has N leads)", "Reject {name}?" with its line and Reject project, "Delete {name}?" with its line and Delete project, "This project can't be deleted" with "It has N leads. Unpublish it instead to take it off the public site.", "No projects yet" with "Projects created by builders will appear here for review." New, for your confirmation:

- **The toasts:** "{name} approved", "{name} rejected", "{name} published", "{name} unpublished", "{name} featured", "{name} removed from featured", "{name} deleted".
- **The refreshed-page sentence:** "This project has changed since the page was loaded. The page has been refreshed." (the same shape as the units and builders pages).
- **The cut-list notice:** "Showing the newest 500 projects. Older ones are not listed here."
- **No match:** "No projects match" with "Try another status, builder or search." (the builder's page has the same title).
- **Accessible names:** "More actions for {name}" (from the screen's own label), "Cover picture of {name}", and "Cancel" on the dialogs.

## Consequences

- One page, one component and its words, and a component test (the tabs and numbers, each state's buttons, approve, reject with its question, publish, unpublish, a refused decision, the menu for each kind of project, delete with its question and its refusal, the filters, the cut-list notice and the empty page). No migration, package, environment, CI or protected-file change; it needs the functions and actions from ADR-100.
- Rollback: restore the placeholder page and remove the component and its words. Nothing is stored.
