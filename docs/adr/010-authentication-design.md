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
