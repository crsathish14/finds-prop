# ADR-067 · Closing a listing: the owner marks it sold or rented (S6-T03, part 1)

- Status: Accepted
- Date: 2026-11-07
- Related: ADR-024 (listing lifecycle, policy C), ADR-060 (listing submit), ADR-064 (listing moderation), ADR-028 (audit log), plan 06 section 6.2, FR-ACC-10, FR-ACC-11, BR-21
- Plan approved by the owner on 7 Nov 2026, "all recommended": four parts (this database function, then the server side, then the Design Lab parts, then the connected tabs), Edit left to S6-T05, drafts kept out of My listings, counts on all four dashboard tabs.

## Decision

- **`close_listing(listing, outcome)` is the only way an owner closes a listing.** The guard on `properties` refuses an owner any change of `status` (`properties.status_system_only`), so, as with `submit_listing` and `moderate_listing`, the move is a definer function that the guard treats as the system. Outcomes: `sold` or `rented`.
- **Only a Live (approved) listing can be closed** (`listing.not_closable`, 55000, for any other state, including one that is already sold or rented), as FR-ACC-10 says. The row is locked while it is read, so two requests at once close it once.
- **The outcome must fit the listing:** sold for a sale listing, rented for a rent listing (`listing.wrong_outcome`, 22023). This is what the approved dashboard shows ("Mark as sold" on a sale, "Mark as rented" on a rent), written down as a rule so a hand-made request cannot say otherwise.
- **The owner is the session.** Nothing in the request says who is asking; a listing that is not the caller's looks the same as one that does not exist (`listing.not_found`, P0002). A caller with no session or no verified phone is `listing.not_allowed` (42501), as for submitting.
- **It cannot be undone by the owner (BR-21).** The existing guard already refuses any later change of a sold or rented listing by its owner (`properties.terminal_status`); the function adds nothing to undo it and the screens say so in the confirmation.
- **What the guard does with it, unchanged:** stamps `closed_at`, clears `featured`, and the audit trigger records `listing.status_changed` with the owner as the actor. The function returns the listing's id, short id and new status, which is what the server action needs to refresh the cache tags (a closed home leaves search and its public page at once, FR-ACC-10).
- **Deleting a listing needs no new function.** The owner's delete policy already allows it; its enquiries go with it (`on delete cascade`) and its photo files are left to the media sweeper (ADR-058).
- **Not in this change:** the server action and the screens (parts 2 to 4), editing and resubmitting (S6-T05), counts on the tabs (part 4).

## Consequences

- One new function and no new table, column, grant or policy. `database.types.ts` gains the function.
- Rollback: drop the function. Nothing is destroyed.
