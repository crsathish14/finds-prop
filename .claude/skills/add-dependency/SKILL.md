---
name: add-dependency
description: Evaluate and add an npm dependency following the project policy (class C2)
disable-model-invocation: true
argument-hint: "[package name and why it is needed]"
---

This is a class C2 change. Read `docs/engineering/playbooks/add-dependency.md` and `docs/engineering/dependencies.md`.

Verify the package from the registry, not from memory: exact name, maintainers, last publish, licence, install scripts, size. Check the banned list in `scripts/policy/banned-deps.json`. Write the pull request note and wait for approval before running any install command.

Package: $ARGUMENTS
