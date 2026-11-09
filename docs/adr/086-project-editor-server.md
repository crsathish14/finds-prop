# ADR-086 · The project form: the server side (S7-T02, part A)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-081 and ADR-082 (the same pattern for units and leads), ADR-065 (listing moderation), FR-ADM-03, FR-BLD-02, BR-40 to BR-45, DEC-35
- Plan approved by the owner on 9 Nov 2026 ("approved all"): media uploads go straight from the browser; a new `project_save` rate-limit scope; no map picker; no drafts in v1; the admin alone chooses the builder, the enquiry form and the price trends.

## Decision

- **A new `project-editor` feature.** It saves a project and reads it for the form, for the admin and for a builder, with one set of rules. The public `projects` feature (reads for visitors) is untouched.
- **The user's own client, not the service role.** `projectStore(client, scope)` acts as the signed-in admin or builder, so the database's policies and triggers decide what is allowed (`guard_projects`): a builder writes only their own projects, cannot hand one to another builder, cannot choose its enquiry form, cannot change its page address once it has been approved, and any change of theirs sends the project back to review and hides it until it is approved again (BR-41); an admin's change does none of that. The service-role allow-list is unchanged.
- **Four actions,** one pair for each role, because the two forms differ in what they may send: `createProject` and `updateProject` for a super admin, `createMyProject` and `updateMyProject` for a builder (the role and an active record, agents included). A write is limited by the new scope **`project_save`: 60 per user per hour** (a long editing session is well inside it; a stuck script is not). A save refreshes the project's public page and the lists, and the page of the old address too when the address changed. The database audits projects (`audit_projects`), so there is no audit entry in the action.
- **The rate-limit table in `docs/engineering/security.md` gets one row,** approved by the owner on 9 Nov 2026: `project_save`.
- **The reads go through `admin_projects()` and `my_projects()`.** The table's select grant hides the review columns and the enquiry form, so a project is opened for editing through the functions that return the admin's every project or a builder's own; with the project's price trends, its builder and the review state. The admin's form also reads the builders (`admin_builders`) and the active forms (`admin_forms`).
- **What the form may write.** Name, page address, type, property type, status, price range (the highest not below the lowest), bedrooms 0 to 10, land area (two decimals), total units, possession date, contact phone, locality, address, coordinates (both or none), advantages and nearby places (up to 20 each), RERA (the number is kept only when RERA applies, so a leftover box never blocks a save), description, specifications, amenities (up to 30), and the two search fields. Each box has its own message; a rule the database enforces (a taken or locked address, a price range that runs backwards, coordinates given by halves) goes on its box too.
- **Media are paths and links, not uploads.** The browser uploads straight to the `project-media` bucket with the user's own session (the bucket's policies allow only the project's own builder or the admin to write under `<project id>/`, and its limits allow JPG, PNG, WEBP and PDF up to 10 MB). A save takes the paths (at most 20 per group, images, floor plans, elevations and plot images, and one brochure) and refuses any that is not in the project's own folder, plus up to 5 https video links. Media can be added only after the first save, because the folder is named for the project's id.
- **Price trends are saved with the project, by the admin only,** through a new function `save_project_price_trends(project, rows)`: it replaces the project's months with the list in one step (months removed, changed and added), refuses anyone but the super admin itself, and leaves the table's checks in place (a month is the first of a month, a price 1 to 10 million, no month twice). A failure there leaves the project saved and says so.
- **A new project starts in review.** The database makes every new project pending and only the system can set a draft, so there are no drafts in v1: an admin's new project waits for the admin's approval (S7-T04) and a builder's for the admin's.
- **Messages:** five new keys under `validation.*` (below).
- **Not in this change:** the form's parts and pages (the next changes), the media upload itself (the browser, in the page change), the builder pages (S7-T03), and the admin's projects list and approvals (S7-T04).

## Wording to confirm

- "Use lower case letters, numbers and single hyphens, from 2 to 80 characters." (a page address that is not valid)
- "This page address is already used by another project." (a taken address)
- "The page address cannot be changed once the project is approved." (a builder changing an approved project's address)
- "The highest price must be the same as or more than the lowest." (a price range that runs backwards, on the "to" box)
- "Give both the latitude and the longitude, or leave both empty." (coordinates given by halves)

## Consequences

- One migration (`save_project_price_trends`, with a pgTAP test and its generated type), one new rate-limit scope and its documented row, and the feature with its tests. No package, gate or environment change.
- The integration test (`tests/integration/project-editor.test.ts`) and the pgTAP test run in CI against the real local database; they were not run on the developer's machine, because the owner asked that nothing be started locally.
- Rollback: delete the feature, its tests, the `project_save` scope and its documentation row, and drop the function (`drop function public.save_project_price_trends(uuid, jsonb)`). Projects already saved stay as they are.
