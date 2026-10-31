# Playbook: add a dependency (class C2)

Read `AGENTS.md` and the nested file for the folder first.

1. Can the platform or an existing dependency do it? If yes, stop.
2. Verify the package: exact name (typosquat check), maintainers, last publish, licence, install scripts, dependency count, client or server bundle impact. Use the registry, not memory.
3. Check the banned list and the ADRs. Write the PR note (need, size, maintenance, licence, alternatives). Ask.
4. Install exact (`save-exact`), run `npm run check`, read the lockfile diff, confirm no unexpected install script.
5. ADR if it is a technology-level choice.
