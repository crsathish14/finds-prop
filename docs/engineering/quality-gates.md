# Quality gates and enforcement

> Source: distilled from the approved implementation plan and AI harness design (30 Oct 2026). References such as `plan 07 §4.2`, `03` §10 or `ADR-009` point to the archived plan, the harness design documents, or `docs/adr/`. From Stage 1 (S1-T12) this repository is authoritative (HD-11).

Gates `G-01` to `G-20`, the local layers `L-01` to `L-04`, the npm scripts, the lint design, the script specifications, CI mapping and branch protection.

## 1. Enforcement tiers and local commands

| Tier                                 | Runs                                        | Purpose                                           |
| ------------------------------------ | ------------------------------------------- | ------------------------------------------------- |
| T1 CI and branch protection          | On every PR and push to `develop` or `main` | Authoritative; cannot be bypassed by contributors |
| T2 Local: `npm run check`, git hooks | Before commit and before pushing            | Fast feedback; a subset of T1                     |
| T3 Agent guardrails                  | While an agent works                        | Prevent unrecoverable actions (`06`)              |

`package.json` scripts (names are the contract; flags are internal). All scripts are Node-based and run on Windows, macOS and Linux with no POSIX-only syntax.

| Script                              | Runs                                                                                                               | Target time | Needs         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------- | ------------- |
| `format` · `format:check`           | Prettier write · check                                                                                             | seconds     |               |
| `lint`                              | ESLint, zero warnings allowed                                                                                      | < 40 s      |               |
| `typecheck`                         | `tsc --noEmit`                                                                                                     | < 40 s      |               |
| `test`                              | Vitest unit and component tests                                                                                    | < 40 s      |               |
| `policy`                            | `check-hygiene`, `check-env`, `check-deps`, `check-harness`, and from Stage 2 `check-tokens`                       | < 10 s      |               |
| **`check`**                         | `format:check` + `lint` + `typecheck` + `test` + `policy`                                                          | **< 2 min** | none          |
| `db:start` · `db:stop` · `db:reset` | Local Supabase stack                                                                                               |             | Docker        |
| `check:db`                          | `db:reset`, `supabase db lint --level error`, `supabase test db` (pgTAP), generated-types diff, `check-migrations` | < 3 min     | Docker        |
| `gen:types`                         | `supabase gen types typescript --local` into `src/types/database.types.ts`                                         |             | Docker        |
| `test:integration`                  | Vitest against the local stack with fake adapters                                                                  | minutes     | Docker        |
| `test:ds`                           | Playwright on the Design Lab: axe plus visual at 390, 820, 1440                                                    | minutes     | build         |
| `test:e2e:smoke`                    | Playwright `@smoke` journeys                                                                                       | minutes     | build, Docker |
| **`verify`**                        | `check` + `check:db` + `test:integration` + `build` + `test:ds` + `test:e2e:smoke`                                 | CI parity   | Docker        |
| `harness:check`                     | `check-harness` plus the harness and script tests                                                                  | seconds     |               |
| `doctor`                            | Environment diagnosis (§6)                                                                                         | seconds     |               |

---

## 2. Gate catalogue

**M** = mandatory, **R** = recommended, **O** = optional. **From** = the stage that introduces it. **Source** = already in the plan (`plan NN`) or added by the harness (**new**). Everything that is **new** is small: a script of tens of lines or a configuration block, and nothing needs a service account.

