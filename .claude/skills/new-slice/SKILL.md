---
name: new-slice
description: Build a vertical feature slice (schema, server, UI, states, tests, docs) by following the project playbook
disable-model-invocation: true
argument-hint: "[feature or requirement ID]"
---

Read `docs/engineering/playbooks/new-slice.md`, the router in `AGENTS.md`, and the nested `AGENTS.md` of every folder you will touch.

Classify the change first (C1, or C2 if it needs a migration, a dependency or touches auth). Write the five-line plan in the draft pull request description. For C2, stop and wait for approval before editing.

Run the Done-matrix commands from `AGENTS.md` and report the real results. Finish with the `review-change` playbook.

Feature: $ARGUMENTS
