# ADR-088 · The project form: the media section and the price trends, in the Design Lab (S7-T02, part B2)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-086 (the server side: paths, links and price trends), ADR-087 (the form's other parts), ADR-015 (uploads), FR-ADM-04, FR-BLD-02
- Plan approved by the owner on 9 Nov 2026 ("approved all"): media uploads go straight from the browser to the `project-media` bucket under `<project id>/` with the user's own session; JPG, PNG, WEBP and PDF up to 10 MB; the media boxes are off until the first save; the price trends are the admin's alone and are saved with the project.

## Decision

- **Three new parts, all without state of their own** (the page keeps the files, their steps and the links, and does the uploading): `MediaGroupField` (a pattern: one group of files as a grid of tiles), `ProjectMedia` (the inside of the Media section, which goes in the `media` slot of `ProjectFields`) and `PriceTrendsEditor` (the admin's box).
- **Groups.** Project images, Floor plans, Elevations and Plot images (up to 20 files each, the server's limit), one Brochure, and up to 5 video links. The video links reuse `TagListField` with a 300-character limit, the server's longest link; the page checks that a link starts with `https://` and puts the message on the box. A comma splits a link in the box (the tag list's rule), which a video link does not normally contain.
- **What each picker offers.** The four image groups offer JPG, PNG and WEBP (the public project page shows floor plans, elevations and plot images as pictures); the brochure offers PDF only. The bucket accepts all four types and 10 MB, and the page checks the type and the size again before it uploads, so a picker is a convenience, not the rule. The UX file's line "JPG, PNG, WEBP or PDF, up to 10 MB each" is kept as the section's description.
- **A tile per file.** A small picture for an image and a file icon for a PDF, the file name cut with an ellipsis, an x that names the file, and for a file on its way a named progress bar and a word (Uploading, Removing); an error is text on the tile and does not count towards the group's limit (so a refused file never blocks adding another). The progress bar shows that the file is on its way, not its bytes (a request gives no byte progress, as with the photo step of posting a property).
- **Cover.** The UX file marks the first project image "Cover". The first image is the cover on the public page already; the tile does not carry a word for it (the group's hint says it).
- **One file only.** The brochure is a group with a limit of one: when it holds a file the add tile goes and the group says it is full. Replacing a brochure is remove, then add; the UX file's Replace button is left out to keep one way of doing it.
- **Disabled until the first save.** `ProjectMedia` takes `locked`: a note says the project must be saved first (its folder in the bucket is named for the project's id) and every box is off. The page turns it on for a new project.
- **Price trends.** A row is a month (the browser's month picker, which gives "yyyy-mm", the server's format) and a price per sq.ft typed as text (the server reads it and refuses what is not a whole number from 1 to 10,000,000), with an x. Up to 120 months (the server's limit), and Add month is off at the limit. The page keeps the order, finds a month listed twice and puts each message on its box; the box shows it with an icon and ties it to the box. It is a card of its own (title, description, rows, Add month, count) for the form's side column, which is 320 px wide; a row stays on one line down to that width.
- **Not in this change:** the upload itself (the browser, the page change), the pages, the words in `messages/en.json` and the price-trend chart's sort order (part C).

## Wording to confirm

- "Save the project first, then add its images, floor plans and brochure." (a new project's media section)
- "Add files" (the add tile), "Uploading", "Removing" (said on a tile), "The group is full." (a group at its limit), "Remove: <file name>" (what the x says)
- The group names "Project images", "Floor plans", "Elevations", "Plot images" and "Brochure (PDF)" (the UX file says Images, floor plans, elevations and the brochure in one line), and "The first image is the cover."
- "Videos" and its hint "Links that start with https://." and "Paste a video link" (the UX file's own placeholder)
- "Price trends" and "Monthly price per sq.ft shown as a chart on the project page." (the UX file's own words), "Month", "₹ per sq.ft", "Add month", "Remove <month>" and "No months yet. Add a month to start the chart." and "The list is full."
- The messages on a price row ("This month is listed twice.", "Choose the month.", "Enter a whole number.", "The most is 1,00,00,000.") are shown in the Lab for the look only; the page change gives the real ones from the server's messages.

## Consequences

- Components and Design Lab entries only: three entries on the Admin board (Project media, Media group field, Price trends editor). No server, database, package, gate or environment change.
- The Admin board's three Linux baselines (390, 820, 1440) change again: the board's pictures are judged in CI by the owner first and the baselines go in their own commit, as in part B1.
- Rollback: delete the three parts, their tests and their Lab entries. Nothing else uses them yet.
