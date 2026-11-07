# ADR-062 · The post-property pages (S6-T02, part 4)

- Status: Accepted
- Date: 2026-11-07
- Related: ADR-060 (database side), ADR-061 (server side), ADR-059 (photo uploader), ADR-057 (session ended), FR-ACC-06, FR-ACC-08, addendum ADD-03 (email gate)
- Plan approved by the owner on 7 Nov 2026, "All recommended", with the wizard wording.

## Decision

- **Two routes.** `/post-property` is a new listing with "Your drafts" above it when there are any. `/post-property/[id]` continues one of the person's own drafts. An address that is not a listing id, a listing that is not theirs and one that does not exist all give not found; a listing that is no longer a draft leads to `/dashboard?tab=listings` (editing those is S6-T05). The bottom bar is an allowlist of pages, so it is already hidden on both.
- **The email gate comes first.** A person with no email, or one whose link is not used yet, sees the gate (`PostingGate`, on `GateCard`) instead of the wizard. A person whose email state could not be read goes on to the wizard, because the database needs no email to hold a draft. The gate uses the S3-T09 actions `addEmail` and `resendEmailLink` and asks the server again whenever the tab comes back into view, so the page turns into the wizard by itself once the address is confirmed.
- **One client component holds the wizard's state** (`PostingWizard`, plain React state; React Hook Form is not installed, and a new dependency was not needed). The rules are the schemas of `schemas.ts`, the same ones the server applies: Continue checks only the current step (`validateStep`), names each field, and moves focus to the first one; Back keeps everything. The first Continue starts the draft (the photos need a listing to belong to) and moves the address to `/post-property/<id>` with `history.replaceState`, so nothing is thrown away. Every later Continue saves the step; "Save draft" saves all boxes that pass their rules.
- **Photos** use `PhotoUploaderConnected` from ADR-059 on step 3 (up to six, "Up to 20 MB each"), and Continue is held while a photo is on its way. At least one photo is asked for on step 3 and again by the server at submit, so a stale tab cannot skip it.
- **Submit** calls `submitListing` with a one-time key (kept across retries). On success the person sees a toast and lands on My listings; a refusal keeps every answer, marks the steps that need fixing on the list of steps and takes the person to the first one; a limit, a rate limit or a failure shows an alert. An ended session shows the existing "Sign in again" notice and keeps what was typed for the way back (`sessionStorage`, 30 minutes, ADR-057).
- **The wizard's actions are handed in by the page** (`PostPropertyScreen`), as the other connected forms do, because a client component cannot import a server action.
- **No end-to-end test in the browser job.** The CI browser job runs without Supabase, so a journey that signs in and uploads cannot run there. The journey is covered by a component test that runs all five steps against the real components and a stand-in for the actions (`wizard.test.tsx`), the server side by `IT-actions-listing` against the real database (ADR-061), and the page rules by `post-property-page.test.tsx`. The full E2E-06 (approve, search, mark sold) waits for the admin queue (S6-T04).

## Consequences

- About a hundred new messages under `postProperty.*` and nothing else in `en.json`. **Approved by the owner on 7 Nov 2026:** the wizard wording from the approved UX. **New and not yet confirmed:** "Not specified" (furnishing), "Photo {number}", "Untitled draft", "Saved {date}", the delete-draft dialog ("Delete this draft?", "Its photos are deleted too. This can't be undone.", "Delete draft", "Keep it"), "Draft deleted" and "We couldn't delete the draft. Please try again.", and the draft-saved toast body, which says "You can pick it up again from Post a property." instead of the UX's "from My listings" (drafts are listed on Post a property until My listings is built, S6-T03).
- The real-phone check of the photo step (S6-SPK-01) can now be done on `/post-property/<id>`.
- The pin on a map is not part of this change (ADR-060): a listing is submitted without coordinates.
