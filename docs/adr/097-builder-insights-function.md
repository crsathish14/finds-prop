# ADR-097 · The builder's insights numbers, in the database (S7-T03, step E1)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-080 (the Insights panel), ADR-017 (column grants), BR-31 (a builder sees only their own), FR-BLD-05, FR-BLD-06
- Plan for step E approved by the owner on 9 Nov 2026 ("approved").

## Decision

- **One function, `builder_insights(p_from, p_to, p_project)`, answers every tile** of the builder's Dashboard and Insights pages in one row: the portfolio (projects, active projects, total, available and sold units), the activity (views, unique visitors, shortlists) and the actions (comparisons, brochure downloads, calls, WhatsApp clicks, enquiries, leads, site visit requests).
- **It runs as the caller, not as a definer function.** The row-level policies of `project_events`, `project_leads` and `project_units` still apply. They are not enough on their own, though: the policies of `project_units` let any signed-in person read the units of a live project, and a super admin may read every project. So the function also restricts every count to the projects of the caller's own builder record (`current_builder_id()`), and a project asked for by id that is not theirs counts as no project: all zeros, nothing leaked.
- **Who may call it.** Signed-in users only (no execute for visitors or the public). Anyone who is not an active builder, a super admin included, is refused with `insights.not_allowed` (42501): the admin's overview is a different page and will have its own function (S7-T06).
- **What each number means.**
  - Projects: the builder's projects in any state. Active projects: approved and published.
  - Units: all units of those projects; available and sold by their status. The portfolio numbers do not depend on the dates.
  - Views, shortlists, comparisons, brochure downloads, calls and WhatsApp clicks: the `project_events` of that type in the range. Unique visitors: distinct visitors among the views.
  - Leads: every project lead in the range; enquiries and site visit requests: the leads of those two kinds. (A brochure request is a lead; a brochure download is an event. They are counted apart, as the UX does.)
- **Days are India days.** `p_from` is counted from its first minute in India time and `p_to` to its last minute, both inclusive. A range of more than a year, a missing day or an end before the start is refused with `insights.bad_range` (22023).
- **Types.** `src/types/database.types.ts` gains the function's entry, written by hand in the generated format (no local database to generate it from); CI's database check compares it.
- **Not in this change:** the pages (step E2), any charts (they wait for the chart spike).

## Consequences

- One migration and its pgTAP test (which run in CI): each number against known rows; a project filter; the India day boundary; another builder's project and units left out; a bad range; a customer, a super admin and a visitor refused; no grant to the public; the function runs as the caller. The hosted dev database changes only through the db-deploy workflow, after the owner merges.
- Rollback: drop the function (`drop function public.builder_insights(date, date, uuid)`). Nothing is stored, so nothing is left wrong.