| ID     | Gate                        | What it checks                                                                                                                                                                                                                                                                                                                                                       | Tool or script                                            | Runs in                                  | M/R/O                                                               | From                    | Source                          |
| ------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------- | ----------------------- | ------------------------------- |
| G-01   | Format                      | Prettier clean; LF endings                                                                                                                                                                                                                                                                                                                                           | `prettier --check`                                        | `check`, hook, CI static                 | M                                                                   | S1                      | plan 08                         |
| G-02   | Lint                        | Import boundaries; restricted syntax and imports; a11y; Next.js rules; no `console`; test hygiene; unused disable directives (§3)                                                                                                                                                                                                                                    | ESLint flat config with `eslint-plugin-boundaries`        | `check`, hook, CI static                 | M                                                                   | S1                      | plan 03 §5.2, plan 08 (refined) |
| G-03   | Types                       | `tsc --noEmit` with the strict flags                                                                                                                                                                                                                                                                                                                                 | `tsc`                                                     | `check`, CI static                       | M                                                                   | S1                      | plan 08                         |
| G-04   | Tokens                      | No hard-coded colours, px values, spacing steps or default palette; token parity with the approved UX; JS token constants equal CSS                                                                                                                                                                                                                                  | `check-tokens.mjs`, `check-token-parity.mjs`, `UT-tokens` | `policy`, CI static                      | M                                                                   | S2                      | plan 04 §2.12 to 2.13           |
| G-05   | Unit                        | Schemas, rules, formatting, status machines, registry test, script tests                                                                                                                                                                                                                                                                                             | Vitest                                                    | `check`, CI unit                         | M                                                                   | S1                      | plan 08 §3                      |
| G-06   | Database                    | Apply all migrations to an empty database; `supabase db lint`; pgTAP (RLS matrix, triggers, functions, storage, BR trace)                                                                                                                                                                                                                                            | `supabase db reset`, `db lint`, `supabase test db`        | `check:db`, CI db                        | M                                                                   | S3                      | plan 08 §4.1                    |
| G-07   | Types diff                  | Generated database types equal the committed file                                                                                                                                                                                                                                                                                                                    | `gen:types` then `git diff --exit-code`                   | `check:db`, CI db                        | M                                                                   | S3                      | plan 08 §8.1                    |
| G-08   | Integration                 | Authorization matrix, queries, actions, handlers against the local stack with fakes                                                                                                                                                                                                                                                                                  | Vitest                                                    | `test:integration`, CI db                | M                                                                   | S3                      | plan 08 §4.2                    |
| G-09   | Build                       | `next build`; then no server-only variable name or value in `.next/static`                                                                                                                                                                                                                                                                                           | `next build`, `check-client-bundle.mjs`                   | `verify`, CI build                       | M                                                                   | S1                      | plan 08; scan **new**           |
| G-10   | E2E and design lab          | Playwright smoke; axe on Design Lab pages and visited states; visual snapshots; flag-off navigation                                                                                                                                                                                                                                                                  | Playwright, `@axe-core/playwright`                        | `test:ds`, `test:e2e:smoke`, CI          | M                                                                   | S2 (lab), S4 (journeys) | plan 08 §5 to 6                 |
| G-11   | Dependencies                | `npm audit --omit=dev --audit-level=high`; only `package-lock.json` exists; banned packages; added or changed packages reported with licence and install-script flag; PR note present                                                                                                                                                                                | `npm audit`, `check-deps.mjs`                             | `policy` (offline part), CI security     | M                                                                   | S1                      | plan 07 §13; report **new**     |
| G-12   | Secrets                     | No secret in the tree or history                                                                                                                                                                                                                                                                                                                                     | gitleaks CLI                                              | hook (R), CI security (M)                | M in CI                                                             | S1                      | plan 07 §9                      |
| G-13   | Migrations policy           | Existing migrations unchanged; new file name pattern; timestamp after newest on base; each `create table` has RLS enabled in the same file; destructive SQL has a rollback file and header                                                                                                                                                                           | `check-migrations.mjs`                                    | `check:db`, CI db                        | M                                                                   | S3                      | **new**                         |
| G-14   | Hygiene                     | `eslint-disable` without a reason; `@ts-ignore`; `@ts-expect-error` without a description; TODO without an issue number; `.only` or `.skip` in tests; banned files and strings (demo brand, `middleware.ts`, other lockfiles, `CLAUDE.local.md`, provider hostnames outside adapters, `SUPABASE_SERVICE_ROLE_KEY` outside the env module); expired allowlist entries | `check-hygiene.mjs`                                       | `policy`, hook, CI static                | M                                                                   | S1                      | plan 13 §1; **new**             |
| G-15   | Env parity                  | Variable names in the `env.ts` schemas equal `.env.example`; no `process.env` elsewhere                                                                                                                                                                                                                                                                              | `check-env.mjs`                                           | `policy`, CI static                      | M                                                                   | S1                      | plan 03 §8; **new**             |
| G-16   | Harness integrity           | Size limits; paths, scripts, documents and rule IDs mentioned in instruction files exist; Next.js block markers intact; ADR numbering and status; skills and hooks valid; no `CLAUDE.md` other than the one-line fallback                                                                                                                                            | `check-harness.mjs`                                       | `policy`, `harness:check`, CI static     | M                                                                   | S1                      | **new**                         |
| G-17   | Pull request                | Conventional title; template headings present; one class ticked; verification section filled; `Gate-change:` line present, and not `none` when gate files changed; PR to `main` comes from `develop`                                                                                                                                                                 | `check-pr.mjs`                                            | CI (PR events), L-01 for commit messages | M (title, body); the `Gate-change` part is M if `HD-12` is approved | S1                      | plan 08 §8.1(10); **new**       |
| G-18   | Unused code                 | Unused files, exports and dependencies                                                                                                                                                                                                                                                                                                                               | `knip`                                                    | CI static                                | R (report at S1, error from S3)                                     | S1                      | plan 04 §9                      |
| G-19   | Duplicates                  | Copy-pasted blocks over a threshold                                                                                                                                                                                                                                                                                                                                  | `jscpd`                                                   | CI static, report only                   | O                                                                   | S2                      | plan 04 §9                      |
| G-20   | Migration lock safety       | Locking or unsafe DDL on existing tables                                                                                                                                                                                                                                                                                                                             | `squawk` on changed migrations                            | CI db                                    | O (adopt at the first production migration)                         | S9                      | **new**                         |
| (plan) | Performance, load, ZAP, SEO | Lighthouse CI, bundle budgets, k6, ZAP baseline                                                                                                                                                                                                                                                                                                                      | as plan 08 §7                                             | nightly                                  | as plan                                                             | S4 on                   | plan 08 §7                      |

