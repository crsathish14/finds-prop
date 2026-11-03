# Phone-code hook and MSG91

Supabase makes the six digit code and calls our route `POST /api/auth/hooks/send-sms` to send it. The route checks the signature first, accepts only Indian mobile numbers, and sends through MSG91. Code: `src/app/api/auth/hooks/send-sms/route.ts`, logic in `src/server/sms/`. Decisions: ADR-010.

## What is built, and what is not

- **Built and tested with fakes:** signature check (Standard Webhooks, constant time, five minute window), the +91 only rule, the MSG91 adapter with a 3 second limit, a fake sender for tests and local work.
- **Not yet run against the real service.** The MSG91 request follows third-party client libraries (POST `/api/v5/otp` with `template_id`, `mobile` and `otp`; `authkey` header), because MSG91's own reference could not be read. It cannot send real codes until DLT approves the sender and the OTP template. Check the request against MSG91's current reference and one real send before launch.
- **Built in the sign-in action (S3-T09, `src/features/auth/`):** `sendPhoneCode` asks Supabase for the code with the CAPTCHA token and applies the `otp_request` limits (5 per phone per hour, 20 per address per day), keyed on the normalised number. A number from another country is refused before any code is requested. The ADD-01 screen and the human-check widget are in the same slice.
- **Code entry (S3-T09, ADD-02):** `verifyPhoneCode` checks the six digits with the `otp_verify` limit (10 tries per phone per hour; every try counts) and a good code puts the session in the visitor's cookies. The screen has the resend timer (60 seconds, with a fresh human-check token) and the wrong, expired, locked and unavailable states.
- **Name step (S3-T09, ADD-04):** `verifyPhoneCode` also says whether the profile has a name yet (`needsName`); a new account is then asked for one before going on. `saveProfileName` saves it on the visitor's own profile (2 to 80 characters).
- **Email (S3-T09, ADD-03):** a new account is offered "Add your email" after the name step; `addEmail` and `resendEmailLink` send Supabase's single-use link, and `/auth/confirm` finishes it. Setup is in `docs/runbooks/environment-variables.md`.
- **Not built yet:** sign-out.

## Behaviour per environment

| Environment         | MSG91 set up        | MSG91 not set up                                                  |
| ------------------- | ------------------- | ----------------------------------------------------------------- |
| local, dev          | Sends through MSG91 | Sends nothing (a fake). Use Supabase's test numbers               |
| staging, production | Sends through MSG91 | **Refuses** (the hook answers 502). A deployment must not pretend |

## Setting it up (owner, after DLT approval)

1. In the Supabase dashboard of the project, open Authentication, Hooks, Send SMS. Choose an HTTP endpoint and enter `https://<the app's stable address>/api/auth/hooks/send-sms`. Supabase shows a signing secret once: copy it.
2. Put the secret in the app's environment as `SEND_SMS_HOOK_SECRET` (Vercel environment variables, per environment). Never paste it into chat or a file in the repository.
3. After DLT approval, set `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` in the same place. The template must contain the OTP variable (`##OTP##` in MSG91) and be an approved OTP template. `MSG91_SENDER_ID` is reserved and not used by the OTP call.
4. Supabase allows the hook five seconds in total including retries, which is why the MSG91 call is cut off at three.

## If codes stop arriving

- A signed request that fails the check is logged as `send-sms hook request refused` with a reason (`stale`, `bad_signature`, `missing_headers`, `bad_secret`) and never includes the phone or the code. A burst of `bad_signature` after a secret change means the two secrets differ.
- `The code could not be sent` (HTTP 502 to Supabase) means MSG91 refused or was too slow; the log line carries only an error code. Check the MSG91 panel for the delivery report and the template status.
