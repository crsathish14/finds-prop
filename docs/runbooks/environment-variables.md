# Environment variables

Names only. A value never goes in the repository, in a chat or in a log (R-GEN-07, R-GEN-08). The app reads them in two files only: `src/server/env.ts` (server) and `src/lib/public-env.ts` (browser-safe, inlined into the page). The template is `.env.example`. A missing or malformed value stops the build or the boot with a message that lists names only.

## Where each kind lives

| Where                                   | What goes there                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `.env.local` (your machine)             | The dev project's values, for local work                                     |
| Vercel, Settings, Environment Variables | The deployed app. **Production, Preview and Development are set separately** |
| GitHub, Settings, Environments          | CI secrets. `dev` already holds `DEV_DATABASE_URL`                           |
| Supabase dashboard                      | Hook secrets, CAPTCHA and email settings (not environment variables)         |

Today Vercel's **Production** scope builds `develop` and uses the **dev** Supabase project (handoff, 1 Nov 2026), so give it the dev project's values and `APP_ENV=dev`. **Preview** builds validate the same variables, so they need the browser-safe three at least. When a real production project exists, it gets its own values and `APP_ENV=production`.

## Needed now

The first three are required: the app will not start without them. The rest are needed for staff sign-in, and for any rate-limited action, to work on a deployed address.

| Variable                               | What it is                                                                                                                                                                                                                   | Where the value comes from                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | The address browsers use for this deployment, with no path. Sign-in builds its return address from it, and so does every canonical link, share address and sitemap entry (ADR-047): in production it must be the real domain | The deployment's stable address, for example the Vercel domain |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<project ref>.supabase.co`, **no path** (not `/rest/v1/`)                                                                                                                                                           | Supabase, Project Settings, API, Project URL                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key (browser-safe)                                                                                                                                                                                           | Supabase, Project Settings, API                                |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server-only secret. Used by the rate-limit counter and the audit log                                                                                                                                                         | Supabase, Project Settings, API. Never a `NEXT_PUBLIC_` name   |
| `RATE_LIMIT_HMAC_SECRET`               | At least 32 random characters. Without it every rate-limited anonymous action, such as the staff sign-in button, refuses with an internal error (it fails closed)                                                            | You generate it (below)                                        |
| `APP_ENV`                              | `dev` for the deployment that builds `develop`; `staging` or `production` later                                                                                                                                              | You choose                                                     |

Why `APP_ENV` matters: its default is `local`, which trusts no proxy headers, so on a deployed address every visitor would share one rate-limit bucket. Outside `production` the site sends `noindex`. In `local` and `dev` the SMS sender is a fake; in `staging` and `production` it is real or refuses. In `production` the Design Lab is never served.

Generate the secret in your own terminal and paste it straight into Vercel, never into a chat:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Changing `RATE_LIMIT_HMAC_SECRET` later only resets the visitor hashes, which is acceptable.

## Soon: customer phone sign-in (S3-T09)

