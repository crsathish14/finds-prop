# ADR-074 · Mail adapter hook points, used by nothing yet (S6-T07)

- Status: Accepted
- Date: 2026-11-08
- Related: DEC-27, ADR-035 (message keys), R-BE-09 (adapters), R-BE-10 (no personal data in errors or logs)
- Plan approved by the owner on 8 Nov 2026 ("all recommended"): the interface, a fake, a sender that drops the message, typed events, tests and this note; no provider and no call from any action.

## Decision

- **Mail goes through one interface, as SMS does.** `src/server/mail/` holds `MailSender` (one `send` of a plain-text message to one address; an implementation gives up after `MAIL_TIMEOUT_MS`, 3 seconds, and throws only an `UPSTREAM_FAILED` that says nothing about the address or the text), a fake that remembers what it was asked to send (and can be made to fail), and a no-op sender.
- **No provider is chosen, so every environment gets the sender that drops the message.** DEC-27 makes mail on an enquiry or an approval a post-launch decision. Unlike the SMS sender, the chooser does not refuse in staging or production: a login code that cannot be sent locks a person out, a notification that is not sent costs nothing they were promised. When a provider is added, it is chosen in `chooseMailSender`, with its keys read from `src/server/env.ts` in the same PR.
- **Three typed events name the hook points** (`enquiry.received`, `listing.approved`, `listing.rejected`), with ids only. The sender's name, phone and message are read where a mail is made, never carried in the event. A `Notifier` is where an action will hand an event over after its write succeeds, and it never throws into that action: telling someone is not a reason for what they did to fail. `silentNotifier` is the one in use, and it does nothing.
- **Nothing calls any of it.** No action, page or hook imports `src/server/mail`. Wording for the mails is not written (it would be new visitor-facing text and needs the owner's approval with the decision itself).
- **Not in this change:** a provider, an environment variable, mail wording, a notification centre, any call from an action.

## Consequences

- No migration, package, gate, message or environment change. One module, one test file.
- Rollback: delete `src/server/mail/`. Nothing else imports it.
