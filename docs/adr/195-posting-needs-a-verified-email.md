# ADR-195 · Sending a listing for review needs a verified email, behind a switch (customer email, part 1)

- Status: Accepted for part 1 (the database rule and how the wizard meets it). The rule is **off** until the owner sets the switch; nothing changes for anyone today. Parts 2 to 4 of the plan (copy the verified address in, prefill, runbook, rollout) are separate changes.
- Date: 2026-11-26
- Related: ADD-03 (the email prompts and the posting gate, approved 3 Nov 2026), ADR-010 (authentication design), ADR-060 (listing submit), ADR-138 (the location rule of `submit_listing`), ADR-186 (the poster's contact email), ADR-151 (public settings with a super-admin write), R-DB-07 (a rule is enforced in the service and in the database), the plan `CUSTOMER_EMAIL_PLAN.md` (outside the repo)
- Class: C2 (one migration, a rule in a SECURITY DEFINER function). Plan and decisions: owner, 24 Nov 2026 (section 9 of the plan).

## Context

`FLAG_CUSTOMER_EMAIL` lets a signed-in customer add and confirm an email. The post-property page already shows a gate to a person with no verified email (ADD-03), but the database did not check it: `submit_listing` asks only for a verified phone, so a direct call to the submit action got past the gate. The database also cannot read an environment variable, and a hard check would block all posting wherever the flag is off, because nobody can verify an email there.

## Decisions (owner, 24 Nov 2026)

1. **Sign-in stays as it is.** The email step after the phone code keeps its Skip button. A customer who skips can browse, save, compare and enquire. **Only posting a home is gated.**
2. **The switch is a public setting, not a second environment variable.** `site_settings` key `posting_requires_verified_email`, value `{"enabled": true}`. A missing row, `false`, or any value that is not the JSON boolean `true` means off. The owner flips it together with `FLAG_CUSTOMER_EMAIL` (the runbook in part 3 gives the order). The setting is public by design like every `site_settings` row; it holds nothing private.
3. **Only submitting a draft is gated.** Creating and saving drafts, editing a listing that is in review or live, and sending a rejected listing back are unchanged. Production is not live yet, so there are no existing owners to protect; on dev an owner without a verified email verifies when they next submit a draft.
4. **Dev first.** The owner decides when production gets the flag and the setting.

## What this change does

- **`public.has_verified_email()`**: SECURITY DEFINER, `search_path = ''`, true when the caller's `auth.users` row has a confirmed (`email_confirmed_at`) and non-empty email. It answers only about the caller. Executable by `authenticated` and `service_role`, revoked from `anon` and `public`, like `has_verified_phone()`. It is on the signed-in list of `function_grants.test.sql`.
- **`submit_listing(p_listing)`** (create or replace, same grants): after the ownership and status checks and before the completeness checks, a **draft** is refused with `listing.email_required` (SQLSTATE `42501`) when the setting is on and `has_verified_email()` is false. The ownership check stays first, so another person's listing is still `NOT_FOUND` and an account with no email learns nothing about it.
- **Service**: `mapListingError` turns `listing.email_required` into `FORBIDDEN` with the new failure reason `EMAIL_NOT_VERIFIED` (`src/types/action.ts`). No sentence leaves the server.
- **Wizard**: on that reason the wizard reloads the page. The page already shows the gate (add or confirm an email) in place of the wizard to a person with none or a pending one, and the draft is already saved, so it is there after they verify. **No new screen or state is built** (non-negotiable 13): the approved ADD-03 gate is the state, and the failure alert the wizard already has covers a person whose email state could not be read.
- **Page**: the gate is shown only when starting or continuing a **draft**. A listing in review, live or sent back is opened in the wizard without an email (decision 3). Before this change the gate also hid those edit pages whenever the flag was on.

## Words

None new. The gate and the failure alert already exist. (The line "We will also send enquiries about your homes to this address" belongs to part 2 and awaits the owner.)

## Consequences

- **Two switches can drift.** The flag on and the setting off lets anyone post without an email (as today); the setting on and the flag off blocks all posting, because no one can verify. The setting row is not created by any migration, so it is off everywhere until someone writes it. A visible warning when the two differ, and the order of switching on and off, go into the runbook of part 3.
- **A race is harmless.** A person who verifies after the page loaded gets a failed alert once and the reload shows the wizard; nothing is lost.
- **Tests:** `supabase/tests/listing_email_required.test.sql` (off with no row, `false` and a non-boolean; on with no email, an unconfirmed email and an empty one refused with `listing.email_required`; a verified email allowed; a rejected listing allowed; another person's listing `NOT_FOUND` either way; the phone rule still first; a visitor cannot call the helper); `function_grants.test.sql` names the helper; unit tests for the error mapping, the wizard reload and the page's draft-only gate.
- **Rollback:** nothing is stored. Drop `has_verified_email()` and put `submit_listing` back as in `20261117140000_listing_location.sql`; fix forward with a new migration once the rule is in use.
