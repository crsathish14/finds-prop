# ADR-214 · A residential project may be for rent, with a security deposit and maintenance

- Status: Accepted. Owner decision in chat on 27 Nov 2026 (`ai-chat-next-plan.md`, piece 6), approved for build the same day; the form and page layout and the words of its hints and error were approved by the owner on 27 Nov 2026.
- Date: 2026-11-27
- Amends: ADR-148 (the project form: "a commercial project is for sale or rent, a residential one is not")
- Related: ADR-160 (plot and villa boxes), ADR-208 (Prime amounts per price type)
- Class: C2 (migration `20261128090000_residential_project_rent.sql`). No dependency.

## Context

Builders and agents also let residential projects (a block of flats, a row of villas) on rent. ADR-148 allowed rent only for a commercial project, so a residential project for rent could not be listed.

## Decision

1. **Sale or rent for every project, never both.** The "This project is for" box shows for residential projects too. A residential project left empty is for sale, as every residential project already is: it is stored with no choice (`offer_type` null), and a residential project for rent is stored as `rent`. A commercial project must still choose.
2. **Rent per month only** for a residential project for rent: its only price type is `rent_per_month` (a commercial one keeps rent per sq ft per month too).
3. **Two optional amounts, a project for rent only:** "Security deposit" and "Maintenance per month" (owner-approved words), whole rupees above zero (`security_deposit`, `maintenance_per_month`, both `bigint`). A project for sale has neither; the service clears them and the database refuses them.
4. **The project page** shows "Deposit {amount}" and "Maintenance {amount} per month" (owner-approved words) on the line under the price, only when given. The assistant's `get_project` gives the same two lines as text.
5. **Database rules:** `projects_offer_type_commercial` becomes `projects_offer_type_fits` (a commercial project still says sale or rent); `projects_residential_rent_per_month`; `projects_security_deposit_positive`, `projects_maintenance_positive`, `projects_rent_amounts_for_rent`. The form guard treats the two amounts as form columns. `public_project()` returns the two amounts. Read grants for signed-in visitors only (the login wall, ADR-171), builder and admin write grants.

## Consequences

- No existing row changes. Residential cards and pages look as they did unless a builder picks rent.
- The production database change is applied by the release workflow when `develop` is released to `main`, after the owner approves the `production` step (ADR-201); nobody runs it by hand (rollback script `supabase/rollbacks/20261128090000.sql`, which refuses while a residential project is for rent).
- The assistant's rent search reads projects for rent in piece 2 of the same plan.

## Tests

pgTAP `projects_residential_rent.test.sql` (DB-CON-projects-residential-rent, DB-FN-public-project-rent), the changed case in `projects.test.sql`, the public columns in `public_projections.test.sql`; unit tests `UT-project-form-*`, `UT-project-schemas`, `UT-project-service`, the project form, the project page and `UT-ai-tool-project`.
