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

Pending: to be completed at H1-T10.
