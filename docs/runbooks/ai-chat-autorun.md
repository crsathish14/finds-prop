# AI chat build: automatic run

How the rest of `docs/ai-chat-phase-plan.md` is built without stopping for permission, and the limits that keep it from looping. Owner decisions of 14 Nov 2026: the agent may edit, run commands, commit, push, merge its own green AI chat pull requests and start new sessions. The task list and what each task builds stay in the phase plan; the state of each task is in `docs/ai-chat-run-ledger.md`.

## Roles

- **Orchestrator:** one session (the main working agent). It starts the first task, and after that only steps in when a chain stops (a blocked task, a failed limit, a question for the owner). It never writes feature code itself.
- **Task session:** one task, one branch (`feat/ai-p<phase>-t<task>-<name>`), one pull request. It runs in `auto` permission mode. It writes the plan in the PR (C2 included, pre-approved), implements, runs the checks the task lists, pushes, opens the PR, **watches it, fixes it, merges it when green, and starts the next task** (owner decision, 14 Nov 2026: watch the PR, fix or merge it, then start the next task, do not wait for the owner). "The task chain" below says how.

## Order

Strictly one task at a time, because only one migration PR may be open at once and two writers must not touch the same files. The order is the one in the ledger (a one-way list, so it cannot cycle). A task starts only when every task it needs is `merged` in the ledger and on GitHub.

## The task chain (every task session follows this)

1. **Open the PR** with the full template. Bind it (`get_status`, then `bind_pr` if it is not bound) and turn on Auto-fix (`set_monitor` with `auto_fix: true` and the PR url). The app then wakes the session on a CI failure, a merge conflict or a review comment: fix it, verify, commit and push without asking. A `pr-policy` failure about `Gate-change:` means the body must say which gate file changed (`docs/engineering/**` counts); edit the body and push a new commit, because CI reads the body from the push event.
2. **Watch for green without polling.** Start one background subagent whose only job is one blocking command: `gh pr checks <number> --watch --fail-fast`. When it returns, all green means go to step 3; a failure means it reports which check, and the session fixes it (the Auto-fix event usually arrives first; never fix the same head twice). Reuse the same subagent for later pushes. No polling loops, no `ScheduleWakeup`, no cron for CI.
3. **Review first when the task needs it.** For C2 tasks and the three security tasks (P4-T04, P6-T02, P8-T02) start a fresh review session (`/review-change`, and `/security-review` on those three) and fix medium or higher findings in one round before merging. Other tasks go straight to the merge.
4. **Merge.** When `all-checks-passed` is `SUCCESS`, run exactly `gh pr merge <number> --merge` as a command **by itself** (no `cd`, `&&` or other flags: the guard hook refuses anything else, `docs/engineering/security.md` §3.1). If the hook denies it, report the reason and do not try another form. Then confirm with `gh pr view <number> --json state`.
5. **Pull `develop`, make sure the ledger row says `merged`** (a small docs PR if it still says `running`), and **start the next task**: the first `todo` row in the ledger whose needs are all `merged`, with the start prompt in the phase plan, `use_worktree: true` and permission mode `auto`. Then stop. If that task is `waiting-owner` or needs a real key, a legal decision or a deployed environment, skip it and take the next independent one; if none is independent, report to the owner and stop.
6. **The limits below still apply.** A session that hits one marks its row `blocked` with the reason and stops, and the chain stops with it.

## Starting a task (the orchestrator, or the previous task's session)

1. No file named `AI-RUN-STOP` in the main checkout. If it exists, stop and say so.
2. The ledger row is `todo`, its attempts are under the limits below, and `develop` has no open AI chat PR.
3. Start a session with `use_worktree: true` from `develop`, permission mode `auto`, using the start prompt in the phase plan plus the task's own line. Mark the row `running`.

**Starting the session is the agent's own job, never a question for the owner** (owner decision, 14 Nov 2026, for every Claude account that works on this repository): the owner has said "do not ask this permission next time, always start the new session on your own". Call `start_session` with `initiation: "user_asked"` straight away, with a complete brief (the task, the files, what done looks like, the chain steps) and `context: "fresh"`. Do not write "want me to start it?", do not end a turn with a start button as the question, and do not wait for a reply. The one exception is outside the owner's control: the app may refuse a start made from a turn that an automated event or another session's message began, and then offers a card instead. In that case leave the card (`own_initiative`), say in the report that the app turned the start into a card, and carry on with whatever else is left; the owner's standing instruction does not override the app, and nothing here asks you to start a session by another route (no shell-launched `claude`, no workaround). A later turn that the owner or the app's wake-up begins starts it for real.

## Checking a finished task (anyone)

The session that merged reports the PR number and the real check results. To confirm, read the PR body and `gh pr checks <number>` on GitHub rather than taking the report on trust, and check the ledger against GitHub before starting a task (a task already `merged` on GitHub is never started again).

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
