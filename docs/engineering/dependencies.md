# Dependencies and new technology

> Source: distilled from the approved implementation plan and AI harness design (30 Oct 2026). References such as `plan 07 §4.2`, `03` §10 or `ADR-009` point to the archived plan, the harness design documents, or `docs/adr/`. From Stage 1 (S1-T12) this repository is authoritative (HD-11).

npm only. Exact versions (`save-exact`). A new dependency, service, tool, MCP server or skill is a class C2 change.

## Rules

| ID       | Rule                                                                                                                                                                                                                                   | Enforced by                                             | Source                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| R-DEP-01 | A new runtime or dev dependency needs a PR note (need, size, maintenance, licence, alternatives) and prior approval for anything outside the architecture's stack. Never add a package from memory: verify it exists and is maintained | G-11 (report plus PR note), L-03 (ask on `npm install`) | plan 07 §13                          |
| R-DEP-02 | A new technology (framework, service, language, build tool, MCP server, skill) needs an ADR and approval                                                                                                                               | Review; L-03                                            | `07` §1                              |
| R-DEP-03 | Install exact versions (`save-exact`); let Dependabot raise grouped updates; review major bumps                                                                                                                                        | `.npmrc`, G-11                                          | plan 07 §13                          |
| R-DEP-04 | CI installs with `npm ci --ignore-scripts`. A package that needs an install script is approved by name                                                                                                                                 | G-11                                                    | plan 07 §13                          |
| R-DEP-05 | Licences are permissive; check at introduction                                                                                                                                                                                         | G-11 (optional licence report)                          | plan 07 §13                          |
| R-DEP-06 | Banned unless an ADR says otherwise: other package managers and lockfiles; Storybook; global state libraries; CSS-in-JS and other UI kits; ORMs over Supabase                                                                          | G-11 (`banned-deps.json`)                               | DEC-02, ADR-020, ADR-004, plan 03 §2 |

## Introducing a new technology or dependency

1. State the need and why the platform, the current stack or an existing dependency cannot meet it.
2. Verify the candidate from the registry or vendor, not from memory (existence, maintainers, last release, licence, install scripts, size, security history).
3. Check the banned list and the ADRs for a conflicting decision.
4. Write the ADR (technology level) or the PR note (ordinary package) and **ask**.
5. Introduce it alone in its own PR, with exact versions, tests and docs; no feature work mixed in.
6. Update the allow or banned lists, the handbook and, if agents interact with it, the router.
7. Remove it again if the need disappears (`knip` reports unused dependencies).

## Supply-chain controls (from the security plan)

| Control   | Detail                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Install   | Committed lockfile; `npm ci`; no postinstall scripts from unknown packages (`--ignore-scripts` in CI unless required)                 |
| Scanning  | `npm audit --omit=dev --audit-level=high` blocks merge; Dependabot weekly (grouped) for npm and GitHub Actions; review of major bumps |
| Actions   | Pin third-party actions by commit SHA; least-privilege `permissions:`; no `pull_request_target` with secrets                          |
| Secrets   | Push protection + gitleaks                                                                                                            |
| Footprint | New dependency requires a PR note: need, size, maintenance, alternatives. The stack in ARC is already large; avoid additions          |
| Licences  | Check on introduction (all ARC choices are permissive: Next, React, Supabase client, Radix, shadcn, Tailwind, MapLibre)               |
