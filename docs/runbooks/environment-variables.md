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

| Variable                               | What it is                                                                                                                                                        | Where the value comes from                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | The address browsers use for this deployment, with no path. Sign-in builds its return address from it                                                             | The deployment's stable address, for example the Vercel domain |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<project ref>.supabase.co`, **no path** (not `/rest/v1/`)                                                                                                | Supabase, Project Settings, API, Project URL                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key (browser-safe)                                                                                                                                | Supabase, Project Settings, API                                |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server-only secret. Used by the rate-limit counter and the audit log                                                                                              | Supabase, Project Settings, API. Never a `NEXT_PUBLIC_` name   |
| `RATE_LIMIT_HMAC_SECRET`               | At least 32 random characters. Without it every rate-limited anonymous action, such as the staff sign-in button, refuses with an internal error (it fails closed) | You generate it (below)                                        |
| `APP_ENV`                              | `dev` for the deployment that builds `develop`; `staging` or `production` later                                                                                   | You choose                                                     |

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
| `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` | Real SMS sending                         | MSG91, **after DLT approval (still pending, 2 Nov 2026)**. Needed only where `APP_ENV` is `staging` or `production`                             |
| `MSG91_SENDER_ID`                     | Reserved; the OTP call does not use it   | MSG91                                                                                                                                           |

While `APP_ENV` is `dev`, phone codes go through the fake sender and Supabase's test numbers, so MSG91 does not block building or testing the screens.

## Later and optional

| Variable                                              | When                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `OLA_MAPS_API_KEY`, `NEXT_PUBLIC_MAP_STYLE_URL`       | When place search and the map are built                          |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`                     | If error tracking is switched on                                 |
| `FLAG_AI_SEARCH`, `FLAG_MAP_VIEW`, `FLAG_PG_LISTINGS` | Leave unset (off). They hide those features and their navigation |
| `DESIGN_LAB`                                          | `1` only for review on local or dev; ignored in production       |

## Not variables, but needed on the deployed address

Settings in the Supabase dashboard of each project:

- **Redirect URLs:** add `https://<address>/auth/callback` (staff Google sign-in).
- **Before User Created guard:** switch it on in each project (`docs/runbooks/before-user-created-hook.md`).
- **Send SMS hook and CAPTCHA:** when phone sign-in is built.

## Checking a deployment

After setting values, redeploy (Vercel applies changed variables only to new deployments) and open `/api/health`. If the build or the boot fails with "Invalid server environment variables" or "Invalid public environment variables", the message lists the names to fix, never the values.
