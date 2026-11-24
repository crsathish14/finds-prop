# ADR-181 · Enquiry mail goes through Resend (part 1: the sender)

- Status: Accepted for part 1 (the sender and its settings). Parts 2 to 5 follow in their own pull requests: the poster's email on homes, editable mail templates, the calls from the enquiry actions, and the runbook with one live send. Plan approved by the owner on 24 Nov 2026 ("Approve, start PR 1").
- Date: 2026-11-24
- Related: ADR-074 (mail adapter hook points), DEC-27 (mail on enquiry and approval was post-launch), R-BE-09 (adapters), R-BE-10 (no personal data in errors or logs), ADR-126 (the SMS adapters this one follows)
- Class: C2 (new provider, new environment variables)

## Decision

- **DEC-27's deferral ends for enquiries.** The owner wants two mails when someone sends an enquiry about a home or a project: one to whoever posted it, one to the enquirer (only when they typed an email). ADR-074 stays as the record of the hook points; this ADR replaces its rule that no provider is chosen. Mail on an approval or a rejection is still not decided.
- **The provider is Resend, on its free plan.** The sender is `no-reply@findsprop.com` and replies go to `support@findsprop.com`. The domain must be verified in Resend first (DNS records on a `send` subdomain; the existing Google mail records stay).
- **One adapter, no package.** `src/server/mail/resend.ts` makes one HTTPS POST to Resend's `/emails` with the key in the `Authorization` header. It gives up after `MAIL_TIMEOUT_MS` (3 seconds), follows no redirect, and throws only `UPSTREAM_FAILED`. The words say the HTTP status and, when Resend's error body carries a short snake_case `name` (such as `daily_quota_exceeded`), that name. They never contain the key, the address, the subject or the text, and Resend's own `message` is never read because it can repeat the address.
- **Which sender each environment gets** (`chooseMailSender`, which now takes the settings as an argument like the SMS chooser):
  - no `RESEND_API_KEY`: the sender that drops the message, in every environment. Unlike SMS it never refuses, because a notification that is not sent costs nobody anything they were promised, and a deployment without a key must still start;
  - `local`: always the sender that drops the message, even with a key, so a developer's machine never mails;
  - `dev` and `staging`: Resend, but only to the addresses in `MAIL_DEV_ALLOWLIST` (an exact address, or `@domain` for a whole domain; an empty list mails nobody). They share the domain and the daily allowance with production and hold test data, so real people must not be mailed from them;
  - `production`: Resend, to whoever the message is for; the allowlist is ignored.
- **New settings, all in `src/server/env.ts` and `.env.example`:** `RESEND_API_KEY` (optional secret), `MAIL_FROM` (default `no-reply@findsprop.com`), `MAIL_REPLY_TO` (default `support@findsprop.com`), `MAIL_DEV_ALLOWLIST` (optional).
- **Not in this change:** any call from an action, any email on a form or in the database, mail wording, the template editor, a rate limit for mail, a bounce handler. Nothing sends yet: the sender is chosen but no code asks it to send.

## Consequences

- **The free plan is small:** about 3,000 mails a month and 100 a day, a short log. (Resend's pricing page of 24 Nov 2026 lists three verified domains, not one; see `docs/runbooks/enquiry-mail.md`.) Two mails per enquiry means about 50 enquiries a day. Past the limit Resend refuses and the sender throws `UPSTREAM_FAILED` with `daily_quota_exceeded`; the later calls will log that and carry on, because a mail never fails an enquiry. If it ever matters, the paid plan or another provider is one new adapter file.
- **Dev and production share the key's domain,** so the allowlist is the only thing that keeps dev from mailing real people. Keeping the allowlist empty by default is deliberate.
- **Owner steps outside the code:** verify `findsprop.com` in Resend, create a new sending key, set `RESEND_API_KEY` in Vercel (Preview and Production) and in `.env.local`, and set `MAIL_DEV_ALLOWLIST` on dev. The key is never pasted in chat.
- Rollback: delete `resend.ts`, `allowlist.ts` and their tests, restore `chooseMailSender()`, remove the four settings. Nothing else imports them yet.
