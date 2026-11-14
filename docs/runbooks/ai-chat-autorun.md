# AI chat build: automatic run

How the rest of `docs/ai-chat-phase-plan.md` is built without stopping for permission, and the limits that keep it from looping. Owner decisions of 14 Nov 2026: the agent may edit, run commands, commit, push, merge its own green AI chat pull requests and start new sessions. The task list and what each task builds stay in the phase plan; the state of each task is in `docs/ai-chat-run-ledger.md`.

## Roles

- **Orchestrator:** one session (the main working agent). It starts one task session at a time, waits for it to finish, checks the result on GitHub, merges, and starts the next. It never writes feature code itself.
- **Task session:** one task, one branch (`feat/ai-p<phase>-t<task>-<name>`), one pull request. It runs in `auto` permission mode. It writes the plan in the draft PR (C2 included, pre-approved), implements, runs the checks the task lists, pushes, opens the PR and stops. It does not merge.

## Order

Strictly one task at a time, because only one migration PR may be open at once and two writers must not touch the same files. The order is the one in the ledger (a one-way list, so it cannot cycle). A task starts only when every task it needs is `merged` in the ledger and on GitHub.

## Starting a task (orchestrator)

1. No file named `AI-RUN-STOP` in the main checkout. If it exists, stop and say so.
2. The ledger row is `todo`, its attempts are under the limits below, and `develop` has no open AI chat PR.
3. Start a session with `use_worktree: true` from `develop`, permission mode `auto`, using the start prompt in the phase plan plus the task's own line. Mark the row `running`.

## Finishing a task (orchestrator)

1. The session reports a PR. Read the PR body and the check results on GitHub (`gh pr checks <number>`); do not take the report on trust.
2. C2 tasks and the three security tasks (P4-T04, P6-T02, P8-T02): start a fresh review session (`/review-change`, and `/security-review` on those three). Fix medium or higher findings in one round.
3. Merge only when `all-checks-passed` is green: `gh pr merge <number> --merge`. The guard hook refuses anything else (`docs/engineering/security.md` §3.1).
4. Pull `develop`, mark the row `merged`, start the next task.

## Limits (the loop guard)

| Limit                                  | Value                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Attempts to fix the same failing check | 3. Then the task is `blocked` with the reason                                                       |
| CI-fix rounds per pull request         | 2                                                                                                   |
| Review-fix rounds per pull request     | 1                                                                                                   |
| Sessions started in one run            | 25 (restart needs the owner)                                                                        |
| A task already `merged` on GitHub      | Never started again; the ledger is checked against GitHub first                                     |
| A blocked task                         | Skipped. Tasks that do not depend on it go on; if none is independent, the run stops and reports    |
| A denied action (hook or permission)   | Never retried in another form. The task is `blocked` and the reason goes in the ledger              |
| The stop file                          | An empty `AI-RUN-STOP` file in the main checkout stops merging at once and the run at the next step |

## When the run stops and asks the owner

The orchestrator asks, and carries on with independent tasks while it waits:

- A step that needs a **real OpenAI key or any paid call**: P1-T03's real-key run, P8-T01's real-model run, the P8-T03 cost measurements. The owner runs them, or says to go ahead.
- **Legal and owner-only items:** the cookie policy, privacy policy and processors list (P8-T03), the provider terms, the daily budget value, the Tamil wording.
- **Deployed environments and the flag:** P9-T01 (dev, staging, production, switching `FLAG_AI_SEARCH` on).
- Anything the plan does not say, a change to a gate file (CI, hooks, lint, test or TypeScript config, `AGENTS.md`, `package.json`), a hook denial, or a failed limit above.

## Placeholders

The daily budget and the Tamil wording are not set. A task uses a clearly marked placeholder (`owner to confirm`) in `src/config/ai.ts` or `en.json` and lists it in the PR. The example loan rate is 7.2% a year (14 Nov 2026).

## Ending the allowance

Create `AI-RUN-STOP` to stop at once. To end the merge allowance for good, put `"Bash(gh pr merge*)"` back in `deny` in `.claude/settings.json` and in `docs/engineering/security.md`.
