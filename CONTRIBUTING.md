# Contributing

1. Set up: `npm ci`, `npm run doctor`, `npm run dev`. Docker is optional (ADR-034); CI runs the database checks. See `README.md` for accounts and environment variables (names only; values come from the owner).
2. Work from `develop`: `feat/…`, `fix/…`, `chore/…`, `docs/…`. Open a pull request into `develop`. Conventional commit titles.
3. Before pushing run `npm run check`. The pull request template lists what else to run.
4. Rules are in `AGENTS.md` and `docs/engineering/`. They apply equally to people and AI agents.
5. Using an AI agent: run it in a fresh clone or worktree; give it no production credentials and no `.env.local` secrets beyond local development values; it reads `AGENTS.md` automatically (Claude Code, Codex, Cursor, Copilot). Gemini CLI and Aider need a config entry to read `AGENTS.md`. You remain responsible for every line it writes.
6. Do not create `CLAUDE.local.md` (it stops Claude Code reading `AGENTS.md`). Personal preferences go in your user-level agent settings.
