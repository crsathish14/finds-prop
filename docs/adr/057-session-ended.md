# ADR-057 · When the session ends in the middle of a form (S5-T07)

- Status: Accepted
- Date: 2026-11-06
- Related: ADR-010 (authentication design, which left session edge cases to this task), ADR-050 (saved homes), ADR-051 (the enquiry), ADR-046 and ADR-056 (the project's enquiry card and its own form), BR-06 (return addresses), BR-54 (save, sign in, return)
- Plan approved by the owner on 6 Nov 2026, "All recommended": an alert with a link, not an automatic redirect; what was typed is kept only when the visitor presses "Sign in again"; the phone is never restored; a different account may sign in; one pull request.

## Decision

- **What counts as "the session ended":** an action refused with `UNAUTHENTICATED`, or with `FORBIDDEN` and the reason `PHONE_NOT_VERIFIED` (an account with no phone code behind it). `isSessionEnded` (`src/lib/session-ended.ts`) says so in one place. A plain `FORBIDDEN` is still "this is your own home" on the enquiry card.
- **The four screens that need a signed-in visitor now say so** instead of the generic "We couldn't send, try again", which could never work: the property enquiry card (and the phone's sheet), the project's built-in enquiry card, a project's own form, and the heart. The three forms draw `SessionEndedAlert` (`src/components/domain/session-ended-alert.tsx`): "Your session has ended", "Sign in again to send this. What you typed will be kept.", and a **Sign in again** link. The typed answers stay in the form. Nothing is sent and nothing is lost.
- **Sign in again** leads to `/auth?gate=expired&redirect=<this page>` (`sessionEndedHref`; the project cards add `#enquiry`). The sign-in page shows a third lead-in for `gate=expired`: "Sign in again to carry on" and "Your session ended. We will take you back to where you were, with what you typed kept." The return address is checked by sign-in as before (BR-06).
- **What is kept, and how:** pressing the link first calls `saveDraft` (`src/lib/form-draft.ts`), which writes the answers to `sessionStorage` under the form's name and the page's address (without its query). Never as the visitor types, and never just because the session ended. It lives in this tab only, expires after 30 minutes, holds at most 20 answers, each cut to 5000 characters, and is removed the moment it is read (`takeDraft`; a second form on the same page, the card and the phone's sheet, receives the same answers from memory). Storage that is blocked or full means the answers are not kept; nothing else breaks. A successful send removes any kept answers (`dropDraft`).
- **What is left out:** the enquiry card's phone and a project form's locked phone are never kept or restored; after signing in again, the phone comes from the new session. No other account's data can arrive this way: the answers are the visitor's own words in their own tab. If a different account signs in, the same tab's answers are restored on that page (the plan's decision 4).
- **The way back:** on return, `useRestoredDraft` (empty on the server and on the first paint, filled once the page is in the browser) hands the answers to the form, which starts again with them (the form is given a new `key`), and a notice says "We kept what you typed." once. On a phone, the enquiry sheet opens by itself with the answers in it.
- **The heart:** a "not signed in" or "phone not verified" answer is treated as the visitor being signed out: the home is remembered for this tab (the existing pending save), the tab is marked signed out, and the visitor goes to sign-in with the existing "Sign in to save homes" words. Coming back saves it once, as before.
- **Sign-out itself is unchanged:** the Sign out button, its action and its "could not sign out" message are from S4-T06 and keep working; a second tab left open after signing out finds out at its next send, and now says so.
- **Not changed:** the contact form (open to everyone, no session to lose), the dashboard and other signed-in pages (an ended session already sends the visitor to sign-in and back).

## Consequences

- All five wordings are new and **not approved**: "Your session has ended", "Sign in again to send this. What you typed will be kept.", "Sign in again", "Sign in again to carry on" with "Your session ended. We will take you back to where you were, with what you typed kept.", and "We kept what you typed." The UX has no designed state for this.
- Not tried against a real session (no live sign-in here). The owner's check: sign in on a property page, delete the Supabase cookie in the browser's dev tools (or sign out in another tab), press Send, and watch the alert, the sign-in and the return with the text kept.
- The roadmap rates this task S; with three forms, the heart and the sign-in page it came out larger, in one pull request as agreed.
