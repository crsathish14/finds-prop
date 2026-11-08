# ADR-075 · Admin builders: inviting, activating and editing, server side (S7-T05, part 1)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-010 (authentication design; builders and agents sign in with Google only), ADR-074 (mail adapter, used by nothing), DEC-27, DEC-28 (builders are deactivated, never deleted), BR-30 to BR-35, FR-ADM-04
- Plan approved by the owner on 8 Nov 2026 ("all recommended"): no email in v1, the sign-in address is shown after inviting, "Send password link" goes away, T05 first in Stage 7.

## Decision

- **An invitation is an account that already exists.** The approved UX says "set a password" and "we email an invitation", but ADR-010 (1 Nov) decided builders and agents sign in with Google only, and no mail provider exists (DEC-27). So `inviteBuilder` makes the account with a confirmed email through the auth admin API, grants the `builder` role and writes the builder record tied to it. When the person signs in with Google on that address, Supabase links the Google identity to this account (the spike of 2 Nov showed this, as long as the confirmed account exists first), so they land as a builder. The admin API is not blocked by the Before User Created guard (tested in CI).
- **The saga order is record, account, link.** The record goes in first because the database refuses the reserved administrator addresses (`builders.reserved_email`) and a second record for an email (unique on `lower(email)`), which is cheaper to find out than an account. If making the account or tying it to the record fails, the record (and the account, if made) is taken away again, so a failed invitation leaves nothing behind and can be tried again. An email that already has an account (a customer who signed up with it) is refused on the email box.
- **Nothing is emailed.** The answer carries the builder sign-in address (built from `NEXT_PUBLIC_SITE_URL`, never from a request header) for the admin to pass on. **Resend invitation** stamps the invitation as sent again and answers the same address; it is allowed only for an active builder who has never signed in.
- **Status is worked out, not stored.** Inactive (deactivated), Invited (never signed in) and Active (signed in). The last sign-in lives in `auth.users`, so the list comes from one new definer function, `admin_builder_overview()`, which checks `is_super_admin()` itself, returns the private columns the admin needs (email, type, contact) and the counts of projects and of leads, and nothing else of the auth user but the time of the last sign-in.
- **Activate, deactivate and edit run with the service role**, because an admin's own account has no column grant on `active`, `kind` or `email` (the system writes them). `features/builders/service.ts` was already on the service-role allow-list (security.md 4.3, `eslint.config.mjs`), so the allow-list does not change. Each action is limited to the super admin, with the `admin_decision` limit of 120 an hour. Deactivating or editing refreshes the projects and developer-showcase cache tags (`tagsAfterBuilderChange`); the audit log is written by the database triggers (`builder.created`, `builder.activated`, `builder.deactivated`, `builder.kind_changed`), never with the email.
- **Builders are never deleted** (DEC-28): there is no delete action.
- **Not in this change:** the screens (parts 2 and 3), the words of the page, and any email.

## Wording to confirm

Part 2 puts the words in the Design Lab and the owner confirms them there. The approved Admin Builders screen has "Send password link", "set a password" and "Resend invitation" (which would email) in it; the plan is to replace those, not to ship them.

## Consequences

- One migration (`20261108100000_admin_builder_overview.sql`, a read-only function with its pgTAP file), a new feature module `builders`, a cache-tag helper and one validation message (`validation.builderEmailReserved`, from the approved UX).
- No package, gate or environment change; no change to the protected `docs/engineering` files.
- Rollback: drop the function and delete the module; the builder records, accounts and roles an invitation made stay (deactivate them instead). Nothing else depends on it.
