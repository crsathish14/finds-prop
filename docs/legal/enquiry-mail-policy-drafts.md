# Enquiry mail: draft changes to the privacy policy and processors list

**OWNER APPROVAL NEEDED. DRAFT, NOT REVIEWED BY A LAWYER. NOT PUBLISHED.** Written by an AI agent on 24 Nov 2026 from how the code behaves today (ADR-181, ADR-183, ADR-186, ADR-188 and `docs/runbooks/enquiry-mail.md`). The live Privacy Policy page reads its text from the `legal_privacy` row of `site_settings` (editable by the super admin, ADR-151) and falls back to `src/features/legal/content/privacy.ts`, not from `en.json`, so **nothing here is on the site**. The legal wording is the owner's (and the legal reviewer's) to approve and put there. Check each fact below again before approving. **Not checked:** what the published production policy says today (the production database cannot be read from here); on the dev database there is no published policy, so dev shows the placeholder text from code.

## What is true (the facts the wording rests on)

- When someone sends an enquiry about a home, or a lead or site visit request about a project, and the row is stored, up to **two emails** are sent through **Resend** (the service provider). Nothing is sent for a duplicate, a refused or a rate-limited enquiry.
- **Poster mail** (to the person who posted): goes to the poster's **contact email**. For a home this is a private email the poster types in the post-property form or on their dashboard (`profiles.contact_email`, ADR-186); it is **not shown on the site** and **not verified** (no confirmation link). For a project it is the builder's (or agent's) email on file (`builders.email`). The mail says that someone sent an enquiry and gives **the enquirer's name only**, with a link to the poster's dashboard and to the home or project page. It holds **no phone number and no message text**.
- **Enquirer confirmation:** sent only if the enquirer typed an email in the optional email box. It says the enquiry was passed on, names the home or project, and links to its page. It holds no phone, no message and nothing about the poster. Because the address is only typed, not verified, anyone can type another person's address.
- **What Resend receives** for each mail: the recipient address, the sender and reply-to addresses (`no-reply@findsprop.com`, `support@findsprop.com`), the subject and the text of the mail (which contains the enquirer's name and the home or project title). Resend keeps a log of sent mail for **30 days** (from its quotas page, read 24 Nov 2026; confirm in the terms the owner accepts) and shows recipient addresses in its dashboard.
- **What the app stores or logs about a mail:** its logs hold only the enquiry's request id, the kind and an error code, **never an address, a name or any text**. Each enquiry counts once towards a limit of 20 notifications per poster per day (counted per poster, no text kept).
- **Limits of the sender:** on dev and staging mail goes only to a short list of test addresses; on a developer's machine it never goes. On production it goes to the addresses above.
- Resend's retention, data-location and sub-processor terms **have not been read by the agent**; the owner's reviewer must state the actual details in the wording below.

## Draft 1: privacy policy, new section "Emails about enquiries"

> **[DRAFT, owner approval needed]**
> **Emails about enquiries.** When you send an enquiry about a home or a project on Find Prop, we send an email to the person who posted it, so they know someone has written. That email tells them your name and links to their dashboard on Find Prop, where they can read the enquiry. It does not contain your phone number or your message.
> If you type an email address when you send an enquiry, we also send a short confirmation to that address, saying that your enquiry was passed on. Please type only your own address. If someone types your address by mistake, you may receive a confirmation about an enquiry you did not send; you can ignore it, or write to support@findsprop.com.
> We send these emails through our email service provider, Resend, which handles them for us. Resend receives the email address, the text of the email (which includes the enquirer's name and the title of the home or project) and keeps a record of each email for about 30 days. **[Owner/legal: confirm Resend's retention, where it processes the data, and the transfer basis.]**
> We do not use these emails for advertising. **[Owner/legal: lawful basis; whether a sign-up or enquiry screen needs a short notice at the point of typing the email; how to ask for access or deletion.]**

## Draft 2: privacy policy, new section "Contact email for people who post"

> **[DRAFT, owner approval needed]**
> **Contact email for people who post.** If you post a home, we ask for an email address so that we can tell you when someone enquires about it. We keep this address privately with your account. We do not show it on the site and we do not give it to the people who enquire. We use it only to send you these notifications. We do not check that the address is correct, so please check that you typed it correctly. You can change or remove it at any time on your dashboard; if you remove it, we stop sending these emails and enquiries still appear on your dashboard. For builders and agents, we use the email address on the builder's profile in the same way.
> **[Owner/legal: how long the address is kept after the account is deleted (not checked by the agent: confirm what the account deletion does with `profiles.contact_email`), and the lawful basis.]**

## Draft 2b: added 26 Nov 2026 for the customer email (ADR-195, ADR-196). Use only when `FLAG_CUSTOMER_EMAIL` is switched on

**What is true:** a customer may add an email to their phone account and confirm it with a link sent by our authentication service (Supabase) through Resend. A confirmed email is needed to send a home for review, when that rule is switched on. When a customer confirms an email and has no contact email yet, the confirmed address is **also used as their contact email**, so enquiries about their homes are mailed to it. They can change it on their dashboard; an address they chose is never replaced. The app does not log the address.

> **[DRAFT, owner approval needed]**
> **Your email address.** You can add an email address to your Find Prop account and confirm it with a link we send you. We use it to confirm that you can receive email and to keep your account safe. You need a confirmed email to send a home for review. If you have not given us a separate email for enquiries, we also use this address to tell you when someone enquires about one of your homes. You can change the address for enquiries at any time on your dashboard. The confirmation email is sent through our email service provider, Resend, on behalf of our sign-in service.
> **[Owner/legal: lawful basis for using the confirmed address for enquiry mail; whether the email step or the post-property form needs a short notice saying so (the plan's line "We will also send enquiries about your homes to this address. You can change it later." is proposed, not built); the retention of the account email after account deletion.]**

## Draft 3: privacy policy, data table rows (replace the `[Purpose]`, `[Recipients]`, `[Period]` placeholders)

| What                                 | Purpose (draft)                                                   | Who gets it (draft)                                                                                        | How long (draft)                                                            |
| ------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Email address you type on an enquiry | To send you a confirmation that your enquiry was passed on        | Resend, our email provider. The person you wrote to does **not** receive your address through the mail     | **[Owner/legal]** (Resend keeps its mail log about 30 days)                 |
| Contact email of someone who posts   | To tell the poster that an enquiry arrived                        | Resend, our email provider. Not shown on the site and not given to enquirers                               | While the account exists **[Owner/legal: confirm]**                         |
| Enquiry details                      | To pass your enquiry to the person who posted the home or project | The poster (name, phone and message are on their dashboard); the poster's **email** carries your name only | 24 months for enquiries (`docs/runbooks/retention.md`; provisional, DEC-28) |

Note for the reviewer: the poster's email shows the enquirer's name only, but the poster's dashboard (and a project's leads panel, which formats the phone number as a link) shows more after sign-in. The agent did not trace every field the dashboard shows; confirm what a poster can read there. That is unchanged by the mail feature; the table row above states it so that the policy is not read as hiding it.

## Draft 4: processors list (privacy policy, and the "Third-party processors" row of `docs/engineering/security.md`)

Keep or add: **Resend** (email): receives the recipient's address and the text of each enquiry notification and confirmation (the enquirer's name and the title of the home or project); no phone numbers, no enquiry messages, no account details. **[Owner/legal: legal entity, location of processing, transfer basis, retention.]** The `security.md` row already lists Resend and says the processors are "listed in the privacy policy", which is **not yet true**: the policy has no such list. `security.md` is a protected path and is left unchanged until the owner approves this wording.

## Two repo statements that need correcting when the wording is approved

- ADR-186 says "the privacy policy page already names Resend as a processor". It does not; correct the sentence (an ADR amendment, owner's yes).
- `docs/engineering/security.md` says the processors are "listed in the privacy policy" (see above).

## Where the approved wording goes

1. In the admin legal editor (ADR-151; the agent did not check the screen's menu name), edit the Privacy Policy draft, paste the approved sections, review the preview and publish. The code fallback in `src/features/legal/content/privacy.ts` only changes if the owner wants the placeholder text replaced there as well (a normal change, class C1).
2. Then correct ADR-186 and `security.md` as above.
3. Only then publish the mail wording on production (`docs/runbooks/enquiry-mail.md`, "First live send").
