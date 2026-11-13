# Phone-code hook and Ping4SMS

Supabase makes the six digit code and calls our route `POST /api/auth/hooks/send-sms` to send it. The route checks the signature first, accepts only Indian mobile numbers, and sends through the chosen SMS provider (Ping4SMS; MSG91 is kept as a fallback). Code: `src/app/api/auth/hooks/send-sms/route.ts`, logic in `src/server/sms/`. Decisions: ADR-010 and ADR-126.

## What is built, and what is not

- **Built and tested with fakes:** signature check (Standard Webhooks, constant time, five minute window), the +91 only rule, the Ping4SMS adapter and the MSG91 adapter, each with a 3 second limit, a fake sender for tests and local work.
- **Ping4SMS seen live once (11 Nov 2026, demo account):** the request works over HTTPS; the answer is plain text, HTTP 200, and a message id (nine digits) means accepted; a wrong key answers `101`. The text reached a phone within 3 seconds. The meaning of other codes is not known, so any answer that is not a long number counts as a failure. **Not yet run with Find Prop's own sender and template** (see "DLT" below).
- **MSG91 is not used.** The owner has no MSG91 account. Its adapter was never run against the real service.
- **Built in the sign-in action (S3-T09, `src/features/auth/`):** `sendPhoneCode` asks Supabase for the code with the CAPTCHA token and applies the `otp_request` limits (5 per phone per hour, 20 per address per day), keyed on the normalised number. A number from another country is refused before any code is requested. The ADD-01 screen and the human-check widget are in the same slice.
- **Code entry (S3-T09, ADD-02):** `verifyPhoneCode` checks the six digits with the `otp_verify` limit (10 tries per phone per hour; every try counts) and a good code puts the session in the visitor's cookies. The screen has the resend timer (60 seconds, with a fresh human-check token) and the wrong, expired, locked and unavailable states.
- **Name step (S3-T09, ADD-04):** `verifyPhoneCode` also says whether the profile has a name yet (`needsName`); a new account is then asked for one before going on. `saveProfileName` saves it on the visitor's own profile (2 to 80 characters).
- **Email (S3-T09, ADD-03):** a new account is offered "Add your email" after the name step; `addEmail` and `resendEmailLink` send Supabase's single-use link, and `/auth/confirm` finishes it. Setup is in `docs/runbooks/environment-variables.md`.
- **Sign-out (S3-T09):** `signOut` ends this browser's session, for customers and staff, and `useSignOut` is what the avatar menu's Sign out entry calls.

## Behaviour per environment

| Environment         | Provider set up        | Provider not set up                                               |
| ------------------- | ---------------------- | ----------------------------------------------------------------- |
| local, dev          | Sends through Ping4SMS | Sends nothing (a fake). Use Supabase's test numbers               |
| staging, production | Sends through Ping4SMS | **Refuses** (the hook answers 502). A deployment must not pretend |

"Set up" means all of `PING4SMS_API_KEY`, `PING4SMS_SENDER_ID`, `PING4SMS_TEMPLATE_ID` and `PING4SMS_MESSAGE` are set. `SMS_PROVIDER=msg91` (with `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID`) switches to MSG91; settings of a provider that is not named are ignored.

## Setting it up (owner)

1. In the Supabase dashboard of the project, open Authentication, Hooks, Send SMS. Choose an HTTP endpoint and enter `https://<the app's stable address>/api/auth/hooks/send-sms`. Supabase shows a signing secret once: copy it.
2. Put the secret in the app's environment as `SEND_SMS_HOOK_SECRET` (Vercel environment variables, per environment). Never paste it into chat or a file in the repository.
3. From the Ping4SMS panel set `PING4SMS_API_KEY` (never pasted into chat; if it ever appears in a screenshot or a message, ask Ping4SMS for a new one and replace it), `PING4SMS_SENDER_ID` (the six letter DLT sender), `PING4SMS_TEMPLATE_ID` (the DLT template id) and `PING4SMS_ROUTE` (leave empty for `2`; ask Ping4SMS to confirm the route for OTP).
4. Set `PING4SMS_MESSAGE` to the DLT template text **exactly as registered**, with `{#var#}` where the code goes, for example `Your Find Prop code is {#var#}. Do not share it with anyone.` One `{#var#}` only. If the text differs from the registered template by even a character, the operator drops the message and the service may still answer with a message id.
5. Supabase allows the hook five seconds in total including retries, which is why the provider call is cut off at three.

