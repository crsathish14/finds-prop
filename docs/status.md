# Project status and standing decisions

Read this at the start of a session, before `docs/engineering/`. It says where the project stands, what to do next, and which decisions are already made so nobody reopens them. It does not repeat the rules (those are in `docs/engineering/`) or the reasons (those are in `docs/adr/`).

**Keep it current.** The pull request that finishes or starts a task updates the table below. Keep the file under about 80 lines; move history to the ADRs.

## Where we are

Plan: `property-platform-implementation-plan/` (outside this repo, owner's copy). Task IDs such as `S2-T04` come from its roadmap (file `10`).

| Stage                    | State                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Foundation and harness | Merged. Open acceptance items: A-07 and A-10 (need fresh agent sessions), SPK-01 (signed-in session), SPK-03 (deployed header check).                                                                                                                                                                                                                                                                                         |
| i18n (`en.json`)         | Merged (ADR-035). Rules R-FE-21 to R-FE-23, gate G-21.                                                                                                                                                                                                                                                                                                                                                                        |
| 2 Design system          | In progress. Merged: S2-T01 to T06. S2-T07 Design Lab built (PR open): five boards, 13 whole-page previews, registry test, axe and keyboard checks in a real browser. **Next: S2-T08 styled error pages, T09 docs, then T10 your sign-off** (open `/design-system` with `DESIGN_LAB=1` and compare with the UX boards). CI does not run `test:ds` yet; that needs approval (it changes `ci.yml`). S4 cannot start before T10. |
| 3 Backend foundations    | Not started. Database tasks may run in parallel with Stage 2.                                                                                                                                                                                                                                                                                                                                                                 |

## Standing decisions (do not reopen without the owner)

- **No Docker.** Docker and WSL do not run on the owner's machine. Daily database work uses the hosted `findsprop-dev` Supabase project, and only the owner runs `supabase link` and `db push`. Agents never run link, `db push` or `--linked` commands. The CI `db` job does lint, pgTAP and the types diff. (ADR-034)
- **No GitHub branch rules.** Discipline only, zero required approvals while the owner works alone. Revisit when a second maintainer joins or before launch. (DEC-36, `docs/adr/030-ai-harness.md` A-05)
- **Merges are human.** An agent opens pull requests and never merges or changes the default branch. Ask before any push, and before creating the Vercel project. (R-AI-12)
- **Content security policy:** `'unsafe-inline'` for scripts, Report-Only now, enforced after Stage 4. (DEC-37, ADR-033)
- **`AGENTS.md` only.** No `CLAUDE.md`, no `CLAUDE.local.md`, so every AI tool reads the same instructions. Names are whole words. (R-GEN-11)
- **Dependencies:** `tw-animate-css` is not installed; ask before adding it. After `npx shadcn add`, read `git diff package.json` first: the CLI once installed an unrelated package named `cn`. (`docs/engineering/playbooks/new-component.md`)
- **UX deviations:** where the approved UX uses a literal that is not a token, use the nearest token and say so in the pull request. The owner reviews visual differences at S2-T10.

## Working notes

- Branches are `feat/…`, `fix/…`, `chore/…`, `docs/…` from `develop`; squash into `develop`.
- Windows and OneDrive: LF endings, no symlinks, pause sync during `npm ci`.
- The Google Fonts download in `next build` needs network access (CI has it).
