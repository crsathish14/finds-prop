# ADR-199 · The "Email for enquiries" box is optional once the account email is confirmed (customer email, part 5)

- Status: Accepted (owner, "all recommended", 24 Nov 2026). No new words: the box keeps its label, hint and errors.
- Date: 2026-11-26
- Related: ADR-186 (the contact email and its required box), ADR-195, ADR-196, ADR-198 (the poster mail falls back to the confirmed account email)
- Class: C1 (a rule inside the approved wizard and an existing server rule). The server rule is the one ADR-186 added to `sendForReview`; no schema change.

## Context

The last step of the post-property wizard asks for "Email for enquiries" and refuses Submit without one (ADR-186). Since ADR-198 the poster mail goes to the confirmed account email when there is no contact email, so a person with a confirmed email would be asked for an address we already use.

## Decision

- **The box stays on the screen, filled in, and editable** (ADR-196 starts it from the confirmed address). With a confirmed account email it may be left empty: Submit goes through, sends no address, and the mail goes to the account email. An address typed in the box is still checked and is what enquiries are mailed to.
- **Without a confirmed account email nothing changes**: the box is required, as in ADR-186 (this is also the case wherever `FLAG_CUSTOMER_EMAIL` is off).
- **The server enforces the same rule** (R-DB-07): `sendForReview` refuses a submit with no address given and none saved only when `has_verified_email()` is also false. The check is a call to the existing database function as the signed-in person; it is asked only when it matters (an address given or saved is never followed by it).
- A rejected listing that is sent again follows the same rule.

## The enquirer's box (the optional email on a home's enquiry card)

Already built before this change and unchanged: for a signed-in visitor the card starts the optional email from the account's email (the token's email claim, `getEnquiryContact`), and the box stays optional and editable. It is empty for an account with no confirmed email, and it fills after the visitor's session carries the confirmed address (the same browser after the link; another device after the token is next refreshed). No change was needed.

## Consequences

- **Tests:** the service (a confirmed email counts, with none it still refuses, the check is not made when an address is given or saved), the box rule (empty allowed only when optional, a typed slip still refused), the wizard (Submit with the box empty sends no address; a typed address is checked and sent), and the page (the box is optional only when the email state is verified).
- **Not changed:** the database, the enquiry mail, the dashboard card and the words.
- **Rollback:** revert the change; nothing is stored.
