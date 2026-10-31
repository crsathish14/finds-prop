# ADR-036 · Names are words, not letters

- Status: Accepted (owner decision, 31 Oct 2026)
- Date: 2026-10-31
- Related: R-GEN-11, ADR-030 (AI harness), G-02

## Context

Code written with `t`, `k`, `i`, `m` and `f` for callback arguments and loop variables is hard to read and review, especially for a team that includes AI agents and new developers. The owner asked that every function, variable and parameter has a meaningful name, never a single letter, and that this is enforced for Claude as well as for people.

## Decision

1. **Rule R-GEN-11.** No single-letter names for variables, parameters, callback arguments, functions or object keys, and no cryptic abbreviations (`err`, `cb`, `fn`, `el`, `tmp`, `arr`, `obj`, `val`, `str`, `num`, `idx`, `evt`, `ctx`, `opts`). Allowed: a lone `_` for an unused argument, and the Zod import `z`. The translator is called `translate`. The JSON log key `msg` stays because the log format documents it.
2. **One definition.** `scripts/policy/naming-rules.mjs` holds the ESLint `id-length` and `id-denylist` settings. `eslint.config.mjs` (gate G-02, so pre-commit and CI) and the Claude hook read the same file.
3. **Three layers, as for every harness rule.** `AGENTS.md` tells every agent the rule; the Claude Code PostToolUse hook `.claude/hooks/check-naming.mjs` lints each file right after Claude writes it and sends violations back so Claude fixes them in the same turn; lint in the pre-commit hook and CI is the authority and covers people and every other tool.
4. **Existing code was brought into line** in the same change (about 130 names across 30 files), using the TypeScript rename engine so only the intended variable and its uses changed; the unit, hook, lint and browser tests pass unchanged in meaning.

## Consequences

- A lint failure names the file, line and offending identifier. Fix by renaming to what the value is (`token`, `index`, `finding`, `file`).
- The lint rule cannot judge whether a word is meaningful. `data`, `item` and `value` pass lint and are acceptable only where they are the honest name; reviewers still apply the intent of the rule.
- The Claude hook is feedback, not a gate: it needs a new Claude Code session to take effect after being added, and it never blocks on its own failure.
- A third Claude hook is a harness change (class C2) and is declared with a `Gate-change:` line in the pull request.
