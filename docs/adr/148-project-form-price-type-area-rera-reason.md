# ADR-148 · The project form: two project types, one price with a price type, area ranges, a possession month and a public RERA reason

- Status: Accepted (the owner asked for each rule on 21 Nov 2026 after testing the builder's new project page; the wording of the labels and of the public text is approved in the plan sent that day)
- Date: 2026-11-22
- Related: ADR-046 (projects), ADR-086 (project editor server), ADR-091 (project form pages), ADR-093 (builder projects pages), BR-48 (RERA fields), FR-ADM-04, FR-BLD-02
- Class: C2 (a schema change, new form controls and new public text that the approved UX does not show)

## Context

The project form let a builder leave out most of what a buyer needs: the project type, property type, status and price were optional, the price was a lowest and a highest price with no word about what the price includes, a plotted layout was a project type of its own with no size, and the possession date was a day. The RERA switch said whether a project is under RERA but not why a project is not.

## Decision

1. **Project type** is residential or commercial. A plotted layout is a residential project whose property type is plot.
2. **Property type** is required. Residential: apartment, villa, plot. Commercial: vacant land, flat, office, co-working space, villa. Stored as `apartment`, `villa`, `plot`, `vacant_land`, `flat`, `office`, `co_working`.
3. **A commercial project is for sale or for rent** (`offer_type`, one choice, required for commercial, empty for residential).
4. **One price, mandatory** (`price`, whole rupees, more than zero) with a **price type** (`price_type`): rate per sq ft, basic price (the property price without registration, GST and other costs) or all inclusive (with them). A project for rent has rent per month or rent per sq ft per month. The lowest and highest price are gone. The price means "starting price" for a project of many homes. A price type is one of the five and a rent type goes only with a project for rent (a database check).
5. **Area range**: a plot and every commercial type give the smallest and the largest area in square feet (`area_min_sqft`, `area_max_sqft`, both or neither, smallest not above largest). Other projects give none.
6. **BHK** is asked only for apartments and villas that are residential. A plot and every commercial project have none.
7. **Status is always required.** **Possession** is a month and a year (stored as the first day of the month): required for a new launch and for a project under construction, none for ready to move.
8. **RERA**: a project under RERA must give its number; one that is not must say why (`rera_not_applicable_reason`, up to 300 characters). The reason is public, like the number, and the form tells the builder so.
9. The "total units" box leaves the form. The column stays, and the page still shows it when it is set.
10. The search of the AI assistant compares only sale totals (basic price and all inclusive) when it filters by price; a project priced per sq ft, or for rent, is left out of such a filter.

## How it is introduced

Production has no projects (owner, 21 Nov 2026), and dev holds fictional and test rows, so rows are converted rather than kept in two shapes. The change goes in four steps so each can be deployed on its own:

- **A (this step, migration only):** adds the columns and constraints that concern only the new columns, widens the property type list, grants the new columns, and converts the rows (plotted layouts become residential plots; a row with no property type gets apartment or office; one price from the old lowest price as a basic price; an area range from the units; possession on the first of the month; a reason for each project without RERA). The old columns and `plotted_layout` stay so the running form keeps working.
- **B:** the form, schema and service read and write the new fields; the service also writes `price_min` and `price_max` from the price so the readers that have not moved still work.
- **C:** pages, lists and AI tools read the new fields.
- **D (closing migration):** the rules that tie the columns together become database checks that hold for every writer and let a missing value through (property type for the project type, sale or rent for a commercial project, bedrooms only for an apartment or villa, the area range for a plot and a commercial project, possession for a project still to be built and none for a ready one, the reason only when RERA does not apply). What is _required_ (the project type, property type, status, price and price type, the RERA number when RERA applies, the reason when it does not) is a trigger, `guard_project_form`, for the people who write through the portal (a builder, the admin), as `guard_projects` already is: the system (migrations, the seed, the service role, the moderation functions) is exempt, so approving a project never fails on a form rule, and an edit that changes none of the form columns is not asked for the whole form again. It is not `not null` because the seed, the pgTAP tests and the integration tests write partial rows as the system, and the only other writers are the portal and the form, which check the same rules first. `plotted_layout` leaves the type list; `price_min`, `price_max` and their range check are dropped (a rollback script is in `supabase/rollbacks`); `admin_project_overview()` returns the price and its type.

Rollback: nothing is dropped before D; converted rows keep their old price columns. After D, fix forward.

## Consequences

- The admin form changes with the builder's, because they are the same form.
- Existing approved projects keep their approval: the conversion runs as the system, and the guard trigger sends a project back to review only for a client's edit.
- A builder's later edit of a converted project is checked against the new rules in step D, so a project converted with a placeholder (a reason that says none was given, a placeholder price on a row that never had one) shows the builder what to fill in.

## Step C: what a visitor and the assistant see

- The project card, the project page and the builder's list write the one price with what it means: "₹8,500 per sq ft", "₹85 L basic price", "₹1.42 Cr all inclusive", "₹45,000 per month", "₹85 per sq ft per month" (`domain.projectCard.priceType.*`). A commercial project carries a "For sale" or "For rent" tag.
- The overview of the page gains the property type and the area range (a plot and every commercial project give one); "Price range" becomes "Starting price".
- The reason RERA does not apply is shown under the title as plain text ("RERA not applicable: {reason}"). The developer wrote it, so it is never drawn as markup and the assistant treats it as untrusted text.
- The assistant's `search_projects` and `get_project` give `priceRupees`, `priceText`, `priceType` and `offerType` in place of a lowest and highest price. A search by the most a customer will pay compares only totals (basic and all inclusive); a project priced per sq ft or for rent never matches it, because the numbers are not comparable.
- The admin's list still reads the old columns through `admin_project_overview()`; it moves in step D with the function.
