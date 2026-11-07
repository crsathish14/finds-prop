# ADR-061 · The post-property wizard, server side (S6-T02, part 2)

- Status: Accepted
- Date: 2026-11-07
- Related: ADR-060 (the database side this calls), ADR-058 (photos), ADR-007 (validation and form contract), ADR-018 (rate limiting), FR-ACC-06, FR-ACC-08, DEC-26
- Plan approved by the owner on 7 Nov 2026, "All recommended".

## Decision

- **A new feature slice, `features/listings`,** with the schemas, the rules, the owner's database access, the four actions and the two reads. No screen yet (parts 3 and 4).
- **Everything runs as the signed-in owner, under Row Level Security.** There is no service-role code in this slice. Inserting, updating and deleting a draft use the grants and policies `properties` already has (a verified phone, own rows, the content columns only); the move to Pending is `submit_listing`, called with the owner's own session. This keeps the slice in change class C1 and off the service-role allow-list.
- **Four actions,** all needing a verified phone: `createListingDraft` (limit `listing_create`, 10 per user per day, and a one-time key so a double click starts one draft), `saveListingDraft`, `deleteListingDraft`, `submitListing` (a one-time key). Saving and deleting touch only the caller's own draft and are bounded by the five-listing limit; they carry no limit of their own. Nothing is refreshed on the public site, because a draft and a pending listing are not public; the audit entry for the move to Pending comes from the database trigger.
- **One rule per field, used twice.** The step schemas ask for the fields of one step (Continue checks only the current step); the draft schema accepts any of them, each checked when given, so "Save draft" keeps an unfinished listing. A blank box clears the field (null); a field that is not sent is left alone. Numbers may arrive as typed text, with commas and spaces dropped.
- **A client cannot choose more than the wizard has.** The draft schema ignores unknown keys, so an owner, a status, a location or a state in the request is dropped. The state is always set to Tamil Nadu by the server. The owner is the session.
- **Only a draft is changed or deleted here.** The update and the delete both filter on `status = 'draft'`; a pending or approved listing is edited by the edit flow (S6-T05). A listing that is not the caller's looks the same as one that does not exist (not found).
- **Land and commercial space have no bedrooms:** choosing either type clears the bedrooms, because the database refuses them.
- **Amenities are the twelve the screen offers,** stored as those words (the property page prints what the owner stored). The database would allow 20; the others wait for editing.
- **Errors reach the screen as keys,** in the usual closed set: a sixth open listing and a submit with no photo are validation problems with their own message (`validation.openListingLimit`, `validation.photoRequired`), an incomplete submit names the fields that are missing, a wrong state is a conflict, a listing that is not the caller's is not found. The limit shown is the default of five; if the setting `listings.max_open` is changed, the message shows the default until it is made to read the setting.

## Consequences

- Five new visitor-facing messages under `validation.*` (**the owner approved the wizard wording on 7 Nov 2026**): "Make the title at least 8 characters.", "Add the street or building.", "Enter the 6-digit pincode.", "Add at least one photo before you submit.", "You already have {maximum} listings waiting. Finish or delete one first." The last two were proposed in the plan; no screen shows any of them until part 4.
- `listMyDrafts` and `getMyDraft` read through `my_properties()` (the owner's own rows) and are the only way the pages will read a draft. The draft's photos are returned as bucket paths; the page builds their addresses.
- Deleting a draft leaves its photo files for the sweeper (ADR-058).
- Tests: unit tests for schemas, rules, actions and views; `tests/integration/listings.test.ts` (IT-actions-listing) against the real database.
