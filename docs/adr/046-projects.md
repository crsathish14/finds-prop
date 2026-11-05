# ADR-046 · Projects list and project page (S4-T09)

- Status: Accepted (data layer); the list and the page are added by the next changes
- Date: 2026-11-05
- Related: ADR-043 (the property page, whose pattern this follows), ADR-041 (the homepage's project reads), ADR-017 (public projections), `docs/ux/final-ux/screens/projects.html` and `project.html`, FR-PUB-08, FR-PUB-09, BR-42, BR-94
- Plan approved by the owner on 5 Nov 2026: step A (this data layer), step B (the list at `/projects`), step C (the read-only project page at `/projects/[slug]`). **Step D, the lead form and the events, is a separate task** that needs its own security plan, because it writes data (`submit_project_lead`, `track_project_event`, rate limits, the assigned form).
- The owner's answers: the price trend is drawn as plain SVG with a table view, no locality chips (they are marked "proposed" and DEC-29 says only if approved), no city on the cards and a heading that takes the region name from the site content, the list is read to 60 projects with no paging, no Shortlist button until Save exists, the units table shows the first 20 units, and a floor plan opens its picture full size in a new tab.

## Decision for step A: the data layer (`src/features/projects`)

- **The address** is `/projects/{slug}`. The slug is the project's own (`a-b-c`, lower case letters and digits, 2 to 80 characters, the database's own check) and the database does not let it change after moderation, so unlike a home there is no id in the address. `parseProjectSlug` reads capitals as lower case and gives null, which is "not found", for anything that is not a slug (a space, a slash, a bad escape). `canonicalProjectPath` gives the path to redirect to when the address given differs from the stored slug.
- **Two cached reads, as an anonymous visitor,** so the database's own rules decide what exists: only approved and published projects (BR-42) of active builders (`builders!inner`, BR-94), and only the granted columns. The moderation columns, the form link, the exact location and the street address are never asked for, and a test fails if they are.
  - `getProjects()`: the list, featured first and then newest, up to 60. A failed read is `{ status: "failed" }` after logging the code only; the cached read throws, so a failure is never cached and "Try again" asks the database again. A redirect or prerender signal is let through, not called a failure.
  - `getProject(slug)`: one project with its first 20 units (and the count of all of them), the count of available units, and the latest 12 months of the price trend. No project is `missing`, which covers one never listed, one in review, one not published and one whose builder is not active. Anything else throws and is never cached: a failed read must not look like a project that is gone, and a row that does not fit is a failure, not "not found". Errors are logged by their code only. A unit or a month that does not fit is skipped and counted.
- **Cache:** minutes, under the `projects` tag, so an approval or an edit refreshes it. The homepage's project read keeps its own tag (`home-projects`); the admin actions of Stage 8 will refresh both.
- **Pure rules, no words** (`view.ts`): the facts for "Project overview" in the UX order and only when given (price range, BHK sizes, status, possession date when it is a real day, land area, total units, available units counted from the units that are listed, the RERA number only for a project under RERA that has one), the RERA tag, the BHK sizes without repeats or 0, the price range lowest first, the units in the order of the table (by floor, then unit number read with its numbers as numbers, units with no floor last), the units footer ("Showing N of M"), the price trend oldest month first, and the videos a page may link to (https only, no sign-in details in the address, each once, at most five).
- **The card's data** (`toProjectCard`): the cover comes from the public project bucket, described by the project's name since the developer gives no description. A project has no city of its own, so the card is given none; the list step makes the card draw the locality alone.
- `PROJECT_BUCKET` moved to `src/lib/storage-url.ts` beside `publicStorageUrl`; the homepage still exports it.

## Consequences

- The list and the page add no query of their own.
- Not tried against real projects: the hosted dev database needs secrets, so the reads are tested with a stub client.
