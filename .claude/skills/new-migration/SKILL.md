---
name: new-migration
description: Create a Supabase migration with RLS and pgTAP tests by following the project playbook
disable-model-invocation: true
argument-hint: "[what the migration does]"
---

This is a class C2 change. Read `docs/engineering/playbooks/new-migration.md`, `supabase/AGENTS.md` and `docs/engineering/database.md`.

Write the plan first (rules covered, F-step, rollback, effect on the running app) and wait for approval before creating any file. Never run a command against a linked or shared project.

Request: $ARGUMENTS
