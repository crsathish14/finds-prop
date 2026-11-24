# ADR-196 · One address, not two: a confirmed account email becomes the contact email (customer email, part 2)

- Status: Accepted for part 2. Nothing is sent by this change, and it only acts once `FLAG_CUSTOMER_EMAIL` is on (before that nobody can confirm an email). No new words.
- Date: 2026-11-26
- Related: ADR-186 (the poster's private contact email), ADR-188 (the enquiry mail reads `profiles.contact_email`), ADR-195 (a draft needs a verified email), ADD-03 (the email prompts), R-BE-10 (no personal data in logs), the plan `CUSTOMER_EMAIL_PLAN.md` (outside the repo, section 3.3 and 3.4)
- Class: C2 (one migration, a new SECURITY DEFINER function writing a private personal field, a change in the auth confirm route). Plan and decisions: owner, 24 Nov 2026.

## Context

With `FLAG_CUSTOMER_EMAIL` on, a customer could hold two addresses: the confirmed account email and the private contact email enquiries are mailed to (ADR-186). The owner wants one: when the account email is confirmed, it becomes the contact email if the person has none yet. A contact email the person chose is never overwritten.

## Decision

- **`public.adopt_verified_email_as_contact()`**: no argument, SECURITY DEFINER, `search_path = ''`, acts on `auth.uid()` only. It reads the caller's **confirmed** address from `auth.users` itself, so a client cannot hand it another one. It trims and lower-cases, and applies the rules of `set_contact_email` (at most 254 characters, shaped like an address, not a reserved admin address, ADR-010). It writes only `where contact_email is null`. Answers `true` when it stored the address and `false` otherwise (an unconfirmed or missing email, an address already held, an unusable address); the address is never in the answer. It raises only for a caller with no session or no verified phone (`profile.not_allowed`, 42501), like every owner write. Executable by `authenticated` and `service_role`, revoked from `anon` and `public`. The service role is not used: the confirm route calls it as the person who just confirmed, so the allow-list in `docs/engineering/security.md` does not change.
- **The confirm route** (`handleEmailConfirm`, `src/server/auth/email-confirm.ts`): after `verifyOtp` accepts the link, it calls the new function through a new dependency `adoptContactEmail`. A failure, an error answer or a throw, **never changes the answer**: the visitor still lands on "verified", and the log holds a code only (`contact email not copied`), never the address. Nothing is tried after a refused link.
- **The wizard prefill** (`post-property-screen.tsx`): when the person has no saved contact email and the email state is `verified`, the "Email for enquiries" box starts from the confirmed address. This covers a copy that was missed. The box stays visible, editable and required; what the person types is what is saved by the existing path. A saved contact email always wins.
- **No change to the enquiry mail**: it still reads `profiles.contact_email` (ADR-188). That is the point of copying.

## Words

None new. (The line "We will also send enquiries about your homes to this address" proposed in the plan, section 8, is not built: the owner has not approved it and the approved screens do not show it.)

## Consequences

- The address is copied once. If the person later changes their account email, the contact email does not follow (they chose or accepted it). They can change it on the dashboard.
- **Privacy**: the confirmed address is now also used for enquiry mail. `docs/legal/enquiry-mail-policy-drafts.md` is updated in part 3, and no live legal wording changes.
- **Tests:** `supabase/tests/profile_adopt_email.test.sql` (copied when confirmed and empty; not when unconfirmed; never over a saved address; nothing for a phone-only account or a reserved address; trimmed and lower-cased; refused with no verified phone; another person untouched; a visitor cannot call it); `function_grants.test.sql` names it; unit tests for the confirm route (copy attempted after success, not after a refused link, an error or a throw does not change the redirect, nothing about the address logged) and for the prefill.
- **Rollback:** `drop function public.adopt_verified_email_as_contact();` and remove the dependency from the confirm route; addresses already copied stay as ordinary contact emails.
