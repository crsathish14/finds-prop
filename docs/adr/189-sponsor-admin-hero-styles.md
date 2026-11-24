# ADR-189 · Sponsor hero styles: the admin's choice and fields

- Status: Accepted (owner decisions of 23 Nov 2026 on the sponsor ads redesign; the new words were approved by the owner on 24 Nov 2026 ("approved")).
- Date: 2026-11-25
- Related: ADR-182 (the stored data), ADR-187 (the parts that draw it), ADR-105 and ADR-115 (the sponsor manager on the Hero page)
- Class: C2 (a deviation from the approved admin-sponsors screen). No migration, no dependency.

## Context

The owner decided that the admin chooses one hero ad style for the whole site, the Showcase card or the Cinematic banner; that the admin types and uploads each sponsor's details in the Sponsors form; and that the admin chooses, per sponsor, whether a click goes to one of our projects or another website. ADR-182 stored all of this and ADR-187 drew it. This change is the admin's side. The live home page still shows the picture strip; switching it to the chosen style is the next change, so the site never shows an empty ad while the admin fills the new boxes in.

## Decision

- **Hero ad style switch** above the sponsor list on the Hero page: Showcase or Cinematic. Choosing one saves it at once with the whole list (like Move and Delete) and says "Sponsor saved"; a refused save puts the switch back and says why. The line under it says the Split layout keeps its picture panel.
- **Where a click goes**, in the sponsor drawer: "Our project" (a list of the live projects, named with their developer, read through the projects feature's own `getProjects()`; with none live it says so) or "Another website" (the https address, as before). A new sponsor starts on Another website, as today.
- **Hero ad fields** (new part `SponsorAdFields`) between the Active switch and the banner pictures: the developer or brand, the one photo (a picture slot at 16:9, checked in the browser by the server's own photo rule and uploaded with the sponsor's other pictures), and the Showcase and Cinematic boxes, each style in its own group with its required boxes marked and the style the site shows now marked "Shown now". Every box is optional when saving; only a line that is too long is refused. The draft, the payload and the server's problems carry the new fields.
- **The list**: the first readiness column now says whether the sponsor is ready for the chosen style ("Hero ad"); a sponsor that can show nowhere (not ready for the style, and no banner pair) is "Needs images", as before.

## Words (new, approved by the owner on 24 Nov 2026)

Under `admin.siteContent.sponsors`: the link choice ("Where a click goes", "Our project", "Another website", "Project", "Choose a project", the hint and the "no project is live" line), the column "Hero ad", the style switch ("Hero ad style", "Showcase", "Cinematic" and its line), the hero ad section (its title and line, "Developer or brand" and hint, "Shown now", "Photo" and its note), the Showcase and Cinematic boxes with their placeholders, and the photo's weight line.

## Consequences

- Tests: the draft (the new fields, the project link, too-long lines, readiness, the server's problems), the panel (the style switch saved and put back, the project choice) and the parts; Design Lab "Hero ad fields" on the Sponsors board.
- The Hero page preview and the layout warning still describe the picture strip; they change with the live hero in the next change.
- Rollback: revert this change. Saved styles and fields stay in the setting and are ignored by the old screen (ADR-182).
