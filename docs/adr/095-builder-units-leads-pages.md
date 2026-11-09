# ADR-095 · The builder portal: the Units and Leads pages (S7-T03, step C2)

- Status: Accepted (the wording below awaits the owner's confirmation)
- Date: 2026-11-09
- Related: ADR-094 (the builder's actions), ADR-081 and ADR-082 (the admin's Units and Leads pages), FR-BLD-03, FR-BLD-04, BR-31, BR-47
- Plan for S7-T03 approved by the owner on 9 Nov 2026 ("T03 approved").

## Decision

- **The admin's screens, scoped to the builder.** The UX files `builder-units` and `builder-leads` say "same component as admin, scoped to the builder" and "same table as admin, own project leads only; the builder can change status but not contact details". So `/builder/units` shows the admin's `UnitsBoard` and `/builder/leads` shows the admin's project-leads table, with the builder's own actions from ADR-094 (`addMyUnit`, `updateMyUnit`, `deleteMyUnit`, `loadMoreMyUnits`, `setMyLeadStatus`, `loadMoreMyLeads`). The pages read as the signed-in builder, so the database decides whose rows come back.
- **`UnitsBoard` takes two optional settings, `path` and `intro`.** `path` keeps its links (the project choice, the state chips, the search) under `/builder/units` instead of `/admin/units`; `unitsHref` takes the path as a second argument. `intro` is the line under the heading. Both default to the admin's, so the admin's page does not change.
- **Units page:** the picker is the builder's own projects (`getMyProjectOptions`); a project in the address that is not theirs shows their first project; a builder with no project sees the same "No projects yet" page as the admin's.
- **Leads page:** the admin's page without the tabs, since a builder has no form submissions (`BuilderLeadsBoard`: heading, line, and the existing project-leads table). The table is the admin's, so a builder sees the same columns, including the lead's name, phone and message, and can change only the state (BR-47).
- **Wording, new, awaiting the owner:** `builderPortal.units.metaTitle` "Units" and `builderPortal.leads.metaTitle` "Leads" (the page titles and the leads heading); `builderPortal.units.intro` "Manage the units of your projects." (the admin's reads "of any project"); `builderPortal.leads.intro` "People who enquired about your projects. You can change a lead's state." Everything else (labels, drawer, toasts, empty pages) is the admin's existing wording.

## Consequences

- Two pages, one small component, two optional settings and their tests; no migration, package, environment, CI or protected-file change.
- Rollback: restore the two placeholder pages, remove `BuilderLeadsBoard` and the `path` and `intro` settings.
