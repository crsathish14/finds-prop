# ADR-010 · Authentication design — **Approval required**

- Status: Proposed
- Date: 2026-10-29
- Related: Refined; approval: **Yes (`DEC-04/05/06/07/23/31`)**; stage S3

> Awaiting DEC-05 and spike S3-SPK-01.

## Record

- **Customers:** `signInWithOtp({ phone, options: { captchaToken } })` → `verifyOtp`. Send-SMS hook = `POST /api/auth/hooks/send-sms` (Standard Webhooks signature check → MSG91). Email added after OTP via `updateUser({ email })` with SMTP verification link. +91 only unless approved otherwise.
- **Builders:** admin creates user with a **confirmed** email via the admin API, inserts role + builder row, sends set-password link. Sign-in: email+password or Google (auto-links by identical verified email) plus second factor (below).
- **Admin:** same as builder; role assignment locked by DB triggers.
- **Second factor options (`DEC-05`):** (1) Supabase **phone MFA** — matches ARC wording, `aal2` can be enforced in RLS, but billed ($75/month first project) and SMS-based; (2) **TOTP MFA** — free, no SIM-swap, no extra DLT SMS; (3) phone as an attached identity without MFA — weakest, not enforceable. **Recommendation: (2) TOTP for builders and admin; (1) only if a phone code is a hard requirement.**
- **Spikes:** `S3-SPK-01` (Google→invited account, phone attach, MFA), `S3-SPK-02` (hook timeout/retry, test OTPs).
- **Local/CI:** use Supabase test phone numbers/OTPs and Inbucket, so no SMS or email is sent.

## Owner decisions, 1 Nov 2026

- **There are two admin addresses, both permanent (decided 1 Nov 2026):** `support@drizzlemarketings.com` and `developer@findsprop.com`, held in one database function (`reserved_admin_emails()`, migration `20261101170000`). Each is granted `super_admin` when its Google email is confirmed; nobody else can hold it; neither can become a builder. The list is fixed in a migration, not a table, so a leaked server key cannot add an admin. The owner confirmed control of both mailboxes. _Update 2 Nov 2026 (owner):_ `support@drizzlemarketings.com` is activated only after all stages are complete; until then `developer@findsprop.com` is the one working admin, and the spike ran with it alone. The list in the migration is unchanged, so the second address stays reserved.
- **The admin signs in with Google only (decided 1 Nov 2026).** The reserved, Google-verified address is what makes someone the admin (BR-11 and BR-12, enforced by the database). No SMS code and no second step inside the app. The owner turns on 2-Step Verification in the Google account of that mailbox. An authenticator-app step can be added later if wanted.
- **An agent works exactly like a builder (decided 1 Nov 2026):** same invitation, same Google-only sign-in, same portal and rules, and the admin approves their projects. They differ only by a **type** the admin can see (builder or agent), because their payment differs. Both hold the `builder` role for access; the type lives on the builder record (`builders.kind`, a later migration). The `agent` value of the role enum stays unused (`DEC-08`). Billing itself is not designed and not built.
- **Builders and agents sign in with Google only.** No password, no phone code and no second factor. This resolves `DEC-05` for them and replaces the second-factor options above for builders and agents.
- **Google needs the project's own OAuth client.** Supabase provides no shared Google client, so the owner creates one in Google Cloud and enters its Client ID and Secret in the Supabase dashboard (checked in Supabase's documentation, 1 Nov 2026).
- **Consequences to build for:** no builder password flow, no set-password email, no `/reset-password` for staff, no `/builder/login` password form; builder and agent accounts have no verified phone, so `has_verified_phone()` keeps them out of customer actions (save, enquire, post a listing); the approved builder sign-in and the addendum's `staff-signin` and `staff-2fa` screens must be redrawn Google-only before S3-T10.

## What the documentation says, and what the spike must settle

From Supabase's documentation (1 Nov 2026): a TOTP second step is free and gives `aal2`, enforceable with a restrictive RLS policy on `auth.jwt()->>'aal'`; OAuth and phone-code sign-ins are `aal1`; automatic linking matches on the email address and never links a phone; the Send SMS HTTP hook has a total budget of 5 seconds including retries (so the SMS provider call needs a timeout of about 3 seconds, not 5); a **Before User Created** hook can refuse a sign-up by provider, which could stand in for a per-provider sign-up switch (only email and phone have those).

Settled only by a live test (`docs/runbooks/auth-spike.md`, script `scripts/spike-auth.mjs`): what the token's `phone` claim holds for each kind of user; whether a Google sign-in lands on the invited account or creates a second one; whether the reserved admin becomes `super_admin` through Google; whether a stranger can create an account with Google; whether the Before User Created hook fires for phone sign-ups. The Send-SMS hook test (`S3-SPK-02`) waits for the hook route (S3-T09).

