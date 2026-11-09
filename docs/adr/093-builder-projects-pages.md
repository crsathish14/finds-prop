# ADR-093 · The builder portal: the projects pages (S7-T03, step B)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-092 (the frame), ADR-091 (the project form's pages), ADR-086 (the server side), ADR-078 (the projects list), BR-41, FR-BLD-02
- Plan for S7-T03 approved by the owner on 9 Nov 2026 ("T03 approved"): step B is the builder's projects list and the new and edit pages.

## Decision

- **Three pages.** `/builder/projects` (the list), `/builder/projects/new` and `/builder/projects/[id]` stop being placeholders. The new and edit pages are the project form of ADR-091 in the builder's mode (`scope="builder"`): the approval warning on top, no Builder, Enquiry form or Price trends box, the page address locked once the project is approved, and the builder's own save actions (`createMyProject`, `updateMyProject`), so the database's rules and the rate limit of ADR-086 apply as they are.
- **A builder's own list is read through `my_projects()`,** which returns only the projects of the builder (or agent) asking, whatever their state. A new read, `getMyProjectList`, takes only the columns the list shows (name, address, place, price range, first image, state, published, featured), newest first. The edit page opens a project with the existing `getProjectForEdit("builder", id)`; another builder's project looks the same as one that does not exist, so it is "not found".
- **The list is the shared `ProjectsManager` in builder mode** (ADR-078): the status tabs with their counts (All, Pending, Approved, Rejected, Draft), a search of the name and the place, the table that becomes cards, and the warning that an edit goes back for approval. The tabs and the search work in the browser on the list it was given (a builder's own list is small); a filter that hides every project says "No projects match", not "No projects yet".
- **Buttons.** Every row has Edit (to its page) and, for a project that is approved and published, View live (to its public page). A builder cannot approve, reject, publish, feature or delete (the database refuses it too), so none of those is offered and there is no row menu. A state the page does not know is shown as Pending.
- **Words about "sent for approval".** A builder's save of a project says it is back in review (ADR-091). A builder's new project says "<name> is waiting for approval. You can now add its images, floor plans and brochure." (the admin's version also names the price trends, which a builder cannot edit).
- **Not in this change:** units, leads, the profile, the dashboard and insights (steps C to E), a Draft state a builder can set (the database makes every new project pending), and deleting a project.

## Wording to confirm

- "Your projects. Saving an edit sends the project for approval.", "Add project", "Filter by status", "Search projects", the column names, "Edits go back for approval" with "When you save a change, the project is set to Pending and is hidden from the public site until it is approved again.", "No projects yet" with "Add your first project. It is reviewed before it goes live.", "Published", "Unpublished", "Featured", "Edit", "View live": all the approved builder-projects screen's own words.
- Not in the UX file: "Not set" (a project with no price), "No projects match" with "Try another status or search.", and the builder's creation line above.

## Consequences

- One read, a list board, three pages and their words and tests; no database, package, gate or environment change. One integration test case (a builder lists only their own projects) runs only in CI.
- A builder reaches the project form from the sidebar's Projects link; the admin's side (list and approvals) is S7-T04.
- Rollback: restore the three placeholder pages and delete `getMyProjectList`, the list board, the `builderPortal.projects` words and the builder creation line.
