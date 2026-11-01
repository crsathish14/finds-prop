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

- **The admin signs in with Google only (decided 1 Nov 2026).** The reserved, Google-verified address is what makes someone the admin (BR-11 and BR-12, enforced by the database). No SMS code and no second step inside the app. The owner turns on 2-Step Verification in the Google account of that mailbox. An authenticator-app step can be added later if wanted.
- **Builders and agents sign in with Google only.** No password, no phone code and no second factor. This resolves `DEC-05` for them and replaces the second-factor options above for builders and agents.
- **Google needs the project's own OAuth client.** Supabase provides no shared Google client, so the owner creates one in Google Cloud and enters its Client ID and Secret in the Supabase dashboard (checked in Supabase's documentation, 1 Nov 2026).
- **Consequences to build for:** no builder password flow, no set-password email, no `/reset-password` for staff, no `/builder/login` password form; builder and agent accounts have no verified phone, so `has_verified_phone()` keeps them out of customer actions (save, enquire, post a listing); the approved builder sign-in and the addendum's `staff-signin` and `staff-2fa` screens must be redrawn Google-only before S3-T10.

## What the documentation says, and what the spike must settle

From Supabase's documentation (1 Nov 2026): a TOTP second step is free and gives `aal2`, enforceable with a restrictive RLS policy on `auth.jwt()->>'aal'`; OAuth and phone-code sign-ins are `aal1`; automatic linking matches on the email address and never links a phone; the Send SMS HTTP hook has a total budget of 5 seconds including retries (so the SMS provider call needs a timeout of about 3 seconds, not 5); a **Before User Created** hook can refuse a sign-up by provider, which could stand in for a per-provider sign-up switch (only email and phone have those).

Settled only by a live test (`docs/runbooks/auth-spike.md`, script `scripts/spike-auth.mjs`): what the token's `phone` claim holds for each kind of user; whether a Google sign-in lands on the invited account or creates a second one; whether the reserved admin becomes `super_admin` through Google; whether a stranger can create an account with Google; whether the Before User Created hook fires for phone sign-ups. The Send-SMS hook test (`S3-SPK-02`) waits for the hook route (S3-T09).

## Open questions

- **Agents.** The `agent` role has no portal (`DEC-08`). How is an agent invited and what can they do after signing in with Google?
