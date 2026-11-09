# ADR-102 · Site content: the Hero and Homepage pages (S7-T10, part C2)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-089 (the server side), ADR-099 (the Hero, Homepage and localities parts), ADR-101 (the Header and Footer pages, whose save flow these pages share), FR-ADM-10, FR-ADM-11, BR-81, BR-82, ADD-11, DEC-13
- Plan approved by the owner on 9 Nov 2026 ("approved"). This is the last change of the Site content task: all four pages are now connected.

## Decision

- **`/admin/hero` and `/admin/homepage` are now the real pages** (they were placeholders), built exactly like the Header and Footer pages (ADR-101): a thin server page reads what is saved as the signed-in admin (never cached) and hands it to a client form together with the save action of part A (`saveHero`, `saveHomepage`). The forms keep what is typed, send it on Save, put the server's problems on their boxes with an alert that counts them, say any other failure in a toast, read the page again after a save, and put the boxes back with Discard. The save flow, the tabs and the frame's words are the ones the Header and Footer pages already use. No server change.
- **Hero.**
  - The headline cannot be left empty (it is the one needed box), so with none saved the box starts on **the headline visitors see today** (worked out by `buildHero`, so it can name the region). Saving it unchanged stores that wording; clear the box and the server says it is needed.
  - The eyebrow and the subtitle start empty when none is saved. The picture shows the standard subtitle until one is typed, and the eyebrow in the Split layout only, as the home page does.
  - The layout starts on the saved layout (Search Desk by default). The layout line already says that with no sponsor booked the page shows Search Desk without a banner; the eyebrow likewise shows only when the Split layout is really used.
- **Homepage.** The five switches start on the saved values (all on by default). The localities start as saved, with each number as the text a box holds; **latitude and longitude are typed** (the place search was left out, ADR-099). The radius choices are 2 to 6 km and a new row starts at 3 km. A save is held to **8 localities** (a longer saved list is still shown and read by the public page up to 30; the admin must remove some before the next save). The server checks that each place lies inside the launch area; a place outside comes back as a problem on that row's latitude.
- **The picture follows the home page's own rules**, applied in the browser as the boxes change (a client component cannot call the `site` feature, ADR-101): a section is drawn On when its switch is on, and the locality section only when there is also at least one named place (the public page leaves out a section with nothing to show, FR-PUB-05); the Popular chips are the first four localities.
- **Messages:** the `admin.siteContent.hero` and `admin.siteContent.homepage` groups in `en.json` (headings, box labels, the two layouts, the five switches, the localities list, the picture's words). The wording is the approved screens', as the Lab used it (ADR-099).
- **Traceability:** the feature column of FR-ADM-10, FR-ADM-11 and the four admin pages now names `site-content` next to `site` (and `sponsors`).

## Wording to confirm

Used as the approved screens have it and as ADR-099 listed it, now in `en.json`: "Hero", "Homepage sections", the two lines under them, the layout cards, the switches' names and lines, the localities' words and the picture's words. Two things differ from the Lab text only in how they are written: the limit notice is built from the limit ("You've reached the limit of 8 localities"), and the line under "Explore by locality" is built from the number of chips ("The first 4 also appear as Popular chips in the search card"). New: the browser tab titles "Site content: Hero" and "Site content: Homepage", and the toasts "Hero saved" and "Homepage saved" with "The change is live on the public site."

## Consequences

- No migration, package, gate or environment change, and no Design Lab change (no new pictures). New: the Hero and Homepage forms, their rules in `form.ts`, two queries (`getHeroPage`, `getHomepagePage`), the two pages, the message groups and tests (the rules on their own; both forms with a stand-in save action: what they open with, the picture following the boxes, what a save sends, problems on their boxes, a failure toast, the limit, Discard).
- This closes S7-T10. Not done by design (decisions of 9 Nov): the place search for localities, the sponsors editor (S7-T11), an editor for the `region` setting.
- Rollback: restore the two placeholder pages and delete the files above, the message groups and this ADR. The saved settings are untouched.