Local layers (not gates):

| ID   | Layer                                                                                                              | Purpose                                       | M/R               |
| ---- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ----------------- |
| L-01 | `lefthook` hooks: staged format and lint, `check-hygiene --staged`, gitleaks on staged files, commit message check | Catch problems before they reach a PR         | R                 |
| L-02 | `npm run doctor`                                                                                                   | Tell a new developer or agent what is missing | M                 |
| L-03 | Claude Code permissions and guard hooks (`06` §3)                                                                  | Prevent secret reads and destructive commands | M for Claude Code |
| L-04 | `.mcp.json` with a pinned `next-devtools-mcp`                                                                      | Live dev-server feedback                      | O                 |

---

## 3. G-02: how the lint gate implements the rules

One ESLint flat config. Each block below maps to rule IDs in `03`. The config is written at `H1-T04` and proven by the negative tests in `08` §4.

| Block              | Mechanism                                                                                                                                                                                                                                                                                                                                                                                | Implements                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Base               | `eslint-config-next` (core web vitals), `typescript-eslint` (strict preset; the type-checked variant is decided by measured lint time at `H1-T04`), `reportUnusedDisableDirectives: "error"`                                                                                                                                                                                             | R-GEN-02, R-FE-12                                        |
| Accessibility      | `jsx-a11y` rules from the Next.js config raised to `error`                                                                                                                                                                                                                                                                                                                               | R-FE-16                                                  |
| Layers             | `eslint-plugin-boundaries`: element types `app`, `feature` (captured by name), `ui`, `patterns`, `layout`, `domain`, `charts`, `server`, `lib`, `types`, `styles`, `client-island` (`*.client.tsx`); `element-types` with the table of plan 03 §5.2; `entry-point` so features are imported only through `index.ts`                                                                      | R-FE-02, R-FE-03                                         |
| Restricted imports | `no-restricted-imports` with overrides: `admin.server.ts` only from the allow-list; `@tanstack/react-query` only in client islands and portal and account layouts; provider SDKs and `fetch` to provider hosts only in `server/{sms,places,mail}`; `server-only` modules never from `*.client.tsx`                                                                                       | R-BE-07, R-FE-13, R-BE-09                                |
| Restricted syntax  | `no-restricted-syntax` selectors: raw `button`, `input`, `select`, `textarea`, `a` JSX in `features/**` and `app/**`; the `'use client'` directive in a file not named `*.client.tsx`; the `'use server'` directive outside `actions.ts`; non-`defineAction` exports from `actions.ts`; `.select()` with no argument or `'*'`; `waitForTimeout`; `.only`, `.skip`, `.todo` in test files | R-FE-06, R-FE-01, R-BE-01, R-BE-06, R-TEST-02, R-TEST-03 |
| Env and logging    | core `no-process-env` (off in the two env modules), `no-console`                                                                                                                                                                                                                                                                                                                         | R-GEN-07, R-GEN-03, R-BE-10                              |
| Exports            | core `no-restricted-exports` for `default`, with overrides for Next.js special files and config files                                                                                                                                                                                                                                                                                    | R-GEN-04                                                 |
| React and Next     | `react/no-danger`, `react/jsx-no-target-blank`, `@next/next/no-img-element`                                                                                                                                                                                                                                                                                                              | R-FE-14, R-FE-15, R-FE-12                                |

