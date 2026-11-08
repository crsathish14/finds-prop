# ADR-072 · Editing a listing: the connected page (S6-T05, part 3)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-070 (the server side), ADR-071 (the Design Lab parts and the wording), ADR-062 (the wizard pages), DEC-09 (policy C), FR-ACC-09, FR-ACC-12
- Plan approved by the owner on 8 Nov 2026 ("all recommended").

## Decision

- **The wizard is reused.** `/post-property/[id]` opens a listing in review, Live or not approved in edit mode (the page passes the state and, for a listing that was not approved, the admin's reason, which `DraftView` now carries). A draft is continued as before; a sold or rented listing is final and leads to My listings.
- **Nothing is saved until the last step.** Continue only checks the step and moves on. A change to the title or description on step 4 would otherwise send a Live listing back to review (and hide it) before the owner agreed to it. Photos are the exception: they upload at once, as they do for a draft, and are not a moderated change.
- **Save changes** (Resubmit for review for a listing that was not approved) checks every step, sends the owner to the first step with a problem or to the photos if there are none, and then:
  - asks "Send this listing back to review?" only when `changesNeedReview` says a moderated field of a Live listing changed (compared with the values the listing held when the page opened, not with anything kept from before signing in again);
  - calls `saveListingChanges`, and for a listing that was not approved then `submitListing` (with one key per page), so the listing goes back to review after its fixes;
  - says so in a toast and returns to My listings. A failure keeps every answer and says "We couldn't save your changes" (or the resubmit's own line); a conflict says the listing changed in the meantime; the limit of five open listings is shown by the resubmit.
- **Edit on My listings** (`ownerActions`): listings in review, Live or not approved offer Edit first; Sold and Rented out only Delete. It opens the wizard on that listing.
- **Not in this change:** a map pin, or taking photos into account in policy C (noted in ADR-070).

## Wording to confirm

The edit headings, lines, buttons and question are listed in ADR-071 and now live in `postProperty.edit` in `en.json`. Added here, not shown in the Design Lab:

- Toasts after saving: "Your changes were saved." and "Your changes were saved. The listing is back in review." (after a resubmit, the existing "Your listing was submitted for review.").
- Failure lines: "We couldn't save your changes" with "Your answers are saved on this page. Check your connection and try again." and "This listing changed while you were editing it. Reload the page to see how it is now."
- The Edit button on My listings: "Edit".

## Consequences

- No migration, package or gate change. The wizard grows an optional `edit` and a fifth action (`saveChanges`); the page, the screen and `DraftView` carry the state and the reason; My listings gets one more button.
- No new picture: the Design Lab entry of part 2 shows these screens, and the dashboard and wizard are not pictured (they need a signed-in session).
- Rollback: remove the `edit` prop and `saveChanges` from the wizard and screen, restore the page's redirect for any state other than a draft, and remove Edit from `ownerActions`. Nothing is destroyed.
