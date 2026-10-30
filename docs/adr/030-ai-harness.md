# ADR-030 · AI harness: instruction files, gates and agent guardrails

- Status: Accepted
- Date: 2026-10-30
- Related: HD-01 to HD-12, CH-01 to CH-10, R-AI-01 to R-AI-12

## Context

The project is built with AI coding agents (Claude Code, possibly others) and human developers. The same standards must apply to all of them and be checked automatically.

## Decision

Approved on 30 Oct 2026 (all twelve decisions accepted as recommended): AGENTS.md is the single instruction source with four nested files and no CLAUDE.md; rules live once in docs/engineering with IDs and an enforcement column; three tiers of enforcement (CI authoritative, local hooks, agent guardrails); change classes C0 to C2 with stop-and-ask triggers; four thin Claude skills and no subagents; lefthook and commitlint; committed Claude Code settings with two guard hooks; read-only UX reference in docs/ux; squash into develop and merge commit into main; agent feedback off; no Supabase MCP.

## Consequences

Gates G-01 to G-20, the policy scripts and the guard hooks are maintained as code with tests. The design documents are in `docs/engineering/` (distilled) and the planning archive. Harness acceptance results (negative tests, canary evals, onboarding dry run) are appended below at H1-T10.

## Acceptance record

Run on 31 Oct 2026 against `chore/s1-harness` (H1-T10). Criteria are from the harness roadmap section 3. Items that need GitHub, Docker or fresh agent sessions are open, not passed.

| #    | Result | Evidence                                                                                                                                                                                                |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Passed | Fresh clone in a temp folder, `npm ci --ignore-scripts`, `.env.example` copied to `.env.local`: `npm run check` green (13 files, 285 tests), `npm run build` and the client-bundle scan pass            |
| A-02 | Passed | `AGENTS.md` is 100 lines including the Next.js block; nested files are 14 to 18 lines; a `next dev` run left `AGENTS.md` byte-identical with both markers intact                                        |
| A-03 | Partly | 19 lint-rule cases and the script tests make the Stage 1 gates fail with file and rule ID. Token and Design Lab gates (G-04, G-10 lab) arrive in Stage 2                                                |
| A-04 | Passed | `guard-bash` 105 cases, `guard-edit` 43 cases, including look-alikes that must pass                                                                                                                     |
| A-05 | Open   | Needs the GitHub repository and rules                                                                                                                                                                   |
| A-06 | Open   | Needs a CI run                                                                                                                                                                                          |
| A-07 | Partly | The Bash guard refuses `cat .env.local` and `git push --force` when fed the hook input; `claude doctor`, `/status` and the `supabase db push` refusal need a manual pass in a new session               |
| A-08 | Passed | `check-harness` reports ok: rule IDs defined once, cited IDs exist, router resolves                                                                                                                     |
| A-09 | Partly | Hooks, commit-msg and pre-commit ran on every commit from a path with spaces inside OneDrive; LF enforced; `doctor` warns about the path and OneDrive. A fresh clone on a path with spaces not repeated |
| A-10 | Open   | Ten canary evals are manual and need fresh agent sessions on a clean branch                                                                                                                             |

Findings fixed during the run: none needed in instructions. Known gaps: Docker is not installed on the development machine, so database checks (`check:db`, pgTAP, integration) have not run locally.
