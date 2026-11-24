# Enquiry mail: setting it up, checking it, switching it off

When someone sends an enquiry about a home or a project, findsprop can email the person who posted it and, if the enquirer typed an email, the enquirer. The mail goes through Resend. This page is for the owner and whoever runs the site: how it works, the one-time setup, how to read the logs, and how to stop it. The decisions are in ADR-181 (the sender), ADR-183 (the editable wording), ADR-186 (the poster's contact email) and ADR-188 (the calls from the enquiry actions). The list of every setting is in `environment-variables.md`.

**Status when this page was written (24 Nov 2026):** the code is merged and ready, but **nothing mails anyone yet**, because the Resend domain is not verified and `RESEND_API_KEY` is not set in Vercel. Until both are done the app drops every mail and keeps working. Everything marked _(not verified)_ below could not be checked from the repository.

## How it works

1. A visitor sends an enquiry about a home (the enquiry card) or a lead about a project (the project's form, including a site visit request). The action stores it and answers the visitor as it always did.
2. Only after the row is **stored**, the action hands the enquiry's id to the mail code, which runs after the answer is sent (`after()`), so the visitor never waits for the mail provider. A duplicate enquiry (the same visitor and home within 24 hours), a refused value, a rate-limited call, the owner's own home or a repeated form are never stored, so they send nothing.
3. The mail code reads what it needs by the id, counts the enquiry once against the poster's daily cap, fills in the wording and sends up to two mails, each on its own (if one fails the other is still tried):

| Mail                      | To                                                                                                                                                  | When                                                                                                                                                                                    | What it says (default wording, unapproved)                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Poster mail**           | A home's **contact email** (`profiles.contact_email`, private, ADR-186), or a project's **builder email** (`builders.email`; an agent is a builder) | Every stored enquiry or lead, unless the poster has no address on file (an existing home owner who has not added one yet: they get no mail, the enquiry still shows on their dashboard) | "You got an enquiry from {name}". Names the enquirer only: **no phone number and no enquiry text**. Links to their dashboard and to the home or project page.                 |
| **Enquirer confirmation** | The email the enquirer typed (the field is optional)                                                                                                | Every stored enquiry or lead where they typed one, including site visit requests, even when the poster has no address                                                                   | "We sent your enquiry about {title}". Says it was passed on to the owner (no promise of a reply). Links to the page. Holds no phone, no message and nothing about the poster. |

A home with no title is called "a home" in the mails. All wording above is the default in code (`src/lib/mail-template.ts`); the super admin can replace it (see "Edit the wording").

**Nothing is verified about the addresses.** The poster's address is typed by them and never checked by a link, so a typo bounces or reaches a stranger. The enquirer's address is whatever they typed.

## What mails in each environment

| Environment                           | Sends?                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| No `RESEND_API_KEY`, anywhere         | **Nothing.** The mail is dropped and the app works as usual. This is also how mail is switched off       |
| `APP_ENV=local` (a developer machine) | **Never**, even if a key is set                                                                          |
| `dev` and `staging`                   | **Only** the addresses in `MAIL_DEV_ALLOWLIST`; any other address is skipped. An empty list mails nobody |
| `production`                          | Whoever the mail is for. The allowlist is ignored                                                        |

Dev, staging and production **share the one Resend domain and its daily allowance**, so the allowlist is the only thing that stops dev from mailing real people. Never put a real customer's address on it.

## One-time setup

Do these in order. Never paste the key into chat, a file in the repository, a screenshot or an issue. If it ever appears there, delete it in Resend at once and make a new one.

1. **Verify the domain in Resend.** In Resend, Domains: add `findsprop.com`. Resend shows DNS records (they normally sit on a `send` subdomain, so the existing Google Workspace mail records stay as they are; check that nothing asks to replace an existing SPF record). Add them where the domain's DNS is managed (Vercel, Domains, DNS records, if the domain's nameservers are Vercel's). Click Verify and wait until the status is **Verified**; it can take from minutes to a day. _On 24 Nov no Resend records existed on the domain yet._
2. **Create a sending-only key.** Resend, API Keys, Add: permission **Sending access**, domain `findsprop.com` only. Name it for what it is for (for example `findsprop-enquiry-mail`). Copy it once; Resend never shows it again. Do not reuse a key that was ever pasted into chat.
3. **Set the variables in Vercel** (project `findsprop`, Settings, Environment Variables). Mark the key as Sensitive.

   | Variable             | Value                                                                                   | Preview (dev, staging) | Production |
   | -------------------- | --------------------------------------------------------------------------------------- | ---------------------- | ---------- |
   | `RESEND_API_KEY`     | the key from step 2                                                                     | yes                    | yes        |
   | `MAIL_FROM`          | `no-reply@findsprop.com` (this is the default; set it only to change it)                | optional               | optional   |
   | `MAIL_REPLY_TO`      | `support@findsprop.com` (the default)                                                   | optional               | optional   |
   | `MAIL_DEV_ALLOWLIST` | comma separated addresses or `@domain`, for example `tester@example.com,@findsprop.com` | **yes**                | not used   |

   `MAIL_FROM` must be an address on the verified domain, or Resend refuses every mail. For work on your own machine the key can also go in `.env.local`, but a machine with `APP_ENV=local` never mails anyway. Redeploy after changing a variable; a running deployment keeps the old values.

4. **Make sure `support@findsprop.com` is a real mailbox** (the domain's mail is Google Workspace), because replies to both mails go there. Mail sent to the `no-reply@` address is not read.
5. **Decide the allowlist for dev.** Put in `MAIL_DEV_ALLOWLIST` only addresses of people who agreed to get test mail, for example the owner's own. Leave it out for Production.

## Edit the wording (Admin, Emails)

Only a super admin reaches **Admin, Emails** (`/admin/emails`, under Content in the sidebar). It shows the two mails, each with a subject, a message, the list of words you may use, a live preview filled with made-up values, and the buttons Discard, **Save draft** and **Publish**.

- **Save draft** keeps your changes private; the mail still uses the live wording. **Publish** makes the wording the one that is sent from the next mail on. There is no history and no "reset" button; the wording in code is shown while nothing is published.
- Words in curly brackets are filled in: `{enquirerName}`, `{propertyTitle}`, `{propertyLink}`, `{dashboardLink}` (the poster's mail only) and `{siteName}`. Anything else in curly brackets is refused. `{enquirerName}` must appear somewhere in the poster's mail, so the poster always learns who wrote. Subject up to 120 characters, message up to 2000, plain text only.
- No phone number and no enquiry text can be added: no word exists for them.
- If a saved wording is ever unusable, the mail is sent with the wording in code instead, and the log says so (below). A mail never leaves with a raw `{word}` in it.
- Every save is recorded in the audit log (which mail and who, never the text).

## Reading the logs

Every line is one JSON object (Vercel, project, Logs; search `enquiry mail`, or filter on `route` = `enquiry-mail`). Each carries the `requestId` of the enquiry. **No line holds an address, a name, a title, a link or any text.** Lines, most common first:

| Line (`msg`)                                                                  | Level | What it means                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enquiry mail handed to the sender` (`mail`: `poster` or `sender`)            | info  | The mail was given to the sender chosen for this environment. **This is not proof of delivery**: with no key, on a developer machine, or after a skip it appears too. Check Resend's Emails page. |
| `enquiry mail skipped: the address is not on the test list`                   | info  | Dev or staging, and the address is not in `MAIL_DEV_ALLOWLIST`. Expected. To test, add the address (and redeploy).                                                                                |
| `enquiry mail: the poster has no email on file`                               | info  | A home whose owner has not added a contact email (dashboard card). The poster gets nothing; the enquirer's confirmation still goes.                                                               |
| `enquiry mail skipped: no address to send to`                                 | info  | Neither the poster nor the enquirer has an address. Nothing counted.                                                                                                                              |
| `enquiry mail skipped: nothing found for the event`                           | info  | The enquiry could not be read back. Check the `kind` field.                                                                                                                                       |
| `enquiry mail skipped: the poster's daily cap is used up`                     | warn  | That poster already had 20 notifications in the day. Neither mail goes; the enquiry shows on the dashboard.                                                                                       |
| `enquiry mail skipped: the daily cap could not be counted`                    | warn  | The counter failed, so the mail was skipped on purpose. Has `errorCode`; look at the database.                                                                                                    |
| `enquiry mail not sent` (`mail`, `errorCode`, often `detail`)                 | warn  | The sender failed. `UPSTREAM_FAILED` with `detail` such as `The mail provider refused the message (HTTP 429: daily_quota_exceeded)` or `... did not answer in time`. See the table below.         |
| `enquiry mail: the saved wording could not be used, sent the wording in code` | warn  | The published template broke a rule (or an empty result). Open Admin, Emails and fix it.                                                                                                          |
| `enquiry mail: the wording could not be read, using the wording in code`      | warn  | The read of the saved wording failed; the default wording was sent. Has `errorCode`.                                                                                                              |
| `enquiry mail failed` / `enquiry mail could not start`                        | error | Something else broke before sending (`kind`, `errorCode`). The enquiry itself is never affected. Look at the same request id for the line before.                                                 |

What the `detail` of an `enquiry mail not sent` line tells you:

| `detail` (provider words)                                          | Likely cause                                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HTTP 401` or `HTTP 403`                                           | The key is wrong, deleted or lacks sending access, or `MAIL_FROM` is not on the verified domain, or the domain is not Verified yet. Check API Keys and Domains in Resend. |
| `HTTP 400` or `HTTP 422`                                           | Resend did not accept the address or the message. One bad poster address is one failed mail; others are fine.                                                             |
| `HTTP 429` with `daily_quota_exceeded` or `monthly_quota_exceeded` | The plan's allowance is used up (see Limits). The mail is lost, not queued. The enquiry is unaffected.                                                                    |
| `HTTP 429` with `rate_limit_exceeded`                              | More requests a second than Resend allows. Unlikely at this volume.                                                                                                       |
| `did not answer in time`                                           | Resend was slow or down; the call is cut off at 3 seconds. Lost, not retried.                                                                                             |

The status codes follow Resend's documentation; none of these cases has been tried live _(not verified)_. Only `daily_quota_exceeded` is named in the repo's own notes (ADR-181).

To see what Resend itself did with a mail, open Resend, **Emails**: it lists each mail with its status (delivered, bounced, and so on) for the retention period below. That page shows addresses; treat it as personal data.

## Limits

| Limit                                     | Value                                                                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Our cap**                               | 20 notifications per poster per day (the home's owner or the project's builder). One enquiry counts once even though it can send two mails. Past it neither mail goes. |
| Resend free plan, mails a day             | 100; the day resets at midnight UTC. Two mails per enquiry is about 50 enquiries a day on the whole site, dev and production together                                  |
| Resend free plan, mails a month           | 3,000                                                                                                                                                                  |
| Resend free plan, domains                 | 3 verified domains (`resend.com/pricing`, read 24 Nov 2026; the ADRs and `environment-variables.md` say "one", which is out of date)                                   |
| Resend, requests a second                 | 10 per team, no burst                                                                                                                                                  |
| Resend, how long it keeps its mail log    | 30 days                                                                                                                                                                |
| Resend free plan, past the allowance      | The send is refused (`429`); there is no overage on the free plan. Mail is not queued or retried                                                                       |
| Resend, bounce rate to stay under         | 4% (above it Resend may pause sending)                                                                                                                                 |
| Resend, spam complaint rate to stay under | 0.08% (above it Resend may pause sending)                                                                                                                              |

Resend's numbers were read from `resend.com/pricing` and its quotas page on 24 Nov 2026 and can change; check them before relying on them. If the daily allowance is ever the problem, the options are Resend's paid plan or another provider (the sender is one file, `src/server/mail/resend.ts`; ADR-181).

## Bounces

A bounce is a mail Resend could not deliver, most often a mistyped poster address (the contact email is not verified, ADR-186). The app **does not hear about bounces**: there is no webhook yet. The send itself still looks successful in our log (`handed to the sender`), and the bounce shows only in Resend, Emails (status Bounced) and its Metrics page.

- Look at Resend, **Metrics**, now and then in the first weeks. If the bounce rate approaches 4%, Resend can pause the account and **all** enquiry mail stops.
- For a bounced poster mail, the poster's address on their dashboard card is wrong. Ask the poster to correct it (dashboard, "Change"), or, if they cannot be reached, a super admin can see the address in the database (`profiles.contact_email`, private) to find the typo. A bounce webhook that flags such addresses is a later change if it turns out to matter.
- A mail to an enquirer's mistyped address bounces too and is only seen in Resend.

## Switch mail off

**Remove `RESEND_API_KEY`** from the environment in Vercel (or leave it unset) and redeploy. From then on the app drops every mail in that environment, logs the same lines (`handed to the sender` still appears, because the sender that drops the mail also accepts it), and enquiries, dashboards and everything else work as before. Nothing else needs undoing, and mail comes back when the key is set again. To stop only one environment, remove the key only from it; to stop dev from mailing, also empty `MAIL_DEV_ALLOWLIST`. Deleting the key in Resend does the same, but then every send logs a `401` warning.

A single poster stops getting mail by clearing nothing on their side: their address is theirs to change on the dashboard card, and an empty address means no mail for their homes. A builder's address is changed by an admin on the builder's record.

## First live send (checklist for the owner)

Do this once on **dev**, with an address you own and read. It is the only way to see that the mail really arrives; the code has been tested with a fake sender and a fake HTTP server only.

Before you start, check each box:

- [ ] Resend shows `findsprop.com` as **Verified** (setup step 1).
- [ ] `RESEND_API_KEY` is set for Preview in Vercel, and the dev deployment was redeployed after that.
- [ ] `MAIL_DEV_ALLOWLIST` on dev holds your address, for example `you@example.com`.
- [ ] `support@findsprop.com` is a mailbox you can read.
- [ ] You know which dev account owns a home with a contact email: sign in on dev by phone, open the dashboard, and add or check **your own address** on the "Enquiries about your homes are emailed to ..." card. (A seeded home may belong to a fictional owner with no address; use a home you posted, or the dev data's home owned by your test account.)

Then:

1. Open that home on the dev site from **another** signed-in account (the owner cannot enquire about their own home). Put your allowlisted address in the optional email box of the enquiry card, and send the enquiry.
2. Within a minute you should get **two** mails at your address: "You got an enquiry from ..." (the poster's mail, because the home's contact email is yours) and "We sent your enquiry about ..." (the confirmation). Check: the sender shows `no-reply@findsprop.com`; **Reply** goes to `support@findsprop.com`; the poster mail names the enquirer but has **no phone number and no message**; the links open the home and the dashboard on the dev site; nothing shows a raw `{word}`; the mails are not in spam.
3. Check Resend, Emails: both show **Delivered**.
4. Check the log (Vercel, dev, search `enquiry mail`): two `handed to the sender` lines for the same `requestId`, no warn or error.
5. Repeat with an address that is **not** on the allowlist (as the enquirer's address): that confirmation must **not** arrive, and the log must show `skipped: the address is not on the test list`.
6. In Admin, Emails, publish a small change to one subject on dev, send another enquiry (a different home, or wait out the 24 hours) and check the new wording arrives.
7. Tell the person who works on the site the result. If something failed, copy the `requestId` and the warn line (they hold no personal data), not the mail.

Production is not tested this way: when the key is set there, the first real enquiry sends real mail. Publish the final wording in Admin, Emails first, and approve the default wording or replace it (it is still unapproved).

## Privacy

The poster's contact email and the enquirer's typed email are personal data held to send these mails, and they pass through Resend, which is the processor. The mails hold the enquirer's name and the title of the home or project only. The privacy policy page must say this; see the PR that added this page for what its current text lacks (the policy text belongs to the owner, not to this page).