## Phone-code hook, built 1 Nov 2026 (S3-T09, first part)

The Send-SMS hook route, the MSG91 adapter (3 second limit inside Supabase's 5 second budget), a fake sender and the signature check are built (`docs/runbooks/send-sms-hook.md`). The signature check is written with Node's crypto, so no package was added. The MSG91 request is not yet run against the live service and waits for DLT approval.

## Before User Created guard, built 2 Nov 2026 (BR-16, proposed)

The auth spike showed that, while sign-ups are on, a stranger can create an account with Google (`docs/runbooks/auth-spike.md`, section F). The database function `hook_before_user_created()` closes that: it allows phone sign-ups, the two reserved administrators and active invited builders (the last two only through Google) and refuses everything else with `signup_not_allowed`. It is an allow-list that never raises an error, and it refuses an email sign-up that uses a reserved or invited address, so nobody can take a staff address before its owner arrives. The owner enabled it on the dev project on 2 Nov 2026 and ran six live cases (`docs/runbooks/before-user-created-hook.md`): phone, the reserved admin (as a new account) and an invited builder (linked to its existing account) are allowed; a stranger with Google and an email sign-up are refused with HTTP 403 `signup_not_allowed`; an account added from the dashboard is **not** blocked, so the invite flow (S7-T05) can create the builder's account first. Supabase reports the refusal as `msg: signup_not_allowed` with `error_code: unknown`, so the app recognises it by the message. The guard checks only brand-new accounts; an existing user is never rechecked. It must be switched on in staging and production as part of the Supabase configuration check (S3-T14).

## Staff Google sign-in, built 2 Nov 2026 (S3-T10)

Builders, agents and the administrator sign in with Google only, on the two approved pages (`/builder/login`, `/admin/login`). The button calls `startStaffGoogleSignIn`, a `defineAction` with no authentication step and the `staff_sign_in` rate limit (10 per visitor per 10 minutes, 30 per address per hour). It asks Supabase for the Google address through the cookie-bound server client (the PKCE verifier stays in our cookie), builds the return address from `NEXT_PUBLIC_SITE_URL` and never from a request header, and refuses any address that is not on the project's Supabase host.

`GET /auth/callback` finishes it. It sits outside the language routing, so `proxy.ts` leaves it alone like `/api`. It reads the error Supabase reports (the guard's `signup_not_allowed` arrives as `error_description` in the query string and becomes the `denied` state; `access_denied` becomes `cancelled`), exchanges the code, reads the session through the same client, and lets in only an active builder (role and active record, BR-34) or `super_admin`. Eligibility comes from the session the server read: the `area` and `next` in the address only choose the page and can never grant access. Anyone else is signed out (this browser only) and sent back with one generic `denied` state; an invited address or the reason is never shown. Sign-ins and denials are written to the audit log as `staff.signed_in` and `staff.sign_in_denied` (names and ids only); a failing audit entry is logged and does not lock a builder out.

Not built here: sign-out (with the customer work, S3-T09), the shared header and footer on these pages (the shared layout), and the invite flow (S7-T05). Vercel preview deployments each have their own address, so sign-in is tested locally and on the stable dev address. The setup and the live check are in `docs/runbooks/staff-google-sign-in.md`.

## Phone sign-in, first part built 3 Nov 2026 (S3-T09, ADD-01)

The customer sign-in page `/auth` shows the approved ADD-01 screen. The mobile number goes to `sendPhoneCode`, a `defineAction` with no sign-in step and the `otp_request` limits, keyed on the normalised number so every way of typing one number shares a count. It calls `signInWithOtp` from the server (never from the browser, so the limits cannot be skipped) with the Turnstile token and `shouldCreateUser`, so a new number becomes an account when its code is entered. A number from another country is refused before the rate limiter and before any SMS (FR-AUTH-09); Supabase's `captcha_failed`, its own send limit and a failing hook map to the existing error codes, and the logs never carry the number or the token. The human-check widget loads Cloudflare's script on this page only, in interaction-only mode, so the common case passes unseen; it lives in the `auth` feature, not in `components/`, because only sign-in uses it. The CSP (still Report-Only) allows `challenges.cloudflare.com`. The number stays in the browser component between the two steps and never goes into the address.

Not built yet at that point: entering the code, the name step (ADD-04), email verification and `/auth/confirm` (ADD-03), and sign-out. The `gate-enquiry` state needs the property the visitor was viewing, so its context chip comes with the enquiry slice; the plain gate message shows for `?gate=enquire`.

## Code entry, built 3 Nov 2026 (S3-T09, ADD-02)

`verifyPhoneCode` is a `defineAction` with no sign-in step and the `otp_verify` limit (10 tries per phone per hour, every try counted, keyed on the normalised number). It calls `verifyOtp` from the server with the cookie-bound client, so a good code leaves the session in the visitor's cookies; an answer with no session is treated as a failure. A code with the wrong shape or a number from another country is refused before the limit counts it. After sign-in the screen shows "Number verified" for a moment and goes to the `?redirect=` page, accepted only if it is a path on this site (BR-06), otherwise `/dashboard`.

Two owner decisions (3 Nov 2026) follow from what Supabase and the limiter can tell us. First, Supabase answers a wrong code and an expired one with the same `otp_expired` error, so the screen calls a refused code "expired" only when more than `CODE_LIFETIME_SECONDS` (300) have passed since it asked for one; the project's code expiry must be set to 300 seconds to match. Second, the approved text "You have 3 attempts left" and "paused for 15 minutes" cannot be built as written: the limiter answers only allowed or refused (and the limit is 10 an hour, DEC-31). The wrong-code message omits the count, and the locked message uses the real wait time from the limiter. A refused code clears the field so the visitor can type again. A count would need `rate_limit_hit` to return the hits used, which is a migration.

Sending a new code needs a fresh human-check token, so the code step runs the widget quietly (no status box) and keeps Resend off until it passes. Not built yet at that point: the name step (ADD-04), email verification and `/auth/confirm` (ADD-03), and sign-out.

## Name step, built 3 Nov 2026 (S3-T09, ADD-04)

After a good code, `verifyPhoneCode` reads the visitor's own profile through their new session and returns `needsName` (true when `full_name` is empty, as it is for a new account). A visitor who needs a name sees the ADD-04 card, on its own without the side panel; anyone else goes straight to the page they came for. If the profile cannot be read the visitor is not held up, because the name is asked for again before posting or enquiring. `saveProfileName` is a `defineAction` for a signed-in user: the name is the only thing taken from the caller (spaces trimmed and collapsed, 2 to 80 characters, no control characters), the row is the session user's, and the database lets a customer change only `full_name` (`profiles_update_own` and the column grant), so no migration is needed. It has no rate limit of its own and no audit entry. No row changed is reported as not found, never as a success.

The UX's "Skip for now" goes to the page the visitor was headed for (the UX draws a link to the home page, which would lose where they were going). The "post" and "enquire" wordings of the same card are built and tested, but nothing opens them yet: the posting and enquiry features will, with the rule that a name is required before posting or enquiring.

Not built yet at that point: email verification and `/auth/confirm` (ADD-03), and sign-out.

## Email verification, built 3 Nov 2026 (S3-T09, ADD-03)

A new account is offered "Add your email" after the name step (owner decision, 3 Nov 2026); returning visitors are not asked at sign-in and will get the dashboard prompt when that page is built (S5-T04). A visitor may skip: only posting needs a verified email (DEC-07). `addEmail` is a `defineAction` for a signed-in customer with a verified phone. It calls `updateUser({ email })`, which for a phone-only account is an email change, so Supabase sends a single-use link and marks the email confirmed only when the link is followed; the database trigger then copies `email_confirmed_at` to `profiles.email_verified_at` (no migration). `resendEmailLink` calls `resend` for an email change. Both run under a new `email_link` limit (5 per user per hour and 20 per address per day, owner decision), and a resend counts like the first send. Every reason an address cannot be used gives the same "We couldn't use that email" answer, so nobody can learn whose address it is.

`GET /auth/confirm` (outside the language routing, like `/auth/callback`) accepts only `type=email_change` with a well-formed token hash, calls `verifyOtp`, and redirects to `/auth?email=verified` or `/auth?email=expired`. Every failure, including a missing or malformed token, is the same expired page. `/auth` shows the verified page only to a visitor whose session carries the email (otherwise a stale link just shows sign-in) and shows the expired page to anyone; a signed-in visitor can ask for a new link on the same card, anyone else is sent to sign in first.

Risks reviewed, not removed: following the link signs that browser in as the account (Supabase's behaviour for this link type), which is no more than the mailbox owner could do; some email scanners open links ahead of the visitor and use the link up, which shows as "expired or already used" (the UX has that state); a phone customer cannot confirm an administrator's or an invited builder's address without that mailbox, and Supabase refuses an address another account already holds. I have not seen what the live project returns for an address in use, so the "taken" state is built from the documented error codes.

The unbuilt states: the UX has no separate rate-limited or service-unavailable state for email, so those use the shared error wording in an alert. The dashboard prompt, reminder and posting gate (the second ADD-03 screen) are built with the dashboard (S5-T04) and posting (S6).

Not built yet: sign-out.

## Open questions
