# Auth spike checklist (S3-SPK-01)

This is a throwaway experiment on the **dev** Supabase project only. You run the steps; the test script prints what Supabase does; you send the output to the agent. Nothing here touches staging or production, and nothing is sent to the agent except the script output (it holds no secrets or personal data).

**Owner decisions it builds on (1 Nov 2026):** builders and agents sign in with Google only, with no password, no SMS code and no second factor. Customers sign in with a phone code. The admin signs in with Google only.

**What we want to learn**

1. Does a Google sign-in land on the invited builder's account, or create a second account?
2. Does the reserved admin address become `super_admin` when it signs in with Google (BR-12)?
3. What does the sign-in token say about the phone for phone users and for Google users? The "verified phone" check depends on it.
4. Is sign-up by email closed, and can a stranger create an account by signing in with Google?
5. Does a test phone number with a fixed code work, and how long does it take?

## A. One-time setup on the dev project (dashboard)

Do these in the Supabase dashboard of `findsprop-dev`. Menu names move around; if a name differs, tell the agent what you see.

1. **Phone provider.** Authentication, Sign In / Providers, Phone. Enable it. Find **Test Phone Numbers and OTPs** and add two fictional numbers with fixed codes, for example `+919000000001` with code `123456`. If the dashboard insists on an SMS provider before it lets you save, stop and tell the agent what it asks for. Do not enter real provider keys.
2. **Email provider.** Leave it as it is for now. Run step C1 first so we see its current state.
3. **Google provider.** Create a Google OAuth client (free, about 10 minutes): in Google Cloud Console, create a project, set up the consent screen, then create an OAuth client of type **Web application**. For "Authorized redirect URIs" paste the **callback URL shown on the Supabase Google provider page**. Copy the Client ID and Client Secret into that same Supabase page. The secret goes only into the Supabase dashboard.
4. **Redirect list.** Authentication, URL Configuration, Redirect URLs. Add `http://localhost:54999/callback`.
5. **A test user with no phone.** Authentication, Users, Add user, Create new user. Use a made-up email such as `spike-staff@example.test`, a password you make up, and tick auto confirm.

## B. Prepare your terminal (PowerShell, in the `findsprop` folder)

The values stay in this terminal window only; closing it removes them. Copy the project URL and the **publishable** key from Project Settings, API. Never use a secret or service key.

```powershell
$env:SPIKE_SUPABASE_URL = "https://<project ref>.supabase.co"
$env:SPIKE_PUBLISHABLE_KEY = "<publishable key>"
```

## C. Run and record

For each run, copy the whole output into your reply.

1. **Sign-up by email.** `node scripts/spike-auth.mjs signup`. It says whether email sign-up is open. If it was accepted, delete the `spike-...@example.test` user in the dashboard.
2. **Phone test number.** Set `$env:SPIKE_PHONE = "+919000000001"` and `$env:SPIKE_OTP = "123456"`, then `node scripts/spike-auth.mjs phone`. Note the time it prints.
3. **A user with no phone.** Set `$env:SPIKE_EMAIL` and `$env:SPIKE_PASSWORD` to the test user from A5, then `node scripts/spike-auth.mjs password`.
4. **The reserved admin with Google.** `node scripts/spike-auth.mjs google`. Open the address it prints and sign in with the administrator Google account (`support@drizzlemarketings.com`).
5. **A stranger with Google.** Run `google` again and sign in with any other Google account that was **not** invited. It creates a test account on dev; delete it afterwards.
6. **An invited builder with Google.** First, in Authentication, Users, add a user whose email is the Google address of a test builder (auto confirm, any password). Then in the SQL editor run this once, with that address in both places:

   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'builder' from auth.users where email = 'TEST-BUILDER@gmail.com';
   insert into public.builders (user_id, email, name)
   select id, email, 'Spike Test Builder' from auth.users where email = 'TEST-BUILDER@gmail.com';
   ```

   Then `node scripts/spike-auth.mjs google` and sign in with that Google account. Look at the line "Identities on the account": one account with both email and Google means it linked; a second separate account means it did not.

Also tell the agent: (a) what the Email provider page offers about allowing new sign-ups, and (b) whether Authentication, Hooks shows a "Before User Created" hook on your plan.

## D. Clean up

Delete every test user in Authentication, Users. Then in the SQL editor: `delete from public.builders where name = 'Spike Test Builder';`.

## E. What the results decide

| Result                                             | Decides                                                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Google lands on the invited account                | Invite flow: the admin only needs the builder's Google email on file                                                    |
| Google makes a second account                      | The invite needs a database step that links the new account to the invited builder on first sign-in                     |
| Reserved admin gets `super_admin` through Google   | BR-12 holds for Google; no change                                                                                       |
| Stranger can create an account with Google         | A "Before User Created" check (or another guard) is needed so only invited staff and phone customers get in             |
| Phone claim is empty for Google and password users | `has_verified_phone()` stays as written; builders and agents cannot do customer actions unless they also verify a phone |
| Test phone numbers work                            | Local and dev sign-in tests need no SMS provider                                                                        |

The Send-SMS hook test (S3-SPK-02) comes later, when the hook route exists (S3-T09).
