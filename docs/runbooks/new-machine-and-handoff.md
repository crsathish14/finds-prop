# Moving to a new machine, and picking the work up

Written 1 Nov 2026, when the owner moved to another computer in the middle of Stage 3. It holds no secrets and must never gain any: no keys, passwords, connection strings or tokens, here or in chat.

## 1. Set up the new machine

1. Install Node.js 24 (`.nvmrc`), npm 10.9 or newer, Git, and the GitHub CLI (`gh auth login` as the repository owner). The Supabase CLI and gitleaks are optional.
2. Clone `crsathish14/finds-prop`, then `git checkout develop` (or the branch named in section 3). Keep the path short, and pause OneDrive sync during `npm ci` if the folder is inside OneDrive.
3. `npm ci`, then `npm run doctor` and fix what it reports.
4. `cp .env.example .env.local` and fill in only the three browser-safe values for the **dev** Supabase project: its URL, its **publishable** key and the site address. Copy them from the Supabase and Vercel dashboards, never from a chat. The service-role key is not needed yet.
5. `npm run check` must pass before any work starts.
6. The planning folder `property-platform-implementation-plan/` is **not** in this repository (the owner's copy). Copy it next to the repository folder, because task IDs such as `S3-T09` and the route table come from it.

## 2. What does not travel with the old machine

- The assistant's private memory is stored on the old machine only. Everything that matters is in the repository: `AGENTS.md`, `docs/status.md`, `docs/engineering/`, the ADRs and this file.
- Terminal variables such as `SPIKE_SUPABASE_URL` vanished when the old terminal closed. Set them again for the spike (`docs/runbooks/auth-spike.md`, part B).
- Dashboard settings (Supabase, Google Cloud, Vercel, GitHub secrets) live online and are unchanged.

## 3. Where the work stands (1 Nov 2026)

- **Merged into `develop`:** the whole database, the dev deploy workflow, session guards, the full `defineAction` pipeline, and the phone-code hook with the MSG91 adapter.
- **Open pull request #29** (`feat/route-skeleton`, task S3-T11): the guarded route skeleton and the `site` settings module. All checks pass, including Vercel. **The owner merges it.** Before merging, the three `NEXT_PUBLIC_…` variables must also be set for Vercel's **Production** environment, because Production builds `develop`.
- **Vercel:** the preview build had failed because its `NEXT_PUBLIC_…` variables were wrong after the Supabase project was replaced. They are fixed.
- **Supabase dev project:** replaced earlier, so migrations must be applied to the new one: GitHub, Actions, "Deploy database to dev", Run workflow, branch `develop`. Check that it has run on the new project.
- **Google sign-in provider:** set up in the Supabase dashboard (owner, 1 Nov 2026).
- **Auth spike (S3-SPK-01):** not run. The owner decided to continue on the other machine. Dashboard part A is partly done (Google). Still to check: phone test number `+919000000001` with code `123456`, the redirect URL `http://localhost:54999/callback`, and a test user with no phone. Then run the script as in `docs/runbooks/auth-spike.md`.
  - Already learned: "Allow new users to sign up" is **on**, and the "Before User Created" hook is **available** on the plan. The breadcrumb showed a `PRODUCTION` badge on the project named `main`; the owner confirmed it is the dev project.
- **Waiting on others:** MSG91 DLT approval (needed before real phone codes), the Send SMS hook dashboard setup (needs the stable app address and `SEND_SMS_HOOK_SECRET`), and 2-Step Verification for `support@drizzlemarketings.com`.
- **Next tasks, after the spike results:** the phone sign-in screens, CAPTCHA and per-phone limits (rest of S3-T09); staff Google sign-in and the invitation flow (S3-T10, needs approved Google-only UX screens first); seeds (S3-T13); the Supabase config check (S3-T14); the CI integration job (H3-T01); then finalise ADR-010 from the spike results.

## 4. Working agreement (what the assistant must keep doing)

- Plan first for class C2 work, wait for "approved", then build. Write and open pull requests directly, never merge them, never force-push.
- Ask before every `git push` and every deploy trigger.
- Never run `supabase link`, `db push`, `--linked` or `--db-url`. Migrations reach dev only through the `db-deploy.yml` workflow after a merge to `develop`.
- No new dependencies without approval. Never open `.env*` files. Never ask for or paste secrets (keys, passwords, connection strings); the owner pastes only names and error lines.
- Names are whole words. Build only what the approved UX shows; if a screen or state is missing, stop and ask.

## 5. What to say in the first message of the new session

Paste this:

> Read `AGENTS.md`, `docs/status.md` and `docs/runbooks/new-machine-and-handoff.md`, then tell me in a few lines where the project stands and what you suggest next. I am continuing on a new machine. Help me finish the setup in section 1 first, one step at a time. Then check the state of pull request #29 and the Deploy database to dev workflow, and walk me through the auth spike (`docs/runbooks/auth-spike.md`) from step C1. I will paste each output. Do not run `supabase link` or `db push`, ask before every push, and do not ask me for any secret.
