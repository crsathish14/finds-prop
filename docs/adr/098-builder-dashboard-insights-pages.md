# ADR-098 · The builder portal: the Dashboard and Insights pages (S7-T03, step E2)

- Status: Accepted (the wording below awaits the owner's confirmation)
- Date: 2026-11-09
- Related: ADR-080 (the Insights panel), ADR-097 (`builder_insights`), BR-31, FR-BLD-05, FR-BLD-06
- Plan for step E approved by the owner on 9 Nov 2026 ("approved").

## Decision

- **Two pages, one component.** `/builder/dashboard` shows the Insights panel with three groups (Portfolio, Activity, Actions) and no project box; `/builder/insights` shows two (Activity, Actions) and the project box. Both read the numbers with `builder_insights()` as the signed-in builder (ADR-097), so only their own projects are counted. No charts: they wait for the chart spike (S7-SPK-01).
- **The choices are in the address.** `?range=7|month|custom` (30 days is the default and is left out), `&from=&to=` for a custom range (two days as `YYYY-MM-DD`), and on the Insights page `?project=`. A choice reads the page again. A range that is not understood, a custom range with a day that does not exist, an end before the start or more than a year, is the last 30 days, so a mistyped address still shows the page. A project that is not the builder's is all projects. Choosing Custom starts from the days already shown. A date box emptied while typing is ignored until a day is typed.
- **Days are India days,** the same days the database counts: "7 days" and "30 days" end today and count today as one; "This month" runs from the 1st to today.
- **The notice** above the numbers (on both pages) comes from the builder's own project list: the projects whose state is Pending. It is not shown when none waits.
- **A builder with no project** sees the tiles with zeros rather than an empty page; the Portfolio says 0 projects.
- **Numbers** are written the Indian way (6,420; 1,28,456 for larger ones) by the browser's number format for the page's locale.
- **A wrong answer is a failed read.** The row from the database is checked (every count whole and not negative); anything else throws, so the portal's error page shows it instead of a page of zeros.

## Wording to confirm

From the approved screens and ADR-080 (nothing to confirm): "Dashboard" and "Insights" with their lines, "7 days", "30 days", "This month", "Custom", "From", "To", "Date range", "Project", "All projects", "Portfolio", "Activity this month", "Activity", "Actions", every tile name, "Approved and published", "{count} sold", "1 project is waiting for approval" and "{name} was edited and is hidden from the public site until it is approved." New, for your confirmation:

- **"{count} projects are waiting for approval"** (the plural of the approved title) and **"They are hidden from the public site until they are approved."** when more than one project waits. The approved line names the project, which only works for one.
- **The Dashboard's second group** is "Activity this month" only when This month is chosen, and "Activity" (the Insights page's name for it) for the other choices, so the label never says "this month" over 7 or 30 days.

## Consequences

- Two pages, one feature (`builder-insights`: the date arithmetic, the read, the component) and their tests (unit tests of the dates, the row and the read; a component test of both pages' groups, notice, date choice and project box). No migration, package, environment, CI or protected-file change; it needs the function from ADR-097.
- Rollback: restore the two placeholder pages and remove the feature. Nothing is stored.
