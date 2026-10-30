# Find Prop (`findsprop`)

Property listing platform for Tamil Nadu: a Next.js 16 app on Vercel with Supabase (Postgres + PostGIS, Auth, Storage). Customers sign in with a phone code; builders and the administrator sign in with email or Google plus a second step.

**Status:** Stage 1 (project foundation). The app is a placeholder home page, a health probe, the quality gates and the server skeleton. Features arrive stage by stage; see the roadmap in the planning documents.

## Rules for everyone, human or AI

Read [AGENTS.md](AGENTS.md) (rules, commands, router) and [CONTRIBUTING.md](CONTRIBUTING.md). Detail is in [docs/engineering/](docs/engineering/README.md). The same standards apply to every contributor, and CI enforces them.

## Prerequisites

| Tool                        | Why                                                                             |
| --------------------------- | ------------------------------------------------------------------------------- |
| Node.js 24 (see `.nvmrc`)   | Runs the app and scripts                                                        |
| npm 10.9 or newer           | The only package manager                                                        |
| Docker Desktop              | The local Supabase stack, pgTAP and integration tests (`npm run db:start`)      |
| Supabase CLI                | `scoop install supabase` or `npm install -g supabase`; CI uses its setup action |
| gitleaks (optional locally) | Pre-commit secret scan: `winget install gitleaks`. CI always scans              |

Run `npm run doctor` to see what is missing on your machine and how to fix it.

## First run

```bash
npm ci
cp .env.example .env.local        # fill in local values; never commit this file
npm run db:start                  # needs Docker
npm run dev                       # http://localhost:3000
```

## Commands

| Command                              | What it does                                                               |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `npm run check`                      | Format, lint, types, unit tests and policy checks (run after every change) |
| `npm run check:db`                   | Apply migrations from empty, lint, pgTAP, generated-types diff (Docker)    |
| `npm run test:integration`           | Integration tests against the local stack (Docker)                         |
| `npm run test:ds` · `test:e2e:smoke` | Design Lab checks · end-to-end smoke (build first)                         |
| `npm run verify`                     | Everything CI runs, locally                                                |
| `npm run harness:check`              | Instruction files, hooks and policy scripts                                |
| `npm run doctor`                     | Diagnose the local environment                                             |

## Layout

```
src/app/          routes only (compose, no rules)        docs/engineering/   the rules, written once
src/features/     one folder per module                  docs/adr/           decisions and why
src/components/   shared UI (from Stage 2)               docs/requirements/  what to build
src/server/       server-only infrastructure             docs/ux/            approved UX reference (read-only)
src/lib/          pure helpers, public env               supabase/           migrations, tests, config
scripts/          policy checks, doctor, tests           e2e/                Playwright
```

## Environments

Local stack (Docker) for daily work and CI. `findsprop-dev` and `findsprop-prod` Supabase projects with Vercel Preview and Production; a staging project is added before launch. Shared-environment credentials live only in Vercel, GitHub Environments and the Supabase dashboard, never on a developer machine used with AI agents. Variable names are in `.env.example`.

## Windows and OneDrive

LF line endings are enforced (`.gitattributes`). If the repository lives inside OneDrive, pause sync during `npm ci` and builds, and keep the path short; OneDrive can lock `node_modules` and `.next`.
