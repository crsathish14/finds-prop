# Project status and standing decisions

Read this at the start of a session, before `docs/engineering/`. It says where the project stands, what to do next, and which decisions are already made so nobody reopens them. It does not repeat the rules (those are in `docs/engineering/`) or the reasons (those are in `docs/adr/`).

**Keep it current.** The pull request that finishes or starts a task updates the table below. Keep the file under about 80 lines; move history to the ADRs.

## Where we are

Plan: `property-platform-implementation-plan/` (outside this repo, owner's copy). Task IDs such as `S2-T04` come from its roadmap (file `10`).

| Stage                    | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Foundation and harness | Merged. Open acceptance items: A-07 and A-10 (need fresh agent sessions), SPK-01 (signed-in session), SPK-03 (deployed header check).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| i18n (`en.json`)         | Merged (ADR-035). Rules R-FE-21 to R-FE-23, gate G-21.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2 Design system          | In progress. Merged: S2-T01 to T08. S2-T09 done (PR open): a test enforces the component spec headers, and `docs/ux-reference.md` indexes the five Design Lab boards. **Next: T10, your sign-off**, then the harness overlay H2-T02 (`test:ds` in CI, a `jscpd` duplicate-code report, decide `prettier-plugin-tailwindcss`; the last two are new dependencies and need approval) and H2-T03 (Stage 2 retro) (open `/design-system` with `DESIGN_LAB=1` and compare with the UX boards). CI does not run `test:ds` yet, by the owner's decision: add it once all of Stage 2 is complete (see Open items). S4 cannot start before T10. |
| 3 Backend foundations    | In progress. Merged and deployed to dev: S3-T01, all database migrations (F01 to F08, the builder type and the two admin addresses) and the dev deploy workflow (S3-T15). In review: session view, guards and the request id to Supabase (S3-T07). Waiting on the owner: the auth spike (S3-T08, `docs/runbooks/auth-spike.md`). **Next:** customer phone sign-in with MSG91 (S3-T09), staff Google sign-in (S3-T10), route skeleton (S3-T11), full `defineAction` pipeline (S3-T12).                                                                                                                                                 |

## Standing decisions (do not reopen without the owner)

- **No Docker.** Docker and WSL do not run on the owner's machine. Daily database work uses the hosted `findsprop-dev` Supabase project, and migrations reach it only through the `db-deploy` workflow after a merge to `develop` (owner decision, 1 Nov 2026). Nobody runs `link` or `db push` by hand; agents never run link, `db push` or `--linked` commands, and ask before every git push. The CI `db` job does lint, pgTAP and the types diff. (ADR-034)
- **No GitHub branch rules.** Discipline only, zero required approvals while the owner works alone. Revisit when a second maintainer joins or before launch. (DEC-36, `docs/adr/030-ai-harness.md` A-05)
- **Merges are human.** An agent opens pull requests and never merges or changes the default branch. Ask before any push, and before creating the Vercel project. (R-AI-12)
- **Pull requests are written and opened by the main working agent, not delegated.** The agent that did the work writes the title and body from the pull request template, ticks exactly one change class, never ticks a human-review box, and checks the body after creating it. Do not hand the step to a cheaper model or subagent. (Owner rule, 1 Nov 2026; it replaces the 31 Oct rule that required the Haiku model.)
- **Content security policy:** `'unsafe-inline'` for scripts, Report-Only now, enforced after Stage 4. (DEC-37, ADR-033)
- **`AGENTS.md` only.** No `CLAUDE.md`, no `CLAUDE.local.md`, so every AI tool reads the same instructions. Names are whole words. (R-GEN-11)
- **Dependencies:** `tw-animate-css` is not installed; ask before adding it. After `npx shadcn add`, read `git diff package.json` first: the CLI once installed an unrelated package named `cn`. (`docs/engineering/playbooks/new-component.md`)
- **UX deviations:** where the approved UX uses a literal that is not a token, use the nearest token and say so in the pull request. The owner reviews visual differences at S2-T10.

## Open items (owner decisions waiting)

- **Add `test:ds` to CI** (the Design Lab axe, keyboard and screenshot checks; gate G-10 lab part, task H2-T02). The owner will ask for it when all of Stage 2 is complete. It edits `.github/workflows/ci.yml`, a gate file, so the pull request needs a `Gate-change:` line. The job must run `npm run build` and then `npm run test:ds`, with the Playwright browser installed.
- **Screenshot baselines** for the Design Lab are not stored yet; decide at the Stage 2 sign-off (S2-T10).
- **Sponsor popover wording** ("About sponsored content") is the UX's draft and awaits approval.

- **"Browse properties" button on the not-found page** (in the UX) is left out until `/properties` exists (Stage 4); add it then.

- **UX source still says "no autoplay" for sponsored banners.** The owner changed this to a 2-second carousel (ADR-038, no Play/Pause button). The approved UX package at its source, this repo's read-only copy in `docs/ux/final-ux/`, and the implementation plan still describe a manual pager; update them together (R-DS-05). Also revisit WCAG 2.2.2 (a pause control) if an accessibility review asks for it.

## Working notes

- Branches are `feat/…`, `fix/…`, `chore/…`, `docs/…` from `develop`; squash into `develop`.
- Windows and OneDrive: LF endings, no symlinks, pause sync during `npm ci`.
- The Google Fonts download in `next build` needs network access (CI has it).
