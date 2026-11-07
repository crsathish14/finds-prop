# ADR-060 · Submitting a listing: the database side of the wizard (S6-T02, part 1)

- Status: Accepted
- Date: 2026-11-07
- Related: ADR-024 (listing lifecycle, policy C), ADR-017 (public projections), ADR-058 (photo pipeline), plan 06 section 6.2, FR-ACC-06, FR-ACC-08, FR-GEO-02, DEC-09, DEC-19, DEC-26, DEC-35
- Plan approved by the owner on 7 Nov 2026, "All recommended": no map pin in the first wizard (the DEC-19 fallback), description optional, address required, five draft plus pending per person, drafts created on the first Continue.

## Decision

- **A listing can be submitted without coordinates.** `properties_complete_unless_draft` no longer demands `location`. This is the fallback written into the roadmap for S6 (DEC-19 is not answered, no map exists yet, and place search, S4-T05, was left out). Such a listing is outside every radius and map-box result, because both compare `public_location`, which is null for it, but it still appears in keyword and locality search with no coordinates. The search function needed no change; `listing_submit.test.sql` proves all three. Adding or removing the location of an approved listing already sends it back to review (policy C compares the stored point).
- **The description is optional**, as the approved screen says ("Describe your home", optional). The check no longer demands it. The columns' own limits (1 to 5000 characters) stay, so the wizard stores no description as null, not as an empty string.
- **At most five listings in draft or pending per person** (DEC-26), enforced by the trigger `properties_open_cap` on insert, because owners are allowed to insert into `properties` directly (RLS is the only gate there) and a rule kept in one server action could be walked around. The limit is the app_config row `listings.max_open` (default 5; a missing or non-numeric value means 5). A per-person advisory lock stops two parallel inserts from both slipping under it. The system (migrations, seed, service role) is not limited; a person with no verified phone is left to the insert policy, so that refusal keeps its own error.
- **`submit_listing(listing_id)` is the only way a user moves a listing to Pending.** It is a definer function the signed-in owner calls with their own session: the owner is `auth.uid()`, a listing that is not theirs looks like one that does not exist, and the status guard treats the function as the system, so clients still cannot change `status`. It refuses an account without a verified phone, a listing that is not a draft or rejected, a listing missing a required column (the missing names come back in the error detail), and a listing with no photo. A rejected listing goes back into the count, so resubmitting it is refused when the person is at the limit; a draft is already in the count. The move to Pending stamps `submitted_at` and is written to the audit log by the existing trigger.
- **Not in this change:** the screens, the server actions that call these (next pull request), the pin on a map (a later task, with MapLibre and its content-security-policy entries), the admin queue (S6-T04), editing a live listing and resubmitting after rejection in the wizard (S6-T05; the function already accepts a rejected listing).

## Consequences

- No new package, no change to grants or policies.
- The wizard's second pull request calls `submit_listing` and inserts drafts with the user-scoped client; the cap error reaches it as the message `properties.open_limit`.
- Deleting a draft that has photos leaves the files for the media sweeper (ADR-058).
- Rollback: drop the trigger and the three functions, delete the app_config row and restore the old check. Nothing is destroyed.