Design choices that keep this light: no extra lint plugin beyond `eslint-plugin-boundaries`; test rules use core selectors instead of `eslint-plugin-vitest` or `eslint-plugin-playwright`; the allow-lists live in the config file, are reviewed under CODEOWNERS, and are covered by negative tests.

---

## 4. Script specifications (new scripts)

All are plain `.mjs` (no TypeScript build step, no dependency), live in `scripts/`, read inputs from files and environment variables (never by interpolating untrusted text into a shell), print one line per finding as `file:line rule-id message`, and exit non-zero on a finding. Each has a test in `scripts/__tests__/`. Waivers go in `scripts/policy/allowlist.json` as `{ path, rule, reason, issue, expires }`; an entry with a missing issue or a past date is itself a failure.

| Script                                       | Gate | Inputs                                                                                                | Checks                                                                                                                                                                                                                                                                                                                                                                   | Notes                                                               |
| -------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `check-hygiene.mjs` (`--staged` for hooks)   | G-14 | `git ls-files` (or staged files)                                                                      | Patterns in §2 row G-14. Banned strings come from `scripts/policy/banned-strings.json` with path scopes (for example provider hostnames allowed only under `src/server/{places,sms,mail}`)                                                                                                                                                                               | Fast; regex based; no network                                       |
| `check-env.mjs`                              | G-15 | `src/server/env.ts`, `src/lib/public-env.ts`, `.env.example`                                          | Schema keys (one key per line, documented layout) equal `.env.example` names; `process.env` appears nowhere else; no value in `.env.example` that looks like a secret                                                                                                                                                                                                    | Layout rule is part of the `new-action` and env docs                |
| `check-deps.mjs`                             | G-11 | `package.json`, `package-lock.json`, base ref's copy of both, `scripts/policy/banned-deps.json`       | Only `package-lock.json` exists; no banned package; list added, removed and changed packages with the lockfile's licence and `hasInstallScript`; fail on a banned or non-permissive licence, or an install script not allow-listed; in CI fail if packages were added and the PR body says `New dependency: none`                                                        | Offline except `npm audit` (CI only)                                |
| `check-harness.mjs`                          | G-16 | `AGENTS.md` files, `docs/engineering/**`, `docs/adr/**`, `.claude/**`, `lefthook.yml`, `package.json` | Section `harness:check` of `01` §8 and the list in the row G-16                                                                                                                                                                                                                                                                                                          | Also verifies the hook scripts' unit tests exist                    |
| `check-migrations.mjs`                       | G-13 | `git diff --name-status <base>...HEAD -- supabase/migrations`, file contents                          | Only additions (no modify, delete, rename); name `^\d{14}_[a-z0-9_]+\.sql$`; timestamp after the newest on base; each `create table public.x` has `alter table public.x enable row level security` in the same file; `drop table`, `drop column`, `truncate` or `alter column ... type` require `-- destructive: <reason>` and `supabase/rollbacks/<same timestamp>.sql` | Locally warns and skips if the base ref is not fetched; fails in CI |
| `check-pr.mjs`                               | G-17 | PR title and body from the event payload file; changed file list                                      | See row G-17. Skips body checks for Dependabot                                                                                                                                                                                                                                                                                                                           | Reads untrusted PR text as data only; never passes it to a shell    |
| `check-client-bundle.mjs`                    | G-09 | `.next/static/**` after build; server variable names from the env module                              | Fails if any server-only variable name, or `service_role`, appears                                                                                                                                                                                                                                                                                                       |                                                                     |
| `check-tokens.mjs`, `check-token-parity.mjs` | G-04 | `src/**`, `tokens.css`, UX token snapshot                                                             | As plan 04 §2.12 and §2.13                                                                                                                                                                                                                                                                                                                                               | Plan-defined                                                        |
| `doctor.mjs`                                 | L-02 | the machine                                                                                           | §6                                                                                                                                                                                                                                                                                                                                                                       | Informational; exit 1 only on blocking problems                     |

---

## 5. Local hooks (L-01) and commit messages