## DLT

India requires a registered entity, a six letter sender id and an approved template for every business text. Until Find Prop has its own (RISK-02), only a template on Ping4SMS's own entity can be used, with their sender id and a place for the code (`{#var#}`); the demo template has none. Ask Ping4SMS for such an OTP template for testing, and start Find Prop's own registration with them before launch.

## If codes stop arriving

- A signed request that fails the check is logged as `send-sms hook request refused` with a reason (`stale`, `bad_signature`, `missing_headers`, `bad_secret`) and never includes the phone or the code. A burst of `bad_signature` after a secret change means the two secrets differ.
- `The code could not be sent` (HTTP 502 to Supabase; Supabase's own log says `Unexpected status code returned from hook: 502`) means the provider refused, was too slow, or is not set up. The hook's log line `send-sms hook could not send the code` (Vercel, Logs, search `send-sms`) has `errorCode` and, for our own errors, a `detail` that names what to look at. It never holds the number, the code, the key or the text.
  - `errorCode: INTERNAL` with `detail` "not configured (missing: …; APP_ENV is …)": a setting is missing in Vercel, for a deployment whose `APP_ENV` is `staging` or `production`. In `dev` a missing setting silently uses the fake sender instead.
  - `errorCode: INTERNAL` with `detail` "PING4SMS_MESSAGE needs exactly one {#var#}": the message setting was cut off or has two. In an env file `#` starts a comment, so the text is cut at `{` when it is pasted through an import box. Re-enter it in the single variable form, with no quotes.
  - `errorCode: UPSTREAM_FAILED` with `detail` "refused the message (code N: …)": Ping4SMS answered with an error number. The table below says what to change.
  - `errorCode: UPSTREAM_FAILED` with `detail` "did not answer in time" or "answered HTTP …": the provider was slow (the call is cut off at 3 seconds) or down.

  | Code | Ping4SMS's meaning       | What to check                                                                                  |
  | ---- | ------------------------ | ---------------------------------------------------------------------------------------------- |
  | 101  | Invalid user             | `PING4SMS_API_KEY` (a replaced key in the panel but not in Vercel)                             |
  | 102  | Invalid sender ID        | `PING4SMS_SENDER_ID`: the six letters of the template's panel row                              |
  | 103  | Invalid contact(s)       | The number: the hook sends ten digits, so check the number the visitor typed                   |
  | 104  | Invalid route            | `PING4SMS_ROUTE`: ask Ping4SMS which route the template belongs to                             |
  | 105  | Invalid message          | `PING4SMS_MESSAGE`: it must equal the registered template, with the code in place of `{#var#}` |
  | 106  | Spam blocked             | The text or the number was blocked by Ping4SMS; ask them                                       |
  | 107  | Promotional block        | The route is promotional; use the OTP or transactional route                                   |
  | 108  | Low credits on the route | Add credits on that route in the Ping4SMS panel                                                |
  | 109  | Promotional route hours  | The promotional route works 9am to 8:45pm only; use the OTP or transactional route             |
  | 110  | Invalid DLT template ID  | `PING4SMS_TEMPLATE_ID`: the full 19 digit ID, no `X` characters                                |

  The meanings are from Ping4SMS's own list (given by the owner, 13 Nov 2026); only 101 has been seen live. Any other answer that is not a long number is also a failure.

- **Accepted is not delivered.** A message id does not prove the phone got the text, and Supabase cannot see a failed delivery. If a customer says no text came, check Sent Items in the Ping4SMS panel: the text must match the registered template, and the account needs credit.
