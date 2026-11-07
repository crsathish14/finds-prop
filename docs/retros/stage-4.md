# Stage 4 retrospective: public discovery

Written on 7 Nov 2026, after Stage 4 and Stage 5 were both built. Stage 4 ran from 3 to 6 Nov 2026 (pull requests #59 to #93). The reasons for each decision are in the ADRs named below; this page says what was built, what was left out, what cost time and what to carry forward. The status table in `docs/status.md` points here.

## What was built

| Task   | What a visitor gets                                                                                                         | Pull requests               | ADR      |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------- |
| S4-T06 | Site header with the account menu and Sign out, footer, phone bottom bar, error pages, and the homepage with seven sections | #59 to #61, #63, #68 to #73 | 040, 041 |
| S4-T01 | The cards (home, project, developer, locality), search card, filter rail and sheet, gallery, price card, enquiry card       | #64 to #67, #74, #75        | 039      |
| S4-T04 | The results page `/properties`: address contract, bar and chips, filters, Show more, no-match and failed-load states        | #76 to #78                  | 042      |
| S4-T03 | The property page `/properties/[slug]`: gallery, details, price card, enquiry gate, loading and not-found                   | #79, #80                    | 043      |
| S4-T02 | Compare (up to three homes, kept in the browser) and the Design Lab **Discovery** board                                     | #81                         | 044      |
| S4-T07 | Sponsored banners: strip, Split hero panel, one banner after the sixth result                                               | #81                         | 045      |
| S4-T09 | Projects list `/projects`, project page, lead backend and enquiry card with view tracking                                   | #82 to #85, #88, #89        | 046      |
| S4-T10 | Titles, descriptions, canonical addresses, Open Graph, `robots.txt`, `sitemap.xml`, JSON-LD                                 | #86                         | 047      |
| S4-T13 | Tests that list exactly what a visitor's database role can read                                                             | #90                         | 017      |
| S4-T11 | Every cache tag named in one file, with the helpers later stages call                                                       | #91                         | 048      |
| S4-T12 | Performance baseline and the LCP investigation (measure only, nothing enforced)                                             | #92, #93                    | none     |

Pull request #87 was closed and redone as #88 (see "What cost time").

## Left out or not started, on purpose

- **S4-T05 place search**: the owner left it out. The search card works from the filters and the address only.
- **S4-T14 map view**: it waits on a UX design that does not exist (ADR-012 keeps `map_properties()` for it).
- **Call, WhatsApp, brochure and shortlist events**: out of phase one. The project page has the three as plain links.
- **Lighthouse CI and performance budgets**: proposed in `docs/runbooks/performance-baseline.md`, not set.

## What went well

- **Small pull requests with a plan first.** Every task had an approved plan and landed as two to four changes. Review stayed on one idea at a time, and the data layer (a typed read and the rules for what is shown) was always merged before the page that uses it.
- **The Design Lab caught visual changes.** A picture baseline changes only when the owner approves the pictures, and baselines come only from the CI runner (Linux). The cycle (first run fails only the pictures, owner approves, baselines committed in their own commit) became routine.
- **Public data is tested as a visitor.** S4-T13 turned "visitors read only the public columns" into three tests (database, integration, unit). It already caught one thing within days: a new database function for visitors had to be added to the allowed list on purpose (#101).
- **Cache tags in one file** (ADR-048) with a test that fails when a cached read uses a tag nobody refreshes. Stages 6 to 8 only have to call the helpers.
- **Measuring before fixing.** The LCP investigation showed the 4.3 to 4.7 s figure was Lighthouse's estimate, not what a browser measured (2.2 to 2.5 s), so no code was changed for the wrong reason.

## What cost time

- **A test fixture that looked like a secret (#87).** gitleaks scans the whole branch history, so a fix commit does not clear a flagged value. The way out was a clean branch with one corrected commit, a new pull request and closing the old one. Use low-entropy fakes such as `00000000-0000-4000-8000-000000000001`.
- **Node 26 in the shell, Node 24 in the repo.** Under Node 26, `next start` fails its database reads after about seven seconds, so pages showed failed-load states and the first LCP runs were void. Build, serve and measure under Node 24.
- **A hydration error that only CI showed.** A page reached through the language rewrite can see a different pathname on the server and in the first browser render. Anything that depends on the pathname uses `useClientPathname`; the error reproduces locally only with CI's placeholder values in the build.
- **A function allow-list in a database test.** The test that lists the functions visitors may run failed when `public_project_form` was added (#101). That is the test working; the list and the reason are now updated together.
- **Local servers that outlive their stop.** Stopping `next start -p 3100` can leave the child process listening, and Playwright then reuses the stale server after a rebuild. Check the port after every stop.
- **No Docker on the owner's machine.** Database tests, integration tests and seed tests run only in CI, so a database mistake shows up one round later. Every pull request says so.

## Measured, and not yet fixed

- **About 1 MB of script (320 KB gzip) on every public page**, reported in `docs/runbooks/performance-baseline.md`. Worth trimming for blocking time; it is not what holds LCP up.
- **Footer layout shift.** First seen on `/projects` and `/properties` (0.094, `docs/runbooks/lcp-investigation.md`). A full audit on 7 Nov 2026 found the same single footer shift on `/auth` (0.28), `/builder/login`, `/dashboard` and `/post-property` (they redirect to `/auth`), and the "no such project" and "no such home" pages (0.12 to 0.34). The cause: the page above the footer is short while content streams in, so the footer starts high and jumps down. The proposed fix is a full-height wrapper in the public and sign-in layouts and a loading outline on `/auth`. It was planned, built and re-measured with the seed loaded on 7 Nov 2026 (every page under 0.1; see `docs/runbooks/lcp-investigation.md`).

## Carry forward

1. ~~The footer shift fix~~ Done on 7 Nov 2026 (no component changed, so no picture is expected to change).
2. Judge LCP with field data once the site is live; do not gate on Lighthouse's simulated 2.5 s.
3. `docs/engineering/backend.md` still lists older cache tag names; ADR-048 says the built names are in force. Ask the owner before editing it (protected).
4. The sponsored banner change (2-second carousel, ADR-038) is not yet in the UX source; update the UX package, `docs/ux/final-ux/` and the plan together (R-DS-05).
5. After launch: submit the sitemap and run the Google Rich Results test on a home and a project page.
6. When all stages are done: the property enquiry form re-asks for the phone number although sign-in is phone-only.
7. Lighthouse CI and performance budgets, later.