| Variable                              | What it is                               | Where the value comes from                                                                                                                      |
| ------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `SEND_SMS_HOOK_SECRET`                | The signing secret for the Send SMS hook | Supabase shows it once when you add the hook (Authentication, Hooks). Needs the stable app address: `https://<address>/api/auth/hooks/send-sms` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`      | The CAPTCHA site key (browser-safe)      | Cloudflare Turnstile. Its secret key goes in the Supabase dashboard's CAPTCHA setting, not in Vercel                                            |
| `PING4SMS_API_KEY`                    | Real SMS sending: the account key        | The Ping4SMS panel. Never pasted into chat; replace it if it ever appears in one. Needed only where `APP_ENV` is `staging` or `production`      |
| `PING4SMS_SENDER_ID`                  | The six letter DLT sender                | Ping4SMS (their DLT entity for now; Find Prop's own once approved)                                                                              |
| `PING4SMS_TEMPLATE_ID`                | The DLT template id                      | Ping4SMS                                                                                                                                        |
| `PING4SMS_MESSAGE`                    | The DLT template text with `{#var#}`     | Exactly as registered, one `{#var#}` where the code goes. See `docs/runbooks/send-sms-hook.md`                                                  |
| `PING4SMS_ROUTE`                      | The Ping4SMS route; `2` when empty       | Ask Ping4SMS to confirm the route for OTP traffic                                                                                               |
| `SMS_PROVIDER`                        | `ping4sms` (when empty) or `msg91`       | Leave empty. `msg91` is a fallback only; the owner has no MSG91 account                                                                         |
| `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` | MSG91 fallback only                      | Used only with `SMS_PROVIDER=msg91`                                                                                                             |
| `MSG91_SENDER_ID`                     | Reserved; the OTP call does not use it   | MSG91                                                                                                                                           |

While `APP_ENV` is `dev`, phone codes go through the fake sender and Supabase's test numbers, so the SMS provider does not block building or testing the screens.

**Code lifetime (owner setting, each Supabase project).** The code screen says "Codes work for 5 minutes", so set the phone code expiry to **300 seconds** in the project's phone provider settings (the default is 3600). Supabase answers a wrong code and an expired one with the same error, so the screen calls a refused code "expired" only when five minutes have passed since it asked for one; with a longer expiry a code that is still valid could be called expired.

**CAPTCHA on dev.** Turnstile is free and needs only a Cloudflare account (no domain on Cloudflare). For the dev project and `localhost`, Cloudflare publishes dummy keys that work on any hostname (see "Testing" in Cloudflare's Turnstile documentation): a dummy site key in `.env.local` and the matching dummy **secret** in the Supabase dashboard's CAPTCHA setting (provider Turnstile). A dummy token is accepted only by a dummy secret, so dummy keys must never reach staging or production. Without `NEXT_PUBLIC_TURNSTILE_SITE_KEY` the sign-in page shows "Check failed" and Send code stays off (it fails closed). For staging and production, create one real widget per environment with that environment's hostnames.

## Email verification (owner settings, each Supabase project)

**Switched off for this version.** `FLAG_CUSTOMER_EMAIL` is off by default (`0`), and while it is off customers are never asked for an email: sign-in ends after the code (and the optional name), the dashboard shows no email card or reminder, and posting a property needs only the verified phone (the database already checks only that: `submit_listing` uses `has_verified_phone()`). The server also refuses the add-email and resend-link actions with `NOT_FOUND`, so no customer email can be sent by calling them directly. Nothing was removed: when an email provider exists, do the steps below and set `FLAG_CUSTOMER_EMAIL=1` (in Vercel for the environment, and in `.env.local` locally) and the email step, the dashboard prompt and the post-property gate come back. Builders and admins are not affected: they sign in with Google, and a builder's address is added in Supabase by hand.

Customers verify an email with a single-use link that Supabase sends and `/auth/confirm` finishes (S3-T09, ADD-03). None of this is an environment variable; all of it is set in the Supabase dashboard (Authentication, then Emails), and the email step cannot be tried live until it is done. The first live test (3 Nov 2026) taught the order below.

1. **Custom SMTP comes first, because it unlocks the templates.** With Supabase's built-in sender the Templates tab says "Set up custom SMTP to edit templates" and the email keeps the default link, which does not go to `/auth/confirm`. The built-in sender also reaches only the organisation's own team members, at 2 emails an hour. Set up custom SMTP (Resend, per the accounts checklist): on the SMTP Settings tab, host `smtp.resend.com`, port `465`, username `resend`, password an API key with sending access (never pasted into chat or a file, and rotated at once if it ever appears in a screenshot).
2. **A sender that can reach customers needs a verified domain.** Resend's shared test sender (`onboarding@resend.dev`) delivers only to the email the Resend account was created with. Here that is `developer@findsprop.com`, the reserved administrator's address, which the app refuses as a customer email on purpose (see below), so the test sender cannot be used to try the customer flow. Verify `findsprop.com` in Resend (Domains: add it, add the DNS records it shows, usually on a `send` subdomain; check it does not ask to replace an existing SPF record), then set Supabase's sender email to an address on it, for example `no-reply@findsprop.com`.
3. **The "Change email address" template.** A customer adds an email to a phone account, which Supabase treats as an email change. Make its link `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email_change`. `{{ .RedirectTo }}` is the address the app sends with each request (`NEXT_PUBLIC_SITE_URL` plus `/auth/confirm`), so the same project serves localhost and the deployed site with no Site URL juggling. With the default link the visitor lands on the expired page.
4. **Redirect list.** Add `<site address>/auth/confirm` and `<site address>/auth/callback` under Authentication, then URL Configuration, for each address the app runs on (for local work `http://localhost:3000`, which means port 3000 must be free). If an address is missing, Supabase ignores `{{ .RedirectTo }}` and falls back to the Site URL, and the link lands on the expired page.
5. **Link lifetime.** The screen says "The link works for 1 hour"; Supabase's email link expiry is 3600 seconds by default, which matches. If you change it, change the screen text too (it is still marked "Duration to confirm").

**Do not try the flow with a reserved administrator address** (`developer@findsprop.com`, `support@drizzlemarketings.com`). That address already belongs to the administrator's Google account, so a customer cannot take it: the email step answers "We couldn't use that email" and does not say why, which is the protection working (ADR-010). Test with another address, for example a personal one, once the domain is verified.

The app limits emails itself: 5 per user per hour and 20 per address per day (the `email_link` scope), on top of Supabase's own limit (30 an hour once custom SMTP is on).

## Later and optional

| Variable                                              | When                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `OLA_MAPS_API_KEY`, `NEXT_PUBLIC_MAP_STYLE_URL`       | When place search and the map are built                                |
| `AI_PROVIDER`, `AI_MODEL`, `OPENAI_API_KEY`           | When the AI chat is switched on (see below)                            |
| Error tracking variables                              | When error tracking is switched on (see below)                         |
| `FLAG_AI_SEARCH`, `FLAG_MAP_VIEW`, `FLAG_PG_LISTINGS` | Leave unset (off). They hide those features and their navigation       |
| `FLAG_CUSTOMER_EMAIL`                                 | Leave `0` until an email provider is set up (see "Email verification") |
| `DESIGN_LAB`                                          | `1` only for review on local or dev; ignored in production             |

## Error tracking (optional; ADR-130)

Everything is off until the addresses are set, and every variable is optional. The Sentry project belongs to the owner's own account (EU region, free plan). One project serves every environment; the environment label tells them apart.

| Variable                         | What it is                                                               | Where the value comes from                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `SENTRY_DSN`                     | The project address the server sends reports to                          | Sentry, Project Settings, Client Keys (DSN). Not secret, but keep it out of chat anyway                     |
| `NEXT_PUBLIC_SENTRY_BROWSER_DSN` | The same address, for the browser (it is visible in the page by design)  | The same value as `SENTRY_DSN`                                                                              |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | The environment label on browser reports: `dev`, `staging`, `production` | You choose; use the same word as `APP_ENV` so server and browser reports filter together                    |
| `SENTRY_AUTH_TOKEN`              | Uploads source maps at build time (part 3)                               | Sentry, Settings, Auth Tokens. A secret: only in Vercel's build settings, never in chat, a file or the page |
| `VERCEL_GIT_COMMIT_SHA`          | The release name on server reports                                       | Set by Vercel on every deployment; do not set it yourself                                                   |

The browser addresses are read when the site is built, so a change needs a new deployment. Until part 2 adds the Sentry address to the content security policy, do not set `NEXT_PUBLIC_SENTRY_BROWSER_DSN` on a deployed site: the browser would block the reports.

## AI chat (optional while `FLAG_AI_SEARCH` is off)

All three are server-only (read in `src/server/env.ts`, never `NEXT_PUBLIC_`) and optional. `chooseAiProvider("openai")` in `src/server/ai/` reads `OPENAI_API_KEY` and `AI_MODEL`, and refuses (naming the variable, never a value) if either is missing. Leave them unset until the chat is switched on.

| Variable         | What it is                                                                             | Where the value comes from                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `AI_PROVIDER`    | `fake`, `openai` or `gemini`. `fake` is the scripted provider for tests and local work | You choose. `openai` is the first real provider (ADR-128)                                                      |
| `AI_MODEL`       | The model id the provider is called with. No model name is written in code             | You choose, after the provider spike (`docs/runbooks/ai-spike.md`)                                             |
| `OPENAI_API_KEY` | The OpenAI API key, used only with `AI_PROVIDER=openai`                                | The OpenAI dashboard, a project key. Never pasted into chat or committed; replace it if it ever appears in one |

## Not variables, but needed on the deployed address

Settings in the Supabase dashboard of each project:

- **Redirect URLs:** add `https://<address>/auth/callback` (staff Google sign-in).
- **Before User Created guard:** switch it on in each project (`docs/runbooks/before-user-created-hook.md`).
- **Send SMS hook and CAPTCHA:** when phone sign-in is built.

## Checking a deployment

After setting values, redeploy (Vercel applies changed variables only to new deployments) and open `/api/health`. If the build or the boot fails with "Invalid server environment variables" or "Invalid public environment variables", the message lists the names to fix, never the values.
