# ADR-078 · The lists the admin and the builder share: the table, the drawer and the Projects page (S7-T01, part 1)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-076 (the builder parts), ADR-020 (Design Lab), ADR-035 (message keys), FR-ADM-03, FR-BLD-02, `docs/engineering/design-system.md` (ResponsiveTable)
- Plan approved by the owner on 8 Nov 2026 ("as recommended"): the shared parts are built in the Design Lab first, in three changes; charts wait for the chart spike (S7-SPK-01, with S7-T06); the form submissions tab and the CRM retry drawer belong to S7-T07; the status select works for the admin as well as the builder.

## Decision

- **Three new parts.** `ResponsiveTable` (a pattern: one definition of the columns and rows draws a table from 1024 px of room and cards below that), `ManagerDrawer` (a pattern: the side drawer for adding and editing a row, with Cancel and the main button fixed in the footer and tied to the page's form by `formId`) and `ProjectsManager` (a domain part: the whole Projects page above its data, with a `mode` of `admin` or `builder`). They hold no state and take their words as props, like `ListingQueue` and `BuilderTable`.
- **`BuilderTable` and `ListingQueue` are left as they are.** Their approved pictures do not change; they may move onto `ResponsiveTable` later if the owner wants one table everywhere.
- **The row's decisions are data, not markup.** A row carries its visible buttons (`label`, `forName`, `tone`, `icon`, `onClick` or `href`, `pending`) and its menu (`label`, `icon`, `destructive`, `disabled`, `onSelect` or `href`). The page decides which buttons a project gets from its state; the part draws them. A disabled "Delete" says why in its own label ("Delete (has 128 leads)").
- **Rejecting and deleting ask in a `ConfirmDialog` that the page owns.** Only the page knows the project. The Design Lab shows the reject question next to the manager.
- **A new status kind `project`** (Draft grey, Pending amber, Approved green, Rejected red) in the status map, with its four words in `status.project.*`, so a project's state keeps one colour everywhere (R-DS-09). "Published", "Unpublished" and "Featured" are badges beside it, as in the approved screen.
- **The picture of a project** is its cover when it has one and the drawn tile when it does not (`CardCover`, as in the listing queue).
- **Not in this change:** the Units and Leads parts (part 2), the Insights panel (part 3), any data, action or page. The pages that use these parts are S7-T04 (admin projects), S7-T07 (admin units and leads) and S7-T03 (builder portal).

## Wording to confirm

Plain English in the Design Lab; the connected pages put the same words in `en.json`. All of it is from the approved admin-projects and builder-projects screens: "Projects", "Review, moderate and manage every builder project.", "Your projects. Saving an edit sends the project for approval.", "Add project", the tabs "All", "Pending", "Approved", "Rejected" and "Draft", "Search projects", "All builders", the column headings, "Approve", "Reject", "Publish", "Unpublish", "Edit project", "Feature", "Remove from featured", "View live page", "View live", "Edit", "Delete (has N leads)", "This project can't be deleted" with its line, "Reject Nila Grove?" with its line, "No projects yet" with both of its lines. One rule is marked "Confirm this rule" in the approved screen (decision P5) and is built as written:

- **"Edits go back for approval"**: "When you save a change, the project is set to Pending and is hidden from the public site until it is approved again." Shown only to a builder.

New, for your confirmation: the drawer line "Add a unit so buyers can see what is available." (the approved screen has the title "Add unit" and, for an empty project, "Add units so buyers can see what is available.").

## Consequences

- No migration, package, gate, environment or protected-document change. Three parts, a status kind with four words, and three Design Lab entries on the Admin board; the board's three pictures change (the entries make it longer) and are added from CI after the owner approves them.
- The drawer and the menus open from buttons in the Design Lab and are not part of the pictures (overlays), as with the other dialogs and drawers.
- Rollback: delete the three parts, their entries, their tests and the `project` status kind. Nothing is destroyed.
