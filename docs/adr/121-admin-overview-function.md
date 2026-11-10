# ADR-121 · The admin's Overview numbers, in the database (S7-T06 part 2)

- Status: Accepted (the choices marked "to confirm" were approved by the owner as written; the wording is for the page, in part 3)
- Date: 2026-11-10
- Related: ADR-097 (the builder's numbers, the same way), ADR-120 (the chart parts), ADR-017 (column grants), BR-63 (a project form mirrors into the project's leads), FR-ADM-01
- Plan for S7-T06 and for this part approved by the owner on 10 Nov 2026 ("approved").

## Decision

- **One function, `admin_overview(p_from, p_to)`, answers every tile and chart** of the admin's Overview page and returns one JSON object. A single object (not a table of columns) is used because the page needs lists as well as numbers (a count for each day, the top projects, the newest leads); the page checks its shape with Zod before it draws anything.
- **It runs as the caller, not as a definer function,** like `builder_insights` (ADR-097): the row-level policies still apply. They are not enough on their own, because the policies of `properties`, `project_events` and others also let other people read part of the same tables, so the function refuses anyone who is not the super admin with `overview.not_allowed` (42501). No execute for visitors or the public.
- **Days are India days,** counted from the first minute of `p_from` to the last minute of `p_to`, both inclusive. A missing day, an end before the start or a range of more than a year is refused with `overview.bad_range` (22023).
- **What it returns.** The numbers that follow the dates are marked; the others do not.
  - `listings` (as of now): `total` (every listing that was submitted: a draft is not counted), `approved`, `pending`.
  - `people` (as of now): `customers`, `agents`, `builders`, by the role a person holds (`user_roles`).
  - `leads` (follow the dates): `leads`, `enquiries`, `shortlists`, `visitors`.
  - `new_today`: leads since the start of today in India, whatever the dates.
  - `sources` (follow the dates): `project_pages`, `property_enquiries`, `other_forms`; they add up to `leads`.
  - `daily` (follows the dates): one entry for each day, in order, `{ day, leads, enquiries, shortlists }`, with a zero for a quiet day.
  - `top_projects` (follows the dates): up to six `{ id, slug, name, enquiries }`, the most enquiries first (a project with none is not listed).
  - `recent` (does not follow the dates): the newest five `{ id, source, kind, name, label, created_at }`: `source` is `project` (a project lead: `kind` is its kind and `label` the project's name) or `form` (a form with no project: `kind` is null and `label` the form's name).
- **What counts as what (the owner's defaults).**
  - A **lead** is a project lead, a property enquiry, or a form submission that belongs to no project. A form on a project page is mirrored into the project's leads (BR-63), so counting its submission too would count it twice; it is left out.
  - An **enquiry** is a project lead of kind enquiry or a property enquiry (a site visit or a brochure request is a lead but not an enquiry).
  - A **shortlist** is a shortlist event on a project or a property saved by someone.
  - **Visitors** are distinct visitors among the views of project pages (a visitor counted once however many times they viewed); the page divides leads by visitors for the conversion tile, so both numbers are returned and a range with no visitors shows a dash, not a division by zero.
- **Choices that were not in the owner's defaults (to confirm, approved as written on 10 Nov):** "Total properties" leaves drafts out; "Shortlisted" adds the saved properties to the project shortlist events; people are counted by role; the newest leads are the newest overall, not the newest in the range ("No leads yet" then means none at all); property enquiries are left out of the newest leads (the owner's default lists project leads and forms only).
- **Types.** `src/types/database.types.ts` gains the function's entry, written by hand in the generated format (no local database to generate it from); CI's database check compares it. The return type is `Json`.
- **Not in this change:** the page, its date presets, and the words (part 3).

## Consequences

- One migration and its pgTAP test (they run in CI; there is no local database): the stock compared with the tables; every number against known rows (the October 2026 fixtures are the only rows in that range); the stock does not follow the dates; one entry for each day, a quiet day as zero; the India day boundary (23:30 on 31 Oct and 00:30 on 1 Nov); a project form and its mirrored lead counted once; the top projects (a brochure request is not an enquiry); new leads today as a change; the newest leads and their order; a bad range; a customer, an agent, a builder and a visitor refused; no grant to the public; the function runs as the caller and changes nothing. The hosted dev database changes only through the db-deploy workflow, after the owner merges.
- The function reads the whole `properties` and `user_roles` tables for the stock and a date window of the others. The indexes of those tables are by project or property first, then date, so a window across all projects scans; at this size that is fast and no index is added. If a count ever gets slow, an index on the date or a summary table is the next step, not a different function.
- Rollback: drop the function (`drop function public.admin_overview(date, date)`). Nothing is stored, so nothing is left wrong.
