# ADR-071 · Editing a listing: the Design Lab parts (S6-T05, part 2)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-070 (the server side), ADR-062 (the wizard pages), ADR-020 (Design Lab), ADR-035 (message keys), FR-ACC-09, FR-ACC-12
- Plan approved by the owner on 8 Nov 2026 ("all recommended"): the wizard is reused for editing, the warning appears only when a change would send a Live listing back to review, a rejected listing shows the admin's reason and ends with "Resubmit for review", the wording is flagged for confirmation.

## Decision

- **No new component.** Editing is the same wizard with different words, so the Lab entry "Edit a listing" (Seller board) is made of the parts that exist: `WizardShell`, `WizardFooter`, `Alert`, `ConfirmDialog`, `ReviewList` and `NextSteps`. The sample review step takes its words as optional props (the defaults are unchanged, so the pictures of the new-listing board do not move).
- **What the entry shows:** a Live listing (an info line saying what sends it back to review, and Save changes, which asks first), a listing in review, a listing that was not approved (a red line with the admin's reason, and Resubmit for review), and a button that is working.
- **In edit mode the footer has no Save draft** (only a draft is saved that way; a sent listing is saved by its own button), and the last button is the copper one with its own words.
- **The footer wraps on a very narrow screen.** The first CI run of the new entry found the Seller board scrolling sideways by 12 px at 390 px: with Back beside it, "Resubmit for review" is wider than the card. `WizardFooter` now lets its row wrap below 768 px, so the main button drops to its own line instead of running off the edge (on a real phone the fixed bar is wider than the card, so it only happens on the narrowest screens). Nothing changes when the labels fit.
- **Not in this change:** the connected page, the messages in `en.json` and the Edit buttons (part 3).

## Wording to confirm

Plain English in the Design Lab now; part 3 puts the same words in `en.json`. None of it is in the approved UX file (the UX has only a "Proposed" Edit button):

- Heading and lines: "Edit your listing"; "Your listing is live. If you change its kind, type, title, description or address, it goes back to review and stays hidden until it is approved again."; "Your listing is waiting for review. Your changes are saved to the same listing, which stays in review."; "Fix what the reviewer asked for, then send your listing for review again."
- Last step: "Review and save", "Review and resubmit"; the "What happens next" lines for each state; buttons "Save changes", "Saving changes", "Resubmit for review", "Resubmitting".
- Notices: "You're editing a live listing" with "A change to the kind, type, title, description or address sends it back to review. Any other change shows on Find Prop at once."; "This listing was not approved" with "Reason: {reason}".
- The question: "Send this listing back to review?", "Saving these changes sends your listing back to review. It stays hidden until it is approved again.", "Save and send for review", "Keep editing".

## Consequences

- No migration, package, gate or message change. One Design Lab entry and its test; the Seller board's three pictures change (the entry makes it longer) and are added from CI after the owner approves them.
- Rollback: delete the entry, its demo file and test, and restore the sample review step's fixed words. Nothing is destroyed.
