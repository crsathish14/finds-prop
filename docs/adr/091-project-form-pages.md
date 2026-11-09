# ADR-091 · The project form: the connected pages (S7-T02, part C)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-086 (the server side), ADR-087 and ADR-088 (the form's parts), ADR-015 (uploads), BR-41 (a builder's change goes back to review), FR-ADM-04, FR-BLD-02
- Plan approved by the owner on 9 Nov 2026 ("approved all"): the admin's pages `/admin/projects/new` and `/admin/projects/[id]`; the browser uploads straight to the bucket; the slug suggested from the name; the builder's approval warning built as the UX file words it, marked "Confirm this rule". The builder's own routes belong to S7-T03; the projects list and the approvals belong to S7-T04.

## Decision

- **Two pages and one connected form.** `/admin/projects/new` and `/admin/projects/[id]` read as the signed-in admin (the builders and the forms to choose from, and for the edit page the project with its price trends, never cached) and hand them to `ProjectForm` (`features/project-editor/project-form.client.tsx`), with the one save action each: `createProject` or `updateProject`. An address that is not a project id, or a project that does not exist, is "not found". The form keeps nothing the server does not also know: after a save the page is read again.
- **A new project is saved first, then its edit page opens.** The media folder is named for the project's id (ADR-086), so a new project's Media section is off with a note, and the price trends box is not shown, until the first save. The save sends the boxes only (and the builder and the enquiry form for the admin); the answer carries the new id and the page replaces itself with `/admin/projects/<id>`. A new project starts in review (ADR-086).
- **The page address is suggested from the name** (lower case, accents dropped, words joined by single hyphens, cut to 80 characters) for a new project, until the person types in the page address box; a saved project's address is never changed by the name. A save that changes the address refreshes the old page too (ADR-086).
- **The builder cannot be changed on a saved project** (the database refuses it, ADR-086): the box offers that one builder. A new project's box offers every builder.
- **Required boxes are checked in the browser first** (the name, the builder for a new project, the locality), with the messages the UX shows ("Enter the project name.", "Choose the builder.", "Enter the locality."); every other rule is the server's, and its message goes on its box (a taken or locked address, a price range that runs backwards, coordinates given by halves). The alert on top says how many boxes need attention and names them; the section list marks the sections; the page scrolls to the first.
- **Media upload.** A chosen file is checked (the type the group offers; 10 MB), sent straight to the `project-media` bucket under `<project id>/` with the signed-in person's own session (never the service role) and shown on its tile; a file that fails is shown with its reason and is not saved. A stored name is `<8 hex>-<the file's own name tidied>.<jpg, png, webp or pdf>` (letters, digits, dot, underscore, hyphen; the server's own rule), so the tile can show the file's own name. The paths are saved with the project when Save is chosen; a save is held back while a file is still on its way.
- **Removing files.** A file added in this visit and removed again is taken out of the bucket at once (no project holds it). A file that a saved project holds is taken out of the bucket after the save that no longer lists it (so a failed save loses nothing). A file added and never saved (the page was closed) stays in the bucket with nothing pointing at it; a sweep of such files, like the listing photos' sweep, is not part of this change.
- **Price trends** are the admin's box on a saved project. They are checked before the save (a month and a price on each row, no month twice, a whole price from 1 to 10,000,000; an empty row is left out) and the save is held back with the rows marked; the server checks again. The price trends are a second write after the project (ADR-086): if it fails, the project is saved, the failure is shown in a message, and the page is read again.
- **The builder's form** is the same component with `scope="builder"`: the approval warning on top, no Builder, Enquiry form or Price trends box, the page address locked once the project is approved, and the builder's note beside Save. It is built and tested here but has no route: the builder pages are S7-T03.
- **The section list** follows the scroll (the section nearest the top is the current one) and shows a problem, a done section (what the section needs is filled: the name and, for a new project, the builder; the locality; the page address; the RERA number when RERA applies; a description; a file or a video link) or nothing.
- **Words** are in `messages/en.json` under `admin.projectForm`.
- **Not in this change:** the projects list and approvals (S7-T04), the builder portal's routes (S7-T03), a sweep of unsaved files, a map picker, drafts.

## Wording to confirm

- Titles and lines: "New project", "Add the details buyers see first. Media and price trends can be added once the project is saved.", "Change the details of this project."
- The messages on the boxes: "Enter the project name.", "Choose the builder.", "Enter the locality." (the UX file's own words in the Design Lab), and the alert: "{n} things need attention" with "Check <the boxes' names> before saving." or "Check the marked boxes before saving."
- Media: "Wait for the files to finish uploading, then save.", "This type of file is not accepted here.", "Too large. The most is 10 MB.", "The file could not be uploaded. Try again."
- Price trends: "Fix the months marked in the price trends before saving.", "Choose the month.", "This month is listed twice.", "Enter the price.", "Enter a whole number.", "Enter a price from 1 to 1,00,00,000."
- Toasts: "Project added" with "<name> is waiting for approval. You can now add its media and price trends."; for the admin "Project saved" with "The changes are live."; for a builder "Project saved" with "It is back in review and hidden until it is approved."
- The builder's warning, built as the UX file words it and marked "Confirm this rule" there: "Saving sends this project for approval" and "It is set to Pending and hidden from the public site until it is approved again."; the note "Admins can save without re-approval." is the UX file's own.
- Option and suggestion words: Residential, Commercial, Plotted layout, Apartment, Villa, New launch, Under construction, Ready to move; the amenity suggestions Clubhouse, Swimming pool, Gym, 24x7 security, Power backup, Lift.
- The words ADR-087 and ADR-088 list are used as they are.

## Consequences

- A feature client and two pages, with their words and tests; no server, database, package, gate or environment change. The two routes stop being placeholders.
- The only way to reach the pages until S7-T04 is the address (`/admin/projects/new`); the list page that links to them is still a placeholder.
- The browser reads and writes the media bucket with the user's session, which the bucket's policies already allow only for the project's own builder or the admin.
- Rollback: restore the two placeholder pages and delete `form.ts`, `media-storage.ts`, `project-form.client.tsx`, their tests and the `admin.projectForm` words. Projects already saved stay as they are.
