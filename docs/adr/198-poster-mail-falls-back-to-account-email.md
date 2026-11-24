# ADR-198 · The poster mail falls back to the confirmed account email (customer email, part 4)

- Status: Accepted (owner, "all recommended", 24 Nov 2026). Inert until a poster has confirmed an account email, which needs `FLAG_CUSTOMER_EMAIL`. No new words.
- Date: 2026-11-26
- Related: ADR-186 (the contact email), ADR-188 (the enquiry mail), ADR-195, ADR-196, ADR-197, the privacy-policy draft 2b in `docs/legal/enquiry-mail-policy-drafts.md`
- Class: C2 (a new SECURITY DEFINER function reading `auth.users`, a change to what the service-role mail module reads, personal data used for one more purpose). Plan approved by: owner, 24 Nov 2026.

## Context

A home's poster is mailed at `profiles.contact_email`, an address typed into our own form (ADR-186). ADR-196 copies a confirmed account email into it, but only when the link is confirmed and the box is empty; a poster who confirmed an email earlier, whose copy failed, or who cleared the box, still has no address and gets no mail even though we hold a confirmed one. The owner asked that the account email be used when there is no contact email, so one address is enough.

## Decision

- **`public.poster_mail_address(p_owner uuid)`** (migration `20261126150000_poster_mail_address.sql`): SECURITY DEFINER, `search_path = ''`, `stable`. It answers `profiles.contact_email` when set, otherwise the owner's **confirmed** account email (`auth.users.email_confirmed_at is not null`), trimmed and lower-cased, at most 254 characters, shaped like an address and not a reserved admin address (the rules of `set_contact_email`), otherwise null. **Execute is granted to `service_role` only**, revoked from `public`, `anon` and `authenticated`: both addresses are private, and a person can already read their own through their own row.
- **The enquiry mail finder** (`createEnquiryMailFinder`, `src/features/enquiries/service.ts`, already on the service-role allow-list) calls it with the home's owner id instead of reading `profiles` directly. The owner id comes from the stored home, never from a client. The allow-list in `docs/engineering/security.md` does not change.
- **Precedence is fixed**: a contact email the person chose always wins; an unconfirmed account email is never used; with neither, no poster mail is sent and the enquiry still shows on the dashboard, as before.
- **Projects are unchanged**: the poster of a project is the builder, mailed at `builders.email`.

## Words

None.

## Consequences

- **Privacy:** a confirmed account email is now used for enquiry mail without the person having typed it into the enquiries box. Draft 2b of `docs/legal/enquiry-mail-policy-drafts.md` says so for the owner and the legal reviewer to approve before this reaches production; nothing is published.
- **The address follows the account:** if a poster later changes their account email and confirms it, mail follows, unless they saved their own contact email.
- **Tests:** `supabase/tests/poster_mail_address.test.sql` (contact email wins; the confirmed account email is the fallback; unconfirmed, missing, reserved and unknown give null; trimmed and lower-cased; the service role only); `function_grants.test.sql` lists it among the server-only functions; the finder test asks the function and nothing else.
- **Rollback:** drop the function and have the finder read `profiles.contact_email` again; nothing is stored.
