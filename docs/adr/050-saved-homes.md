# ADR-050 · Saved homes (S5-T01)

- Status: Accepted
- Date: 2026-11-06
- Related: ADR-044 (compare: the browser-held selection), ADR-049 (the dashboard shell), ADR-017 (public projections), `docs/ux/final-ux/screens/dashboard.html` (Saved), FR-ACC-02, BR-53, BR-54, BR-06
- Plan approved by the owner on 6 Nov 2026 with the recommended answers: a return after sign-in saves the home once, with a confirmation; a home that was sold, rented or withdrawn leaves the Saved tab without a word; no rate limit on saving; the wording is built as flagged and is not yet approved.

## Decision

- **Saving is a row per visitor and home** in `saved_properties`, written as the signed-in visitor through their own session. The database sets the visitor from the session, and the row rules let a visitor write only for a home they can see and only with a verified phone. No migration was needed.
- **Saving twice changes nothing.** A repeated save is treated as saved, so a double tap or a retry is safe. Removing a home that is not saved, or that is no longer visible, is not an error.
- **A home the visitor cannot see is "not found"**, whatever the reason, so nobody can learn about a home that is not listed.
- **The Saved tab** lists the visitor's saved homes that the database still shows. The list uses an inner join, so a home that was sold, rented or withdrawn drops out without a message. It reads the public home for each row, so it uses the same cache as a home page. It is capped at 60, the newest first.
- **The saved state is read in the browser, not in the cached pages.** The results page and homepage stay public and cached. One read asks the server who is signed in and which visible homes they saved. Nothing about one visitor's saves enters a shared cache.
- **A tap changes the set at once** and asks the server to match. A refusal puts the set back and says so.
- **Signed out, a tap sends the visitor to sign in** with `gate=save` and a return address that is the current page, including its query. The home is remembered for this tab only (`sessionStorage`). Once the visitor is back and signed in, it is saved once, with a confirmation. Sign-in checks the return address as it always does (BR-06). If the browser refuses storage, the visitor taps Save again.
- **No rate limit.** A save is one row per visitor and home, so a repeat costs nothing and the unique row stops duplicates.

## Consequences

- Save is on the results page, the homepage sections, the property page (as a button beside Add to compare) and the Saved tab. Compare keeps its own control.
- The sign-in page has a new gate value, `save`, with two new words.
- Not tried against a real account or real homes: `findsprop-dev` has no homes, so the Saved tab, the removal of a hidden home and the return after sign-in are checked with fakes and in the CI database tests. A live sign-in with a verified phone is needed to see them end to end.
- Shortlist events (the project page) and the Save on project pages are not part of this change (the projects page has no Save).
