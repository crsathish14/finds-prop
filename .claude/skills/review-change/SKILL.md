---
name: review-change
description: Review the current branch in a fresh context against the project checklist and report findings
disable-model-invocation: true
context: fork
agent: general-purpose
---

Review the changes on the current branch against `develop`. Read `AGENTS.md`, then follow `docs/engineering/playbooks/review-change.md` exactly.

Report findings only, each with file, line, severity (high, medium, low) and the rule ID. Do not fix anything and do not run commands that change files. Say "ready" only when no finding of medium severity or above remains.
