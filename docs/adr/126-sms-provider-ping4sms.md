# ADR-126 · Phone codes are sent through Ping4SMS (S3 follow-up)

- Status: Accepted for development and testing. Real customers wait for the DLT item below.
- Date: 2026-11-11
- Related: ADR-010 (authentication design), `docs/runbooks/send-sms-hook.md`, R-BE-09, R-BE-10, RISK-02
- Owner's decision, 11 Nov 2026: Ping4SMS is the only SMS account the owner has (no MSG91 account), so it replaces MSG91 as the provider. Zoho CPaaS was looked at first and not taken.

## Decision

- **A second adapter, `src/server/sms/ping4sms.ts`,** behind the same `SmsSender` interface. The Send SMS hook, its signature check, the +91 only rule and the rate limits are unchanged.
- **The request.** One HTTPS `GET https://site.ping4sms.com/api/smsapi` with `key`, `route`, `sender`, `number`, `sms` and `templateid`. The number is the ten digit mobile number (the hook's `91` is removed). `sms` is the whole message text.
- **The text is the DLT template with the code filled in.** India requires the text to match the registered template, so the template, with one `{#var#}` where the code goes, is the setting `PING4SMS_MESSAGE`, not code. A template with no `{#var#}` or more than one is refused when the sender is made.
- **The answer decides, and only a long number is success.** Seen live on 11 Nov 2026 (demo account, HTTPS, about 250 ms, the text arrived on the owner's phone within 3 seconds): HTTP 200 with a plain text body that is only a number. A message id (`169365451`, nine digits) is acceptance; a wrong key gives `101`. The rule is: HTTP 200 and a body of at least seven digits is success; anything else fails closed (`UPSTREAM_FAILED`). Short numbers are error codes, and the code (not the body) is the only part repeated in the error message. **Update 13 Nov 2026:** Ping4SMS's own list of error numbers (101 invalid user, 102 invalid sender ID, 103 invalid contact, 104 invalid route, 105 invalid message, 106 spam blocked, 107 promotional block, 108 low credits on the route, 109 promotional route hours, 110 invalid DLT template ID) is in the adapter, with our own words for each; a number not in the list is reported as its code only, and any other body is not repeated. Unknown still means failure.
- **The hook's log says what to look at (13 Nov 2026).** The first live sign-in on dev failed with only `errorCode: INTERNAL` in the log, which did not say whether a setting was missing or the message was cut. The hook now also logs `detail` for errors made by our own code (`ActionError`): the provider's code and our words for it, or the names of the missing settings and the `APP_ENV`. Never values. An error that is not ours logs its class only, because it may hold anything. The field is not called `message`, because the logger redacts that key as a message body.
- **The key is in the address, so:** HTTPS only (the vendor's own examples use plain HTTP; we do not), redirects are not followed, the address is never logged or put in an error, and nothing thrown contains the phone, the code, the key or the text (R-BE-10). The call is cut off at 3 seconds, which includes reading the answer, inside Supabase's 5 second budget for the hook.
- **A named provider.** `SMS_PROVIDER` is `ping4sms` (when not set) or `msg91`. Settings of a provider that is not named are ignored, so leftover MSG91 settings can never send a code. The MSG91 adapter stays in the code unchanged as the fallback the release runbook names, and nothing uses it.
- **Same fail-closed rule as before.** With the named provider fully set up it sends. Without it, `local` and `dev` use the fake sender (Supabase's test numbers) and `staging` and `production` refuse (the hook answers 502). A half-set-up provider counts as not set up.
- **New environment variables:** `SMS_PROVIDER`, `PING4SMS_API_KEY`, `PING4SMS_SENDER_ID`, `PING4SMS_TEMPLATE_ID`, `PING4SMS_ROUTE` (default `2`, the route Ping4SMS's examples use), `PING4SMS_MESSAGE`. All server-only, all in `src/server/env.ts` and `.env.example`.
- **No new package.** The adapter uses `fetch`.

## What is not done yet, and what it means

- **Find Prop has no DLT registration of its own yet.** Until it does, the only template that can be used is one on Ping4SMS's own DLT entity, with their sender id, and it must have a place for the code. The demo template ("Dear Customers, Welcome to PING4SMS") has none, so it cannot carry a code. Texts would not say "Find Prop". This is acceptable for development and testing; it is **not** the plan for launch. RISK-02 stays open until the owner's own sender id and OTP template are approved (Ping4SMS offers to help with the registration at no charge).
- **A message id means accepted, not delivered.** Supabase has no way to learn of a failed delivery, so a number that never receives the text looks like a success. Ping4SMS's panel has a Sent Items report. A delivery report call was not looked at; it can be a later task.
- **The route number's meaning is Ping4SMS's, not documented publicly.** `2` is what their examples and the demo use. Ask them to confirm it is the right route for OTP traffic on the real account.
- **The privacy policy's list of processors** names Ping4SMS (phone) instead of MSG91 in `docs/engineering/security.md`. The wording of the public policy itself is the owner's to approve.

## Verification

- `src/server/sms/__tests__/ping4sms.test.ts`: the request (address, every parameter, ten digit number), a long number as success, `101` and other bodies as failure, an error status with a good-looking body, numbers that are not Indian mobiles refused before any call, a template with no or two places for the code, a code that looks like a replacement pattern, the 3 second cut-off, and no phone, code, key or text in any error.
- `src/server/sms/__tests__/index.test.ts`: Ping4SMS by default, the route setting, MSG91 only when named, MSG91 settings alone do not send, the fake in `local` and `dev`, refusal in `staging` and `production`, a half-set-up provider, a bad template.
- Not tested in code: a real send with the real DLT template (waits for the owner's DLT), and the responses for other failures such as an unapproved template or no credit.
- No database, CI, gate or package change. Rollback: set `SMS_PROVIDER=msg91` with MSG91's settings, or remove the Ping4SMS settings (the hook then refuses in staging and production).
