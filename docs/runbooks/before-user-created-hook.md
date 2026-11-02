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

Built and covered by pgTAP. **Inactive until you select it in the dashboard**, and not yet tested live. Supabase's documentation does not say which sign-up methods fire the hook, so the live test below is part of the job, not an extra.

## Turning it on (owner, dev project first)

1. Wait until the migration has reached dev (the "Deploy database to dev" workflow runs after the merge to `develop`).
2. Supabase dashboard of the dev project: Authentication, Hooks, **Before User Created**. Choose a **Postgres function**, schema `public`, function `hook_before_user_created`, and save. Menu names move around; tell the agent what you see.
3. Run the live test.

## Live test on dev

Run each case and send the agent the output (it holds no secrets). `phone` needs the test number set again in the Phone provider settings (the spike's number was removed in the clean-up).

| Case                                             | How                                                     | Expected                                   | What it settles                                                |
| ------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| Phone sign-in with the test number               | `node scripts/spike-auth.mjs phone`                     | Accepted                                   | The phone provider reaches the guard as `phone`                |
| Email sign-up                                    | `node scripts/spike-auth.mjs signup`                    | Refused with `signup_not_allowed`          | Email sign-up is closed                                        |
| Stranger with Google                             | `node scripts/spike-auth.mjs google`, any other account | Refused                                    | A stranger cannot create an account                            |
| `developer@findsprop.com` with Google            | `node scripts/spike-auth.mjs google`                    | Accepted, `is_super_admin()` true          | The reserved admin still gets in                               |
| Invited builder with Google (account made first) | As spike step C6                                        | Accepted, one account with `email, google` | An existing account still links, whether or not the hook fires |
| A user added in the dashboard (Add user)         | Authentication, Users, Add user                         | Note whether it works                      | Whether the hook also fires for accounts made by an admin      |

The last row matters for the invite flow (S7-T05), which creates the account before the builder row. If the dashboard refuses the user, that flow must create the builder row first, or the guard needs another signal. Record the answer here and in ADR-010.

## Turning it off

Authentication, Hooks, Before User Created: switch it off. It takes effect at once and needs no deploy. Do this first if sign-ups fail for everyone with an internal error, then look at the Auth logs in the dashboard (they carry the hook error and no personal data to paste).

## Rolling back

Nothing in the migration is destructive. Switch the hook off, then fix forward with a new migration; never edit the existing one.