`lefthook.yml` draft (validated at `H1-T06`). Hooks install through `"prepare": "lefthook install"`; CI installs with `--ignore-scripts`, so hooks never run there, and CI repeats every check anyway.

```yaml
pre-commit:
  parallel: true
  commands:
    format:
      glob: "*.{ts,tsx,js,mjs,json,md,css,yml,yaml}"
      run: npx prettier --check {staged_files}
    lint:
      glob: "*.{ts,tsx,mjs}"
      run: npx eslint --max-warnings 0 {staged_files}
    hygiene:
      run: node scripts/check-hygiene.mjs --staged
    secrets:
      run: node scripts/run-gitleaks.mjs --staged # warns and exits 0 if gitleaks is not installed; doctor reports it
commit-msg:
  commands:
    conventional:
      run: npx commitlint --edit {1}
```

`commitlint.config.mjs` extends `@commitlint/config-conventional`. Squash merges use the PR title, so `G-17` checks the title; the hook helps while working on a branch.

Not used: a pre-push hook (CI covers it and it slows agents); auto-fixing hooks (they hide what changed and interact badly with partially staged files).

---

## 6. `npm run doctor`

Run first by a new developer or agent. Prints OK, WARN or FAIL per item and says how to fix it. Exit 1 only for FAIL.

| Item                   | FAIL when                                                   | WARN when                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node version           | Below the `.nvmrc` and `engines` value                      |                                                                                                                                                         |
| npm                    | Not npm (for example run through another manager)           |                                                                                                                                                         |
| Dependencies installed | `node_modules` missing or lockfile newer                    |                                                                                                                                                         |
| Docker                 |                                                             | Not running (database checks cannot run; say so in PRs)                                                                                                 |
| Supabase CLI           |                                                             | Not available through `npx`                                                                                                                             |
| `gitleaks`             |                                                             | Not installed (hook skipped; CI still scans)                                                                                                            |
| Git                    | `core.autocrlf` not `false` or `input`; hooks not installed |                                                                                                                                                         |
| Path                   |                                                             | The repository path contains a space, or is inside a OneDrive folder (RISK-27): quote paths in scripts, keep the path short, pause sync during installs |
| Claude Code version    |                                                             | Older than the first version that reads `AGENTS.md` natively; a `CLAUDE.local.md` exists                                                                |
| `.env.local`           |                                                             | Missing (copy `.env.example`); never prints values                                                                                                      |

---

## 7. CI mapping

Workflow jobs follow plan 09 §4. New gates are added to existing jobs; one job is new.

| Job (plan 09 §4)             | Gates                                                | Notes                                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `static`                     | G-01, G-02, G-03, G-04, G-14, G-15, G-16, G-18, G-19 | `npm ci --ignore-scripts`; Node version from `.nvmrc`                                                                                                                |
| `pr-policy` (**new**, tiny)  | G-17                                                 | Runs on `pull_request` only; permissions `contents: read`, `pull-requests: read`                                                                                     |
| `unit`                       | G-05                                                 |                                                                                                                                                                      |
| `db`                         | G-06, G-07, G-08, G-13, G-20                         | Supabase CLI through the `supabase/setup-cli` action (the npm package downloads its binary in an install script, which `--ignore-scripts` blocks; confirm at S1-T06) |
| `build`                      | G-09                                                 |                                                                                                                                                                      |
| `e2e-smoke` and `design-lab` | G-10                                                 |                                                                                                                                                                      |
| `security`                   | G-11, G-12                                           | gitleaks run as a CLI, not through an action that may need a licence for organization repositories (verify at S1-T06)                                                |
| `all-checks-passed`          | aggregates the above                                 | The single required status for branch protection                                                                                                                     |

Properties kept from plan 09 §4: least-privilege `permissions`, third-party actions pinned by commit SHA, concurrency cancels superseded runs, no secrets for fork pull requests, no `pull_request_target` with secrets. Budget: `static` plus `unit` under 6 minutes; if exceeded, split the job before adding gates.

### 7.1 Branch protection and rulesets (T1)

