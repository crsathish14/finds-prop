# ADR-052 · The enquiry card and My enquiries (S5-T03, second change)

- Status: Accepted
- Date: 2026-11-06
- Related: ADR-051 (the enquiry backend), ADR-043 (the property page), ADR-049 (the dashboard shell), ADR-046 (the project lead card, whose connection this follows), `docs/ux/ux-addendum/screens/consent-snippets.html` (ADD-12), `docs/ux/final-ux/screens/dashboard.html` (My enquiries), FR-ACC-03, FR-ACC-05, BR-50, BR-51
- Plan approved by the owner on 6 Nov 2026 with the recommended answers. The owner approved building the consent line from the UX placeholder, flagged as a placeholder until the owner's legal text exists (DEC-25).

## Decision

- **The form is live.** On the property page, a signed-in visitor sees the enquiry card (from 1024 px) or the phone's sheet with Send on. `useEnquiryForm` connects either to the action `sendEnquiry` (ADR-051). It makes one idempotency key when the form opens, so a retry stores one enquiry, and it draws what comes back: the confirmation, "already sent", the field messages, "please wait", "this is your own home", or "try again" with what was typed kept.
- **The server action is handed to the client as a prop**, from the server slot (`EnquiryPanel`, `MobileEnquirySlot`), as the email prompt does. A client file cannot import a feature's index (it also holds server-only reads), so nothing in `property/` reaches into `enquiries/` from the browser side. The client does no schema check of its own: the server checks first, and a bad request costs no rate-limit count.
- **The phone is prefilled and editable** (owner's decision, 6 Nov 2026): the form starts with the account's name, the sign-in number as digits and the verified email, all read on the server (the number from the verified token). A visitor can give the owner a different number. A failure to read them gives an empty form, not the sign-in gate.
- **Answers, by the code the server gives:** a conflict is "already sent" (a state with a link to My enquiries); a rate limit is "please wait a little"; forbidden without the phone reason is "this is your own home" (Send switched off); a field error goes under its field; anything else is "we couldn't send", with the form kept.
- **The consent line** sits under Send in the card and the sheet: "The owner will see your name, phone number and message so they can reply. We don't show your details to anyone else." with a Privacy Policy link to `/privacy`. **It is the UX placeholder, built at the owner's instruction, and is not final legal text** (DEC-25). `/privacy` is still a placeholder page until S5-T06.
- **My enquiries** (`?tab=sent`) lists the visitor's sent enquiries, newest first, up to 60: the home as a link, "Sent 2 hours ago", the reply status as a read-only badge ("Waiting for owner" for a new enquiry, "Contacted", "Closed") and the message. The read asks for the visitor's own rows by name, because the database also lets an owner read enquiries on their own homes, and those are not "sent" by them. A home that is no longer shown (sold, rented, withdrawn) leaves the row in place with "A home that is no longer listed", no link, and its time, status and message (owner's decision: keep the history).
- **Not changed:** the enquiry is not shown to the owner yet (Enquiries received is Stage 6); no email or SMS is sent to the owner (S6-T07 hook points).

## Consequences

- The shared `EnquiryCard` gained the consent line, `rateLimited`, `ownHome` and the `already` state; its Domain Lab pictures change, as do the Discovery board's (the My enquiries list on the Dashboard entry). Baselines follow in their own commit after the owner approves the pictures.
- The line "Sending enquiries is not open yet." is removed.
- Not tried against a real account: `findsprop-dev` has no homes, so the send, the already-sent state and the list are checked with fakes and in the CI database tests. A live sign-in with a verified phone is needed to see them end to end.
- New visitor-facing words (flagged in the pull request, not yet approved): the consent line, "You already contacted this owner", "Your earlier enquiry is in My enquiries, with its reply status.", "Please wait a little" with its line, "This is your own home" with its line, "A home that is no longer listed", "Sent {when}", and the times ("just now", minutes and hours ago).
