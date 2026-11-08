# ADR-077 · Admin builders: the connected page (S7-T05, part 3)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-075 (server side), ADR-076 (Lab parts and wording), ADR-010 (Google-only sign-in), ADR-035 (message keys), FR-ADM-04

## Decision

- **`/admin/builders` now shows the real page.** The route reads `admin_builder_overview()` as the signed-in admin and passes the rows to `BuildersBoard`, a client component in `src/features/builders` that uses the three Lab parts (`BuilderTable`, `BuilderForm`, `SignInAddress`) and the four actions of part 1 (invite, resend, activate or deactivate, edit).
- **`getBuilderOverview()` returns `{ builders, now }`.** `now` is the time of the read, so "3 days ago" is worked out from one moment on the server and in the browser and no component reads the clock.
- **Last sign-in words:** "Hasn't signed in yet" when never; "Today, {time}" for the same day in India time; then "1 day ago", "3 days ago", "2 months ago" (the same words as the listing cards).
- **After inviting**, the drawer turns into "Builder invited" with the sign-in address and a Copy button, and a toast says "Builder invited". Nothing is emailed (DEC-27). "Resend invitation" (only for an invited builder) shows the same drawer titled "Sign-in address".
- **Deactivate asks first** (the dialog of the approved UX); Activate happens at once. Both say so in a toast, and the page is read again after every change.
- **Failures:** a box's own message (for example the reserved email) appears on that box and the drawer stays open; anything else is a toast, with a short sentence for a conflict (a builder changed or signed in meanwhile), and the page is read again.
- **Not in this change:** the list does not page (builders are few; a shared admin table with paging is S7-T01), and builders' projects are not shown.

## Wording to confirm

All messages are in `en.json` under `admin.builders`. Those from the approved UX file or ADR-076 are unchanged. New, for your confirmation:

- The edit drawer's line: "Change the details of this builder. The login email stays the same." and its button "Save changes".
- The edit toast: "Details saved" with "The builder's details have been updated."
- The activate toast: "Builder activated" with "{name} can sign in again." and the deactivate toast: "Builder deactivated" with "{name} can no longer sign in to the builder portal."
- The conflict toast: "This builder has changed since the page was loaded. The page has been refreshed."
- The resend drawer's title: "Sign-in address" (the invite one stays "Builder invited"); the table's screen-reader caption "Builders and agents".

## Consequences

- No migration, package, gate or environment change. The two earlier parts must be merged first (this branch contains them).
- Rollback: restore the route to the placeholder and remove `BuildersBoard`, `form.ts`, the messages and the tests. Nothing is destroyed.
