# Playbook: new Server Action or Route Handler

Read `AGENTS.md` and the nested file for the folder first.

1. Name by intent. Add the Zod schema in `schemas.ts`.
2. Action: `defineAction({ name, input, auth, rateLimit, audit, handler })`; the handler calls `service.ts`. Handler: verify signature or token first.
3. Service: user-scoped client; RPC for atomic work; the admin client only if the module is on the allow-list (otherwise class C2).
4. Invalidate cache tags after the write; add the audit entry for sensitive actions.
5. Tests: success, unauthenticated, wrong role, wrong owner, invalid input, rate limited, forged identity fields, foreign id gives `NOT_FOUND`.
6. Tick the security checklist in the PR.
