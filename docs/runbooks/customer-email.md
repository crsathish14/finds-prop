# Customer email verification: setting it up, switching it on and off

Customers can add an email to their phone account and confirm it with a single-use link. When the rule is switched on, a customer must have a verified email before they can **send a home for review**. Nothing else is gated: sign-in keeps its Skip button, and a customer without an email can browse, save, compare and enquire. This page is for the owner and whoever runs the site. The decisions are in ADR-195 (the database rule), ADR-196 (one address, not two), ADD-03 (the screens) and ADR-186 (the poster's contact email). The list of every setting is in `environment-variables.md`; the enquiry mail has its own page, `enquiry-mail.md`.

**Status when this page was written (26 Nov 2026):** the code is merged and the rule is **off everywhere**. Nothing below has been done on any Supabase project, and no step has been tried live _(not verified)_. The first live test of the link itself was on 3 Nov 2026 and taught the order in `environment-variables.md`, "Email verification".

## How it works

1. **Sign-in** ends after the phone code and the optional name. With `FLAG_CUSTOMER_EMAIL=1` it then offers an email step, which the customer can **Skip**. A customer who adds an email gets a link from **Supabase** (not from our code), through the SMTP settings below.
2. The link lands on `/auth/confirm`. If it is good, the email is confirmed and the customer sees "verified". At that moment the same address is also copied into their private contact email (`profiles.contact_email`, where enquiries about their homes are mailed) **if they have none**. A contact email they chose is never replaced. If the copy fails the customer still sees "verified", and the post-property form starts its email box from the confirmed address instead.
3. **Posting a home** is where the rule bites. The post-property page shows the "add or confirm your email" gate instead of the wizard to a customer with no verified email. As a second lock, the database refuses to send a **draft** for review (`listing.email_required`) when the site setting below is on, even if someone calls the submit action directly. Saving drafts, editing a listing that is in review or live, and sending a rejected listing back are **not** gated.

## The two switches

| Switch                                                                                             | Where                                  | What it does                                                                                                                                           |
| -------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FLAG_CUSTOMER_EMAIL=1`                                                                            | Vercel, for the environment; redeploy  | Shows the email step, the dashboard prompt and the page gate, and lets the add-email and resend-link actions run                                       |
| `site_settings` key `posting_requires_verified_email`, value `{"enabled": true}` (public, ADR-195) | The environment's database (see below) | Makes the database refuse to send a draft for review without a verified email. Missing, `false` or anything that is not the JSON boolean `true` is off |

**They must agree.** The flag is read by the app and the setting by the database, so nothing stops them drifting:

- **Flag on, setting off:** the page asks for an email but a direct call can still post without one (the behaviour before ADR-195). Not harmful, but the rule is only half on.
- **Flag off, setting on:** **nobody can post at all**, because the gate is gone and nobody can verify an email. This is the dangerous one. A page that warns about it was not built, because the approved screens do not show one (build only what the approved UX shows).

**Switching on, in this order:** (1) do the mail setup below and check a real link arrives; (2) set `FLAG_CUSTOMER_EMAIL=1` in Vercel and redeploy; (3) test with a personal address (checklist below); (4) only then set the setting. **Switching off, in the reverse order:** (1) set the setting to `false` or delete its row; (2) then set the flag to `0` and redeploy.

**Setting or clearing the setting** (a data change, not a schema change; the audit log records it). In the Supabase dashboard, SQL editor, for the right project, as the owner:

```sql
-- on
insert into public.site_settings (key, value)
values ('posting_requires_verified_email', '{"enabled": true}')
on conflict (key) do update set value = excluded.value;

-- off
update public.site_settings
set value = '{"enabled": false}'
where key = 'posting_requires_verified_email';

-- look
select key, value from public.site_settings where key = 'posting_requires_verified_email';
```

**Dev first.** The owner decides when staging and production get the flag and the setting. Production is not live yet, so there are no existing owners to protect: once the rule is on, every poster there verifies an email before posting from day one. On dev, an owner whose homes already exist without a verified email keeps them; they verify when they next send a draft.

## Mail setup (once for each Supabase project)

The verification link is sent by Supabase through your own SMTP account. Resend does both jobs (this and the enquiry mail), on the **same domain and the same daily allowance**.

1. **Verify `findsprop.com` in Resend.** This is the same step as step 1 of "One-time setup" in `enquiry-mail.md`; do it once. Wait until the status is **Verified**.
2. **Create a second, separate API key** for Supabase, with **Sending access** and the domain `findsprop.com` only, named for its use (for example `findsprop-supabase-smtp`). **Do not reuse the app's `RESEND_API_KEY`**: with two keys either can be rotated alone. Never paste a key into chat, a file or a screenshot; if one appears there, delete it in Resend at once.
3. **Supabase, Authentication, Emails, SMTP Settings:** host `smtp.resend.com`, port `465`, username `resend`, password the key from step 2, sender `no-reply@findsprop.com`. Do this **first**: custom SMTP is what unlocks the templates tab, and Supabase's own sender reaches only team members at 2 mails an hour.
4. **Template "Change email address":** link `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email_change`. The default link goes to the expired page.
5. **URL Configuration, redirect URLs:** add `<site address>/auth/confirm` and `<site address>/auth/callback` for every address the app runs on.
6. **Link lifetime:** 3600 seconds. The screen says "1 hour"; if you change one, change the other.

## Test it (dev, with a personal address)

Never use the reserved administrator addresses (`developer@findsprop.com`, `support@drizzlemarketings.com`): the app refuses them on purpose and answers "We couldn't use that email" without saying why (ADR-010).

- [ ] Mail setup above is done and `FLAG_CUSTOMER_EMAIL=1` is set on dev and redeployed. **The setting is still off.**
- [ ] Sign in on dev by phone, add your personal email, **open the link** in the email, and see "verified". Check the mail is not in spam and comes from `no-reply@findsprop.com`.
- [ ] Open the dashboard: the "Enquiries about your homes are emailed to ..." card shows that same address (the copy worked). If it does not, the log has `contact email not copied` with a code and no address; the post-property form still starts its box from the confirmed address.
- [ ] Open post-property: the wizard opens with "Email for enquiries" already filled in, editable.
- [ ] Skip works: sign in with another account and press **Skip** on the email step; you are signed in, can browse, save and enquire, and meet the gate only on post-property.
- [ ] Now set the setting to `true`. As an account with **no** verified email, call the submit action directly (or send a complete draft): it is refused, and the wizard reloads to the gate. As your verified account, a complete draft is sent for review.
- [ ] Rejected or live listings of a no-email account can still be edited and re-sent.
- [ ] Send one enquiry and check the poster mail arrives (`enquiry-mail.md`, "First live send").

If a step fails, copy the `requestId` and the warn line from the log (they hold no personal data), not the mail.

## Volume warning

Resend's free plan allows about **100 mails a day for the whole domain**: the verification mails from Supabase **and** the enquiry mails from the app share it. Supabase's own limit is 30 an hour once custom SMTP is on, and the app adds 5 per user per hour and 20 per address per day (the `email_link` scope). A busy day of sign-ups plus enquiries can pass 100. When mail is refused, **the verification mail is lost and the customer sees an error**, and enquiry mail stops too. If that happens, the remedy is Resend's paid plan (or another provider, see `enquiry-mail.md`, "Limits"). Resend's numbers were read on 24 Nov 2026 and can change.

## Problems

| What you see                                                   | Likely cause                                                                                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The link lands on the expired page                             | The template still has the default link, the redirect URL is missing, the link was used or is older than an hour, or the customer's mail program opened it first. Ask for a new link |
| No mail arrives                                                | Custom SMTP not set or the key is wrong, the domain is not Verified, the daily allowance is used up (Resend, Emails), or the address is mistyped                                     |
| Nobody can post                                                | The setting is on but `FLAG_CUSTOMER_EMAIL` is off (or the project's SMTP is broken). Set the setting to `false` first                                                               |
| A customer says "I never get asked for my email" but should be | `FLAG_CUSTOMER_EMAIL` is off on that environment, or they pressed Skip; they meet the gate when they post                                                                            |
| Enquiries go to an address the customer did not choose         | The copy took the confirmed account email because they had no contact email yet. They can change it on the dashboard card                                                            |
| The poster's address is wrong in `contact_email`               | A typo at confirmation cannot happen (the link proves the address); a typed one on the dashboard card can. See "Bounces" in `enquiry-mail.md`                                        |

## Privacy

The confirmed account email is personal data held to verify the account, and is now **also used to mail enquiries about the customer's homes** (when they have no other contact email). Both mails pass through Resend. `docs/legal/enquiry-mail-policy-drafts.md` has the draft wording for the owner to approve; nothing is published, and no live legal wording was changed.