| Setting                        | `develop`                                                                   | `main`                                            | Note                                              |
| ------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| Pull request required          | Yes                                                                         | Yes                                               |                                                   |
| Required status                | `all-checks-passed`                                                         | same                                              |                                                   |
| Branch up to date before merge | Yes                                                                         | Yes                                               |                                                   |
| Force push, deletion           | Blocked                                                                     | Blocked                                           |                                                   |
| Merge method                   | **Squash** (title is the conventional commit)                               | **Merge commit**, only from `develop`             | See `CH-01`                                       |
| Linear history                 | Yes                                                                         | **No**                                            | `CH-01`                                           |
| Required approvals             | **0 while there is one human maintainer**, 1 when a second maintainer joins | same                                              | `CH-02`, decision `HD-06`                         |
| Code owner review              | Off while solo; on later                                                    | same                                              |                                                   |
| Conversation resolution        | Required                                                                    | Required                                          |                                                   |
| Bypass                         | Not allowed for administrators                                              | Not allowed                                       | Emergency path is a revert PR, not a bypass       |
| `main` accepts only `develop`  | n/a                                                                         | `G-17` fails a PR to `main` from any other branch | GitHub cannot restrict the source branch natively |
| Environments                   | `dev` (no approval)                                                         | `production` (required reviewer)                  | plan 09 §5                                        |

Verify at `S1-T06` that the GitHub plan supports these on a private repository (decision `DEC-36`).

---

## 8. How compliance is shown

| Question                                             | Where the answer is                                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Did this change follow the rules?                    | The `all-checks-passed` status on the PR; each `G-nn` failure names the file, line and rule ID |
| Which rules are enforced and which depend on review? | The "Enforced by" column of `03`; known gaps in `03` §10                                       |
| Did the author verify, or only claim?                | The pasted results in the PR template; CI repeats the commands                                 |
| Did anyone change the gates?                         | The `Gate-change:` line, CODEOWNERS, and `G-17` (non-`none` when gate files are in the diff)   |
| Are the instructions still true?                     | `G-16` on every PR                                                                             |
| Does a gate still catch what it should?              | Negative tests (`08` §4), run in `unit`                                                        |
| Are agents following the instructions?               | Canary evals at Stage 1 exit and after major instruction changes (`08` §3.2)                   |

There is no separate dashboard. Compliance is a green check on a PR and a clean `npm run check` locally.

---

## 9. AI-specific risks and the gate that answers each

| Risk                                   | Typical failure                                              | Gate or layer                                                        |
| -------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| Hallucinated or typosquatted package   | Plausible name that does not exist or is malicious           | R-AI-10, L-03 (ask), G-11 (report, install-script flag, banned list) |
| Invented API or option                 | Next.js or Supabase function that does not exist             | R-AI-01 (bundled docs), G-03, G-09, G-08                             |
| Weakened test to reach green           | `.skip`, loosened assertion, deleted case                    | G-02, G-14, `review-change` D                                        |
| Gate tampering                         | Editing lint, CI or hooks to make a failure disappear        | L-03 (ask on gate files), G-17 `Gate-change`, CODEOWNERS             |
| Secret exposure                        | Reading `.env.local`, pasting a key into a fixture or prompt | L-03 (deny), G-12, G-09 bundle scan                                  |
| Service-role misuse                    | Admin client used to "make it work"                          | G-02 allow-list, `IT-AUTHZ`, `review-change` C                       |
| Authorization gap                      | Missing owner check or client-supplied owner id              | G-08 matrix, G-06 RLS matrix, PR checklist                           |
| Edited applied migration               | Quietly changing history                                     | G-13, L-03 (guard hook)                                              |
| Duplicate component or helper          | Re-creating what exists                                      | G-02 (raw elements), G-18, G-19, `R-DS-02`                           |
| Scope creep                            | Refactors and upgrades in a fix                              | R-AI-06, one concern per PR (review)                                 |
| Stale or contradictory instructions    | AGENTS.md says one thing, code another                       | G-16                                                                 |
| Prompt injection through data or pages | Instruction hidden in a listing, issue or web page           | R-AI-09, L-03 (fetch allow-list), no MCP against real data (`06` §6) |

---

## 10. Waivers and emergencies

| Situation                              | Procedure                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A rule produces a false positive       | Add an entry to `scripts/policy/allowlist.json` with reason, issue and expiry, or narrow the rule. Both are a gate change |
| A gate blocks an urgent fix            | Fix forward on a branch; do not bypass. If a gate itself is wrong, fix the gate in its own PR first                       |
| CI is down                             | Merge is blocked by design. Wait or repair CI; do not use administrator bypass                                            |
| A check cannot run locally (no Docker) | Say so in the PR; CI runs it; do not tick the box                                                                         |
