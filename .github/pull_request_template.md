## What and why

<!-- 1 to 3 sentences. Link the issue. -->

## Traceability

- Requirements (FR and BR IDs):
- UX screen keys and states (docs/ux-reference.md):
- ADR or decision (DEC, ADR) if any:

## Change class

- [ ] C0 - [ ] C1 - [ ] C2 (plan approved by: )

## Verification

<!-- Paste real results. Say what you could not run. -->

- [ ] npm run check
- [ ] npm run check:db (if supabase/ changed)
- [ ] npm run test:integration (if server code changed)
- [ ] npm run test:ds (if components or styles changed)
- [ ] npm run test:e2e:smoke (if a journey changed)

Not run, and why:

## Security checklist

<!-- For server code, see docs/engineering/security.md -->

- [ ] Input parsed by Zod - [ ] Identity from session only - [ ] Role or ownership checked before write
- [ ] Rate limit or idempotency where needed - [ ] User-scoped client unless allow-listed
- [ ] Cache invalidated - [ ] Audit entry - [ ] Safe errors only
- [ ] Tests: success, unauthenticated, wrong role, wrong owner, invalid input, rate limited
- [ ] Not applicable (no server code)

## Design system

- [ ] Searched components/ and the Design Lab; no duplicate - [ ] Design Lab entry and baselines updated - [ ] Not applicable

## Dependencies

New dependency: none

<!-- or: name, why needed, size, maintenance, licence, alternatives considered, approved by -->

## Migrations

- [ ] Rollback note - [ ] pgTAP added - [ ] Types regenerated - [ ] Not applicable

## Docs

- [ ] Docs, ADR, traceability updated - [ ] .env.example updated - [ ] Not applicable

## AI assistance

- [ ] No - [ ] Yes: tool and model; a human read every changed line

## Gate-change

Gate-change: none

<!-- If you changed lint, CI, hooks, scripts, AGENTS.md or .claude: write "Gate-change: <what and why no check is weakened>" -->
