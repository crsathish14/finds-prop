# Before User Created guard

Supabase Auth calls the database function `public.hook_before_user_created(event jsonb)` just before it creates any new account, and the function allows or refuses it. It enforces BR-16: only phone customers, the two reserved administrators and invited builders can create an account. Code: migration `20261102100000_before_user_created_guard.sql`, test `supabase/tests/before_user_created_guard.test.sql`. Reasons: ADR-010.

## What it does

| Sign-up                                                                | Answer                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| Phone code (`provider` is `phone`)                                     | Allowed                                         |
| Google, address is one of the two reserved administrators              | Allowed                                         |
| Google, address belongs to an **active** invited builder               | Allowed                                         |
| Google, any other address                                              | Refused: HTTP 403, `signup_not_allowed`         |
| Email and password, with any address (including a reserved or invited) | Refused, so nobody can squat on a staff address |
| Anonymous, or a provider it does not know, or an unreadable event      | Refused                                         |

It is an allow-list and it never raises an error, because an error inside a hook stops every sign-up with an internal error. The refusal is a code; the app turns it into text from `en.json` when the staff sign-in screens exist.

## Status

**Live on the dev project since 2 Nov 2026, and tested live** (results below). Built and covered by pgTAP; the owner enabled it on dev and ran the six cases. Staging and production do not exist yet: switch it on there, as part of the Supabase configuration check (S3-T14), before launch.

**Local stack and CI:** the guard is switched on in `supabase/config.toml`, so the integration job runs against it (`tests/integration/before-user-created-guard.test.ts`): a phone sign-up gets through, an anonymous sign-in is refused and leaves no account, and an account made through the admin API is not blocked. Anonymous sign-ins are allowed by the local config only so that refusal can be seen; a hosted project keeps them off and `scripts/verify-supabase-config.mjs` fails one that does not. The Google and email cases cannot be reached locally (no Google credentials, email sign-up off); pgTAP and the dev live test cover them.

## Turning it on (owner, per project)

1. Wait until the migration has reached the project (the "Deploy database to dev" workflow runs after the merge to `develop`; staging and production come only through CI from `main`).
2. Supabase dashboard of the project: Authentication, Hooks, **Before User Created**. Choose a **Postgres function**, schema `public`, function `hook_before_user_created`, and save. Menu names move around; tell the agent what you see.
3. Run the live test.

## Live test on dev (2 Nov 2026)

| Case                                             | How                                                       | Result                                                                                   |
| ------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Phone sign-in with the test number (new account) | `node scripts/spike-auth.mjs phone`                       | Allowed; role `customer`; phone claim set                                                |
| Email sign-up                                    | the direct call below                                     | Refused: HTTP 403, `signup_not_allowed`                                                  |
| Stranger with Google                             | `node scripts/spike-auth.mjs google`, any other account   | Refused: "Google sign-in did not finish: signup_not_allowed"; no account row was created |
| `developer@findsprop.com` with Google            | `node scripts/spike-auth.mjs google` (a **new** account)  | Allowed; `is_super_admin()` true; roles `customer, super_admin`                          |
| Invited builder with Google (account made first) | Add user in the dashboard, the builder SQL, then `google` | Allowed; one account with identities `email, google`; roles `customer, builder`          |
| A user added in the dashboard (Add user)         | Authentication, Users, Add user                           | **Created**: the guard does not block accounts made by an admin                          |

What this means:

- The guard fires for phone, email and Google sign-ups. Accounts made from the dashboard are not blocked, so the invite flow (S7-T05) can create the builder's account first, then the builder row. The live invite flow uses the same admin route; confirm it when it is built.
- Supabase reports a refusal as HTTP 403 with `msg: signup_not_allowed` and `error_code: unknown`. The app must recognise it by the `msg` text.
- The guard checks only **brand-new** accounts. An existing user (or an existing user that Google links to) is never rechecked. To test an allow rule, use an address that has no account yet: the first run of the `developer@` case used an old account and proved nothing, and was repeated after deleting it.
- Supabase's documentation does not say which sign-up methods fire the hook; this test is the answer for phone, email, Google and admin-created accounts.

### Email sign-up call

`node scripts/spike-auth.mjs signup` cannot test this: its fake `…@example.test` address is rejected as invalid before the guard runs. Use an address you own (for example a plus-address) in your own terminal, with the two `SPIKE_` values set from the dev project's URL and publishable key:

```powershell
$env:SPIKE_TEST_EMAIL = "<an address you own>"
node --input-type=module -e "const r = await fetch(process.env.SPIKE_SUPABASE_URL + '/auth/v1/signup', { method: 'POST', headers: { apikey: process.env.SPIKE_PUBLISHABLE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.SPIKE_TEST_EMAIL, password: crypto.randomUUID() }) }); const body = await r.json(); console.log(r.status, JSON.stringify({ code: body.code, error_code: body.error_code, msg: body.msg ?? body.message }))"
```

It prints only the status and the error text. A `200` means the guard did not fire; delete the unconfirmed user it created.

## Turning it off

Authentication, Hooks, Before User Created: switch it off. It takes effect at once and needs no deploy. Do this first if sign-ups fail for everyone with an internal error, then look at the Auth logs in the dashboard (they carry the hook error and no personal data to paste).

## Rolling back

Nothing in the migration is destructive. Switch the hook off, then fix forward with a new migration; never edit the existing one.
