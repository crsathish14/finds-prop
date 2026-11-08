# ADR-069 · The connected My listings and Enquiries received tabs (S6-T03, part 4)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-067 (close_listing), ADR-068 (server side), ADR-035 (message keys), FR-ACC-04, FR-ACC-09 to FR-ACC-12
- Plan approved by the owner on 7 Nov 2026 ("all recommended"): Edit left to S6-T05, drafts not in My listings, only Live rows link to the public page, counts on all four tabs, delete in every state, enquiry buttons as in the UX, 60 enquiries at most. The extra wording is flagged below for confirmation.

## Decision

- **Two client islands under the tabs.** `MyListingsBoard` and `ReceivedBoard` take what the server read and the actions to call, and keep only what the screen needs: which confirmation is open, which button is working, and the rows as the change left them. After a change the page is read again (`router.refresh()`), so what stays on screen is what the database holds.
- **Reads happen only for the open tab**, as before. `MyListingsTab` and `ReceivedEnquiriesTab` read at request time (so "posted 2 days ago" is as of now) and show the tab's empty state when there is nothing. `getMyListings()` now returns `{ listings, now }` like the enquiry reads, so the time is taken in the read.
- **Marking sold or rented and deleting ask first** (the confirmation words are the UX's). The button offered follows the listing's kind: Mark as sold for a sale, Mark as rented for a rental (the database refuses the other, ADR-067). A move of an enquiry (Mark contacted, Close enquiry) asks nothing: it only changes a label for the owner, and the answer is a toast.
- **Failures.** A listing or enquiry that changed under the owner (closed already, or gone: `CONFLICT` or `NOT_FOUND`) is said in a toast and the page is read again. Anything else leaves the row as it was and shows the UX's red line, "We couldn't update that listing" (or enquiry), with Try again, which repeats the same change without asking again.
- **Numbers on the four tabs** (the optional `counts` of part 3) come from four count reads made together in the page, none of them when nobody is signed in: `countSavedHomes()` (through the same inner join as the list), `countMyListings()` (not drafts), `countReceivedEnquiries()` (all, and the New ones, over the owner's own listings) and `countSentEnquiries(userId)`. The database counts; no rows are read for it. A tab with nothing to count shows no number. Enquiries received shows "N new" in the orange style while any enquiry is New, and the total otherwise.
- **Not in this change:** Edit (S6-T05), a time-limited Undo, paging beyond the first 60 enquiries or 200 listings.

## Wording to confirm

New strings in `account.dashboard.*` in `en.json`. Most come from the approved UX file (the tab words, the empty states, "Mark as sold", "Mark as rented", "Delete", "Mark contacted", "Close enquiry", "Posted {when}", "Posted today", "Waiting for review. It will appear on Find Prop once it is approved.", the sold and delete confirmations, "Keep it live", "Cancel", "Delete listing", "Marked as sold" with "It no longer shows in search results.", "We couldn't update that listing", "Nothing was changed. Check your connection and try again.", "Try again", "About" and "{count} new"). These do not, and need the owner's confirmation:

- Lists: "Your listings" and "Enquiries received" (read by a screen reader as the names of the lists), "Untitled listing", "Not provided", "For sale", "Reason: {reason}", "A home that is no longer listed" (already used on My enquiries).
- Rented: "Mark this home as rented?" (the UX has only the sold dialog; same line with "rented"), "Marked as rented".
- Deleted: "Listing deleted" with "The listing and its enquiries were deleted."
- Enquiry toasts and error: "Marked as contacted", "Enquiry closed", "We couldn't update that enquiry".
- Changed under the owner: "That listing has changed. The list now shows how it is." and "That enquiry has changed. The list now shows how it is."

## Consequences

- No migration, package or gate change. Three new count reads (listings, saved, enquiries), a new tab component in each of `listings` and `enquiries`, and one added test of the page's reads.
- The Design Lab parts and pictures are those of part 3; this change adds none.
- Rollback: restore the previous `dashboard/page.tsx` and `getMyListings()`, delete the two boards, the two tab files, the rules files, the count reads and the new messages. Nothing is destroyed.
