# Staff Google sign-in

Builders, agents and the administrator sign in with Google only: no password, no reset, no second step (owner decision, 1 Nov 2026). Pages `/builder/login` and `/admin/login`; they send the browser to Google, and Google, through Supabase, sends it back to `/auth/callback`. Code: `src/features/staff-auth/` (button, action, pages), `src/app/auth/callback/route.ts` and `src/server/auth/staff-callback.ts` (the callback), `src/server/auth/staff-sign-in.ts` (the pure rules). Reasons: ADR-010.

## Who gets in

| Account                                                       | `/builder/login`                                                                                 | `/admin/login`                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Builder or agent with the `builder` role and an active record | In, to `/builder/dashboard`                                                                      | Denied ("This account isn't authorised") |
| `developer@findsprop.com` (and later `support@…`)             | Denied (no builder record)                                                                       | In, to `/admin/dashboard`                |
| A deactivated builder                                         | Denied                                                                                           | Denied                                   |
| A customer, or any other existing account                     | Denied and signed out                                                                            | Denied and signed out                    |
| A stranger's Google account                                   | Refused by the before-user-created guard, so no account is made: the page shows the denied state | Same                                     |
| Cancelled at the Google screen                                | "Sign-in was cancelled"                                                                          | Same                                     |

Every refusal is the same generic message. It never shows an invited address or the reason.

## Setup (owner, before the first real sign-in)

1. Supabase dashboard of the dev project: Authentication, URL Configuration, **Redirect URLs**. Add `http://localhost:3000/auth/callback` for local work, and `https://<the stable dev address>/auth/callback` once there is one. Do not add Vercel preview addresses: each deployment has its own, and the callback address is built from `NEXT_PUBLIC_SITE_URL`.
2. `.env.local`: `NEXT_PUBLIC_SITE_URL` must be the address your browser uses (`http://localhost:3000` locally). Google Cloud needs no change: its redirect URI is still Supabase's own callback.
3. Menu names move around; tell the agent what you see.

## Live check on dev

Run it from `npm run dev` (or a build with `npm start`) and open `http://localhost:3000/builder/login`. There is no sign-out button yet: the `signOut` action exists (S3-T09), but the avatar menu that will call it is not on any page until the header is built (S4-T06). To try another account, clear the site's cookies or use a private window.

| Case                                  | How                                                                                                                      | Expected                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| An invited, active builder            | Make one as in spike step C6 (account, `builder` role, builder row); sign in with its Google account at `/builder/login` | Lands on `/builder/dashboard`                                      |
| The administrator                     | Sign in with `developer@findsprop.com` at `/admin/login`                                                                 | Lands on `/admin/dashboard`                                        |
| A builder at the admin page           | Sign in with the builder's account at `/admin/login`                                                                     | Back at `/admin/login` with the not-authorised message, signed out |
| The administrator at the builder page | Sign in with `developer@` at `/builder/login`                                                                            | Back at `/builder/login` with the denied message                   |
| A stranger                            | Any other Google account at `/builder/login`                                                                             | Denied message; no new user in Authentication, Users               |
| A deactivated builder                 | Set `active = false` on the builder row, then sign in                                                                    | Denied message                                                     |
| Cancel at Google                      | Press Cancel or close the Google screen                                                                                  | "Sign-in was cancelled"                                            |
| Too many attempts                     | Press the button 11 times within 10 minutes                                                                              | "Too many attempts", button disabled                               |

After each case, check Authentication, Users and the audit log: a sign-in writes `staff.signed_in`, a refusal of an existing account writes `staff.sign_in_denied`. Clean up as in spike section D (test users, the test builder row).

## Live check results (dev project, 2 Nov 2026)

| Case                                               | Result                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| The administrator (`developer@`) at `/admin/login` | In, landed on `/admin/dashboard`                                                |
| An invited, active builder at `/builder/login`     | In, landed on `/builder/dashboard`; Google linked to the dashboard-made account |
| The builder at `/admin/login`                      | `/admin/login?denied=1`, "This account isn't authorised", signed out            |
| The administrator at `/builder/login`              | `/builder/login?denied=1`, "This Google account can't sign in here", signed out |

The server log showed one `staff signed in` or `staff sign-in denied` line for each, with only the area and the user id. The audit log held the four matching rows (`staff.signed_in` for `super_admin` and `builder`, `staff.sign_in_denied` for `builder` and `super_admin`), with no email or name. The test builder, its builder row and its user were deleted afterwards.

Not yet tried live: a stranger's Google account, a cancelled Google screen, a deactivated builder, and the too-many-attempts limit. They are covered by unit tests and the CI smoke run, not by a real Google round trip.

## If it does not work

- **"redirect URL not allowed" (or the page stays on Supabase):** the callback address is missing from the Redirect URLs list, or `NEXT_PUBLIC_SITE_URL` is not the address the browser is using.
- **Always "something went wrong":** the logs carry the reason without personal data: `staff sign-in code exchange failed`, `could not read the new session`, or `callback without a code`, each with a request id (`x-request-id` on the response).
- **Always "denied" for a builder:** the account needs the `builder` role and an active row in `builders` (`user_id` set, `active = true`).

## Not built here

The Sign out button (the action is built, S3-T09; the menu waits for the header, S4-T06), the shared header and footer on these pages (the shared layout), and the invitation flow that creates the builder's account (S7-T05).
