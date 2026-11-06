# ADR-049 · The dashboard shell (S5-T04)

- Status: Accepted
- Date: 2026-11-06
- Related: ADR-010 (authentication design), ADR-040 (the address holds the view), `docs/ux/final-ux/screens/dashboard.html`, `docs/ux/ux-addendum/screens/email-prompts.html` (ADD-03), FR-ACC-01, FR-AUTH-02, R-FE-11
- Plan approved by the owner on 6 Nov 2026, with the recommended answers to five questions (listed under "Owner's answers").

## Decision

`/dashboard` is a signed-in page with a heading, a "Post a property" button, an email prompt or reminder, and four tabs: Saved, My listings, Enquiries received and My enquiries. Each tab shows its approved empty state. The lists come with the tasks that fill them: Saved (S5-T01), My enquiries (S5-T03), My listings and Enquiries received (Stage 6). Each of those takes the place of the empty state when it has rows.

- **Feature:** `src/features/account`. The route file only composes (R-FE-04): it reads the tab, the person and the email state, and gives `DashboardScreen` the pieces. `DashboardScreen` fetches nothing and holds no state, so the Design Lab draws every state with sample content.
- **The tab lives in the address** (`?tab=saved|listings|received|sent`, R-FE-11). `parseTab` accepts the four names and drops anything else; a missing or unknown value shows Saved, with no redirect, so the account menu's `?tab=saved` links and the plain `/dashboard` show the same tab. `tabHref` leaves the default out.
- **Only the active tab's content is made.** The page builds one panel, and choosing a tab changes the address (`router.replace`, no scroll) inside a transition. The chosen tab is marked at once (`useOptimistic`) and the panel shows a few waiting rows until the server has the new content. A tab with a long list is therefore read when it is opened, not before.
- **The gate is the account layout's** (`PageGate` area `customer`); the page renders nothing for a visitor who is not signed in, because that redirect is already on its way. The page is never indexed (the layout says so).
- **No counts yet.** The roadmap lists tab and menu counts. Nothing can produce one before its list exists (no saved homes, no sent enquiries, no listings), and a count on every tab would add four reads to every signed-in page, because the header runs on all of them. Each count arrives with its list. The account menu's "new" count on Enquiries received arrives with S6-T03; it also changes the shared account-menu component.
- **Profile completion is the email.** The name step happens at sign-in and may be skipped (it is asked again before posting or enquiring), and the approved UX has no dashboard prompt for it. A person with no name sees the heading line without a name; no prompt was invented.

## The email prompt and reminder (ADD-03)

- **Where the email stands** (`emailStateFrom`, pure): a confirmed address is "verified" and nothing is asked, even while a change to another address waits (posting needs one verified address, not the newest one). An address a link was sent to that is not confirmed is "pending" (the reminder). No address is "none" (the card). A read that fails is "unknown": nothing is shown rather than a wrong state, and the failure is logged by its code, never the address.
- **The read** (`getEmailState`) asks Supabase Auth for the account (`getUser`), because the address a link was sent to (`new_email`) is not in the token. The server checks the token on that call. It runs once per request. Identity everywhere else still comes from `getClaims()`.
- **The card** (no address): a labelled field, "Send link" and "Later". It never blocks browsing, saving or enquiring. "Later" is remembered in this browser only (`localStorage`, every access guarded, a copy in memory for the visit), so it can come back on another device. The card is not drawn on the server or in the first browser render, so a person who chose Later never sees it flash and go; a person who did not sees it appear a moment after the page.
- **The reminder** (a link was sent, from this page or earlier): "Verify your email to post a property", the address, "Send the link again" and the badge "Email not verified" beside the heading line. It cannot be dismissed. After a send the wait before sending again is the one the server gives (`resendAfter`), and a rate-limited answer's own wait is shown.
- **Sending is the S3-T09 actions** (`addEmail`, `resendEmailLink`), passed to the island as props by the page. They check the sign-in and the verified phone, limit sends to 5 per user per hour and 20 per address per day, and never mark anything verified: that happens only when the link is followed at `/auth/confirm`. The "address cannot be used" answer gives no reason, as on the sign-in email step.
- **Words** reuse the sign-in email step's where they are the same ("Email address", "Send the link again", "Send again in {time}", the "cannot be used" note, "We sent it again" for screen readers). New words are under `account.dashboard` in `en.json`.

## Owner's answers

Counts come with each list; the menu's "new" count waits for Stage 6; no name prompt; "Later" is kept in the browser; a failed email read shows nothing.

## Consequences

- Nothing visible changes for a visitor who is not signed in.
- No migration, no new dependency, no change to CI or the gates.
- **Not tried against a real account.** The email states need a live sign-in with the Supabase email setup (a verified sender domain in Resend, the "Change email address" template and the redirect URLs), which are the owner's steps. The read, the state rules, the prompt and the reminder are tested with fakes, and the Design Lab shows every state on the Discovery board ("Dashboard page").
- The Docker-only checks (`check:db`, pgTAP, the integration tests and `gen-types --check`) have nothing new to run here and still run in CI.
