# Playbook: review a change

Read `AGENTS.md` and the nested file for the folder first.

Findings only, each with file, line, severity and the rule ID. Do not fix during review.

A. Scope: does the diff do what was asked and only that? Requirement IDs and UX keys present?
B. Rules: scan the diff against the rule tables for the areas touched (`03`).
C. Security: the ten-point checklist for every action and handler; service-role imports; new env variables; logging; uploads.
D. Tests: evidence pasted; new tests assert behaviour; scan for weakened tests (`.only`, `.skip`, deleted assertions, loosened expectations).
E. Design system: duplicates, raw elements, tokens, states, Design Lab entry.
F. Gates: any change to lint, CI, hooks, scripts, `AGENTS.md`, `.claude`? Is there a `Gate-change:` line, and is nothing weakened?
G. Docs: ADR, traceability, handbook, runbook, `.env.example`.
H. Verdict: list of findings by severity; "ready" only when none of medium or above remain.
