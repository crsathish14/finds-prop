# ADR-168 · The super admin adds plain text boxes to the builder's project form

- Status: Accepted (owner change request "Plan 8", 22 Nov 2026; autonomy rule of the same day)
- Date: 2026-11-23
- Related: ADR-152 (same storage pattern), ADR-148 and ADR-160 (the project form), FR-ADM-03, FR-ADM-10, BR-41, BR-81
- Class: C2 for the first PR (a new key in the existing `site_settings` store, no migration); the second PR adds a migration

## Decision

- **What:** the super admin can add up to **10** extra plain text boxes ("project form boxes") to the builder's and admin's project form without a developer. Version 1 has text boxes only: no dropdowns, no conditions between boxes.
- **Definition of a box:** an id (made once, never changes), a label (1 to 60 characters), optional help text (up to 200), a "builders must fill it in" switch, the property types it is asked for (none ticked means every type) and an on/off switch. The order of the list is the order on the form.
- **Where the definitions live:** one more key of `site_settings`, `project_fields`, with value `{ fields: [...] }`. Same table, same policies and same audit trigger as ADR-152 (the super admin writes, the audit records that it changed and by whom, never the content), the same `admin_edit` limit and the same cache tag. A stored row that does not fit the shape is ignored (BR-81).
- **Where the super admin edits them:** a new admin page **Project form boxes** (`/admin/project-fields`), in the Inventory group of the sidebar.
- **Hard cap:** ten boxes, on or off, held by the save and by the shape the site reads.
- **Plot status and villa type (ADR-160) stay hard-coded.** They are dropdowns, they drive database checks and a guard, and v1 here is text only.
- **Answers (second PR):** a new column `projects.extra_fields jsonb` holding `{ "<box id>": "text" }` (up to 500 characters each). It is part of the project row, so a builder's edit sends the project back to review (BR-41), the existing audit and column grants apply, and the admin queue and the project page read it with the project.
- **When a box is turned off:** it disappears from every form and page, its answers stay stored, and turning it on again shows them. **When a box is deleted:** it disappears everywhere; answers stay in the project row but nothing reads them (they are dropped the next time that project is saved).
- **Required:** a required box is asked on the form for the property types it applies to; it is enforced by the save, not by the database, because the list of boxes changes after projects exist. Existing projects are not touched until their builder next edits them.

## Consequences

- All words of the editor screen are unapproved until the owner reviews them.
- Because the shape is read by the whole site, every setting read now also returns `project_fields` (an empty list by default).
