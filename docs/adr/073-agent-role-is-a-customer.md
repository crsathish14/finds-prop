# ADR-073 · The agent role is a customer, recorded in tests (S6-T06)

- Status: Accepted
- Date: 2026-11-08
- Related: DEC-08, ADR-010 (authentication design), plan 07 section 2.3, BR-10
- Plan approved by the owner on 8 Nov 2026 ("all recommended"): tests only, no product change, and a note so the two meanings of "agent" are not confused.

## Decision

- **DEC-08 stands:** the `agent` value stays in the `app_role` enum (no migration churn), grants no permission, and has no portal. An account that holds it is treated exactly as a customer.
- **The proof is in three tests**, so a later change that quietly gave the role a power would fail in CI:
  - `supabase/tests/agent_role.test.sql` (`DB-RLS-agent-has-no-extra-access`): against the database an agent cannot moderate (not another owner's listing and not their own), cannot read the moderation queue or the administrator's view of every listing, sees only what the public sees plus their own listings and the enquiries on them, cannot change, close or delete another owner's listing, cannot give themselves another role, and can still start a draft and close their own Live listing.
  - `src/server/auth/__tests__/agent-role.test.ts`: the guards and the page gates decide for an agent exactly as for a customer, and a builder record alone does not make an agent a builder.
  - `tests/integration/agent-role.test.ts` (`IT-AUTHZ-agent`, CI only): the same against a real sign-in, a real session read and the real stores.
- **Two different things are called "agent".** The `agent` **role** in the enum is this one: no permissions. The **type** `builders.kind = 'agent'` (ADR-010, decided 1 Nov 2026) marks a builder record that belongs to an agent; that account holds the **builder** role and works like a builder, and the admin sees the type because their payment differs. Neither changes the other. If DEC-08 ever changes (an agent portal, a distinct right), these tests are the ones to change first.
- **Not in this change:** any product or database change.

## Consequences

- No migration, package, gate or message change; three test files.
- Rollback: delete the three test files. Nothing else depends on them.
