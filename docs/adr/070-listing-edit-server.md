# ADR-070 · Saving changes to a listing, and the status tables (S6-T05, part 1)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-060 (submit_listing), ADR-061 (wizard server side), ADR-067 (close_listing), DEC-09 (policy C), FR-ACC-09, FR-ACC-12
- Plan approved by the owner on 8 Nov 2026 ("all recommended"): reuse `/post-property/[id]` for editing, warn only when a change sends a Live listing back to review, a rejected listing ends with "Resubmit for review", photos on a Live listing left as DEC-09 has them, the new wording flagged for confirmation.

## Decision

- **A new action, `saveListingChanges`**, saves the wizard's fields to a listing that is in review, Live or not approved. A draft is saved by the wizard's own action (it stays the only one that writes drafts), and a sold or rented listing is final, so both answer a conflict. The caller is the session; someone else's listing looks the same as one that does not exist.
- **The database stays the judge.** The save is an ordinary update as the owner under Row Level Security; nothing new is granted. The state is read first and the update is made only while the listing is still in that state, so a listing that moved in between answers a conflict instead of being changed under a different rule. The state after the write is returned, because the lifecycle guard may have moved a Live listing to Pending (policy C, `guard_properties`). The answer says `wentBackToReview` when that happened.
- **The cache is refreshed after every save** (the lists and that home's page): a Live listing's new price shows on the site at once, and a Live listing sent back to review leaves it.
- **`changesNeedReview` mirrors the guard** for the screen's warning: only a Live listing, and only when the listing type, property type, title, description or address changed (the pin on a map is not in the wizard yet). Spacing the database would not keep does not count. `IT-listing-edit` changes each field of a Live listing against the real database and checks the rule and the trigger agree, for each moderated field and for the fields that keep it Live.
- **Rejected listings** keep their state and their reason while they are edited; they are resubmitted with the existing `submit_listing` (which checks the fields, a photo and the limit of five open listings), and the test covers edit then resubmit.
- **Status tables in code (`src/lib/status-machine.ts`, UT-status)** for listings and enquiries, with `IT-status-parity` replaying every pair of states against `guard_properties` and `guard_enquiries` in CI: allowed in the table if and only if allowed by the trigger.
- **Photos** are not a moderated change in policy C, so adding or removing photos on a Live listing does not send it back to review. This is the DEC-09 rule as it stands; it is noted here as a known gap for the owner to decide on later.
- **Not in this change:** the screens (parts 2 and 3).

## Consequences

- No migration, package or gate change. One action, one pure rule, one status table, and two integration test files that run in CI.
- Rollback: delete the action, its config and schema, the two store methods, the rule file and the status table with their tests; `terminal_status` goes back to an internal error. Nothing is destroyed.
