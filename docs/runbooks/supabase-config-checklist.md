# Supabase configuration checklist

Many Supabase settings live in the dashboard, not in a migration: providers, hooks, redirect addresses, test codes, CAPTCHA. They have gone wrong before (a redirect address with `/rest/v1/` on the end, a phone provider that would not save without Twilio values, a hook that was off). `scripts/verify-supabase-config.mjs` reads a project's Auth settings and compares them with what the app expects. Run it after any change in the dashboard, and before every launch (S9-T01 for production).

It is **read-only** (one GET) and **you run it**, in your own terminal. An agent never does, because it needs a personal access token. It never prints a token, a secret or a setting's value: only which check passed, failed or warned.

## About the token

A Supabase personal access token belongs to your **whole account**, not to one project, and the dashboard may not offer a read-only kind. The script only reads, but a leaked token could change or delete projects. So:

- Create it just before you run the check, give it a clear name (for example `config-check`) and, if the dashboard offers an expiry, choose the shortest.
- Keep it in **one terminal window** only. Never paste it into a chat, a file, Vercel or GitHub.
- When you are done, **delete it** in the dashboard and close the terminal.

## Running it

1. In the Supabase dashboard: your account menu, Account preferences, **Access Tokens**, Generate new token. Copy it once. (Menu names move around; tell the agent what you see.)
2. Find the project reference: Project Settings, General, Reference ID (20 lowercase letters; it is also the start of the project's address).
3. In PowerShell, in the `findsprop` folder:

   ```powershell
   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
   node scripts/verify-supabase-config.mjs --project-ref <20 letters> --site-url https://<the app's address> --environment dev
   ```

   `--site-url` is the address the app is served from, with no path (the same as `NEXT_PUBLIC_SITE_URL`): `http://` or `https://`, the host and an optional port, with no path, space or quotes. The script refuses anything else before it sends a request. Without it the checks that depend on it are skipped, and say so. `--environment` is `dev` (the default), `staging` or `production`. `--strict` makes a warning fail the run as well.

4. Paste the output to the agent if you want help. It holds no secrets.
5. Delete the token and close the terminal.

The exit code is 1 when a check failed, so it can later run from a script.

## What it checks

`fail` stops the run, `warn` is reported but allowed, `skip` does not apply. The dev project is still being built, so what depends on unfinished work (the Send SMS hook waits on DLT approval, CAPTCHA on the phone sign-in) only warns there.

| Check                | Asks                                                                                                                                   | dev  | staging | production |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- | ---------- |
| `google-enabled`     | Google sign-in is on (staff sign in with Google only)                                                                                  | fail | fail    | fail       |
| `phone-enabled`      | Phone sign-in is on (customers use a code)                                                                                             | fail | fail    | fail       |
| `phone-confirmation` | A phone number must be confirmed with a code                                                                                           | fail | fail    | fail       |
| `anonymous-off`      | Anonymous sign-ins are off                                                                                                             | fail | fail    | fail       |
| `signups-open`       | Sign-ups are open: the guard decides who may create an account, and with sign-ups off the first Google sign-in of a staff member fails | fail | fail    | fail       |
| `guard-hook`         | The before-user-created guard is on and points at `hook_before_user_created`                                                           | fail | fail    | fail       |
| `callback-listed`    | `<site address>/auth/callback` is in the redirect list (a `/**` entry above it also counts)                                            | fail | fail    | fail       |
| `site-url`           | The project's site address is this deployment's address                                                                                | warn | fail    | fail       |
| `no-local-redirects` | No `localhost` or `127.0.0.1` address is in the redirect list                                                                          | skip | warn    | fail       |
| `send-sms-hook`      | The Send SMS hook is on and points at `<site address>/api/auth/hooks/send-sms`                                                         | warn | fail    | fail       |
| `captcha`            | CAPTCHA is on with Turnstile                                                                                                           | warn | fail    | fail       |
| `no-test-codes`      | No test phone numbers with fixed codes are set                                                                                         | skip | fail    | fail       |
| `test-codes-current` | Test phone numbers, if set, have not expired                                                                                           | warn | skip    | skip       |

## What it cannot check

Do these by hand: the Google Cloud OAuth client (its redirect address must be Supabase's own callback, shown on the Supabase Google provider page), the email provider, SMTP and templates, the Twilio placeholder values the dashboard demands on dev, the Vercel environment variables (`docs/runbooks/environment-variables.md`), the project's plan (hooks need one that offers them), and backups before launch.

## If a check fails

Fix the setting in the dashboard, then run the script again. For `guard-hook` see `docs/runbooks/before-user-created-hook.md`; for `callback-listed` and `site-url` see `docs/runbooks/staff-google-sign-in.md`.
