# ADR-197 · The email prompts: one address on the dashboard, a way to fix a typo, and a page that goes back (customer email, part 3)

- Status: Accepted. The owner answered "all recommended" on 24 Nov 2026 to the three questions below, after finding each one on dev. No new words: every string already exists in `en.json`.
- Date: 2026-11-26
- Related: ADD-03 (the email prompts and the posting gate), ADR-186 (the contact email for enquiries), ADR-195, ADR-196, `docs/runbooks/customer-email.md`
- Class: C1 (screens inside the approved patterns; one state, "Use a different email", exists in the approved sign-in design and is reused in two places that did not draw it).

## Context

The first live test of the customer email on dev found three things the plan had not covered:

1. **Two email boxes on the dashboard.** An owner with a home and no verified email saw the account prompt ("Add your email to post a property and get updates") and, under it, the box for enquiries ("Add your email to get enquiries by email"). Since ADR-196 confirming the first fills the second, so asking for both is asking for one address twice.
2. **No way to fix a mistyped address after the link was sent.** The sign-in step has "Use a different email". The dashboard reminder and the posting gate showed only "Send again", so a typo left the customer stuck (the plan wrongly said the way to change it existed there).
3. **The "Email verified" page always led to posting.** Its one main button was "Continue to post a property", even for someone who had asked for the link to browse.

## Decision

- **Dashboard.** While the account email is being asked for or waited on, the box for enquiries is not drawn. With no address the prompt gets the box as a fallback that appears only when "Later" puts the prompt away (the person who skips the account email can still give an address for enquiries). With a link waiting, the box is not shown at all. Once the email is confirmed, or its state cannot be read, the box is drawn as before.
- **"Use a different email"** (the approved sign-in wording, `auth.email.different`) is added to the "link sent" state of the dashboard reminder and the posting gate. It goes back to the field, started from the address that was sent so only the slip needs fixing; sending replaces the pending address.
- **The "Email verified" page goes back to where the link was asked for.** Each place that sends the link (the sign-in step, the dashboard prompt, the gate) remembers one of two answers in this browser's storage (`src/lib/email-origin.ts`): posting or the dashboard. The page offers "Continue to post a property" as its main button, with "Go to my dashboard" as the quiet link, only when the answer is posting; otherwise "Go to my dashboard" is the one main button and posting is not pushed. Only these two answers are ever stored, so nothing from the address bar is stored or followed. A link opened on another device, or with storage refused, gets the dashboard.

## Consequences

- The Design Lab picture of the dashboard's "link sent" reminder changes (a second, quiet button); its baseline is renewed from CI after the owner has seen it.
- Tests: the prompt (different email, the fallback), the gate (different email, the remembered origin), the dashboard page (the box held back, handed over, or drawn alone), the verified page (both origins), and the storage helper.
- Not changed: the email link's address (so the Supabase template stays as in the runbook), the sign-in email step's own behaviour, the database and the enquiry mail.
- Rollback: revert the change; nothing is stored on the server.
