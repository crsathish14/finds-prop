# ADR-068 · My listings and enquiries received: the server side (S6-T03, part 2)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-067 (the `close_listing` function), ADR-061 (the wizard's server side, the pattern followed here), ADR-048 (cache tags), FR-ACC-04, FR-ACC-09, FR-ACC-10, FR-ACC-11, BR-52
- Plan approved by the owner on 7 Nov 2026, "all recommended". This is part 2 of 4: server side only, no screens.

## Decision

- **Two owner actions on a listing: `closeListing` and `deleteListing`.** Both need a signed-in account with a verified phone, the same rule as posting. `closeListing` calls `close_listing` (ADR-067) as the owner's own session; `deleteListing` is the owner's own delete under the existing policy, asking the database for the deleted row's short id in the same call. Neither uses the service role.
- **No rate limit and no key on either.** Each works on one listing the caller owns. Closing is terminal, so a repeated call is refused by the database; deleting a deleted listing finds nothing. The work is bounded by the listings the person owns.
- **Both refresh `tagsAfterListingChange(shortId)`**, with the short id taken from the database's answer, not from the request: a closed or deleted home leaves the lists and its own page at once (FR-ACC-10).
- **They sit beside the wizard's store, not in it.** `MyListingsStore` is its own small interface (close, remove) with its own store file, so the wizard's tests and stand-ins are untouched. Database failures go through the same `mapListingError`; it learns two answers (`listing.wrong_outcome` and `listing.bad_outcome` are `VALIDATION` on the `outcome` field). `listing.not_closable` is already `CONFLICT`, `listing.not_found` `NOT_FOUND`, `listing.not_allowed` `FORBIDDEN`.
- **Deleting someone else's listing, or one that does not exist, is `NOT_FOUND`**: the owner's delete policy matches no row, so nothing is deleted and nothing is revealed. The photo files of a deleted listing are left to the media sweeper (ADR-058); its enquiries go with it (`on delete cascade`).
- **"My listings" is `getMyListings()`**: the caller's own rows through `my_properties()`, outside the drafts (they have their own list on the post-property page), newest first, at most 200, with each listing's first photo by position as its cover (a second read of `listing_media`, owner-visible). `rejection_reason` is read only for a rejected listing, so a reason left over from an earlier round never shows. Rows not shaped as a listing are left out.
- **One action for an enquiry's status: `setEnquiryStatus`** (Contacted or Closed; `new` can never be asked for). It updates the row as the owner: the update policy lets only the owner of the listing change a row, the column grant allows only `status`, and `guard_enquiries` allows only forward moves, so a move the guard refuses is `CONFLICT` and an enquiry the caller cannot see is `NOT_FOUND`. No limit and no key (each enquiry can move at most twice); enquiries are private, so no cache tags, and the audit triggers do not cover them.
- **"Enquiries received" is `getReceivedEnquiries()`.** The database lets a person see an enquiry about a listing they own and also one they sent, so the read first asks for the caller's own listings (`my_properties()`, outside the drafts, at most 200) and then only for enquiries on those, newest first, at most 60 (as the sent list). Each enquiry carries the home's title and, only while that home is Live, its public address; a sold, rented or pending home has no public page.
- **Not in this change:** the screens (parts 3 and 4), the numbers on the tabs (part 4), and editing and resubmitting (S6-T05).

## Consequences

- No migration, package or gate change. Four new actions' worth of server code (two listing actions, one enquiry action, two reads) and their tests; `tests/integration/my-listings.test.ts` runs in CI against the local stack (close, delete, wrong owner, enquiry moves, the shapes the two reads rely on).
- The screens import only the features' index files; client components get view models and the actions through props, never the queries or the stores.
- Rollback: delete the new files and the exports. Nothing is destroyed.
