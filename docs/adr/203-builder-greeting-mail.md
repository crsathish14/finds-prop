# ADR-203 · An invited builder or agent is greeted by email with the sign-in link and the kind of account

- Status: Accepted in part: the owner asked for the mail on 26 Nov 2026 ("the builder should receive a greeting email from findsprop with the builder login link; the email should also mention the type"). The default wording below is **not approved** yet.
- Date: 2026-11-26
- Related: ADR-010 (builders and agents sign in with Google only), ADR-075 (the invitation; its "nothing is emailed" is replaced here), ADR-181 (the sender and the test list), ADR-188 (mail after the answer, by `after()`), DEC-27 (no mail in v1, already reversed by ADR-181)
- Class: C1 (new mail, no migration, no dependency, no new table). New words: the mail's wording and one line on the admin's drawer.

## Context

When the admin adds a builder or an agent, the account is made with a confirmed email and the drawer shows the sign-in address for the admin to copy and pass on (ADR-075). The admin had to send it themselves. The owner wants the person to get a greeting from findsprop with the sign-in link, saying which kind of account they were given.

## Decision

- **`inviteBuilder` mails the person after it succeeds.** Once the record, the account and the link are all stored, the action hands the greeting to `sendInvitationMail` inside `after()`, so the admin is answered first and never waits for the provider. A failed or refused invitation sends nothing. A mail that fails is logged (the kind and the failure code, never the address or a word of the text) and never changes the answer; the admin still has the address on screen.
- **The mail** goes to the login email, from the same sender as the enquiry mails (ADR-181: nothing without `RESEND_API_KEY`, never from a developer's machine, only `MAIL_DEV_ALLOWLIST` addresses on dev and staging). It says the person's name, that they were added as a **Builder** or an **Agent** (`Account type: Builder`), the sign-in address (`/builder/login`, built from `NEXT_PUBLIC_SITE_URL`, never from a request) and that they must use the Google account for that email. It holds no password (there is none) and nothing about anyone else.
- **Resend invitation sends the same mail again**, for a builder who has not signed in and is active (the rule of ADR-075 is unchanged). The mail's facts (name, email, kind) are read from the stored record, never from the browser.
- **Wording is code, not editable** on the Admin, Emails screen in this change (that screen holds the two enquiry mails). Making it editable is a later change if the owner wants it.
- **The drawer line** after inviting now reads "We have emailed them this address. You can also copy it and pass it on." (it said "Nothing is emailed").
- **No daily cap**: only the super admin can reach the action, and it is already counted under the `admin_decision` rate limit.

## Words (default, unapproved)

Subject: `Welcome to findsprop: you have been added as a Builder` (or `an Agent`). Text: greeting by name; "Welcome to findsprop. You have been added to findsprop as a Builder."; `Account type: Builder`; "Sign in here with Google:" and the address; "Please use the Google account for <email>. There is no password to remember."; "If you were not expecting this, you can ignore this email."

## Consequences

- **Privacy:** the builder's email already sits in our records (the admin typed it); it is now also given to Resend to send this one mail, the same processor as the enquiry mails. Nothing else is shared.
- **Until the Resend domain is verified and a key is set, nothing is sent** (the mail is dropped and the app works); the drawer line would then say something untrue on that deployment. The runbook `enquiry-mail.md` (setup steps) applies to this mail too.
- **Tests:** `invitation-mail.test.ts` (words, the type for a builder and an agent, no placeholder left, a fake sender, a failing provider never throws and logs no address); the service test (resend returns the facts); the integration test of the store reads the new fields.
- **Rollback:** remove the two `after()` calls in `actions.ts`; nothing is stored.
