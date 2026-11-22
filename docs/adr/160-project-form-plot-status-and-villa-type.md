# ADR-160 · The project form asks a plot its status and a villa its type

- Status: Accepted (owner's change request, 22 Nov 2026; plan defaults used, filters left for the owner)
- Date: 2026-11-23
- Related: ADR-148 (the project form's price, area and RERA reason), ADR-086 (project editor server)
- Class: C2 (new boxes on an approved form, new public wording)

## Decision

- **Two new boxes on the add/edit project form** (builder new, builder edit, admin new, admin edit; one shared `ProjectFields`):
  - **Plot status**, shown when the property type is **Plot** (residential): **Investment** or **Ready to build**.
  - **Villa type**, shown when the property type is **Villa** (residential or commercial): **Duplex**, **Row house** or **Individual**.
    Both are required once shown. They sit with the other kind-of-project boxes in the Basics section.
- **Stored as two nullable text columns on `projects`**: `plot_status` (`investment`, `ready_to_build`) and `villa_type` (`duplex`, `row_house`, `individual`). Check constraints keep each to its property type (`plot_status` only on a plot, `villa_type` only on a villa) and let a missing value through, like the other kind-dependent columns of ADR-148. Public (column grants like `offer_type`); written by the builder and the admin.
- **Required for portal writers by the form guard**, not by `NOT NULL`: `guard_project_form()` raises `projects.plot_status_required` / `projects.villa_type_required` when a builder or the admin saves the form's boxes for a plot or villa without them. The system (seed, service role, moderation functions) is exempt. An edit that changes none of the form's columns is not asked.
- **Server rules**: the zod schema requires the box when it applies and ignores it otherwise; `projectRowFrom` writes `null` for a box that does not apply (changing a plot to an apartment clears the plot status), and the form's `reconcile` clears it before sending.
- **Existing projects**: nothing is rewritten. A plot or villa that is already saved keeps a blank value and shows nothing on its page until its builder or the admin edits it, which then asks for the choice (the edit and resubmit flow is the existing one: a builder's edit goes back to review, BR-41).
- **Shown on the project page** as two more rows of "Project overview", right after "Property type": **Plot status** and **Villa type**. Left out when the value is blank.
- **Not built (decision for the owner)**: filters on /properties for plot status and villa type, the project card line, and the assistant's project facts. Add them when the owner wants them.
- **Plan 8 (editable form fields)**: these two stay hard-coded. They are dropdowns with fixed choices that the page, the filters and the checks understand; Plan 8's v1 is text boxes only.

## Wording (draft, awaiting the owner)

Form labels "Plot status" and "Villa type"; options "Investment", "Ready to build", "Duplex", "Row house", "Individual"; problem lines "Choose the plot status." and "Choose the villa type."; overview rows "Plot status" and "Villa type".
