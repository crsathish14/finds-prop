# Engineering handbook

The normative rules for this repository, written once. `AGENTS.md` summarises and routes; this folder holds the detail. Rule IDs (`R-FE-01` and so on) are defined in exactly one page; gates (`G-01` to `G-20`) are defined in `quality-gates.md`.

| Page                    | Covers                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `frontend.md`           | Server and client components, layers and imports, URL state, forms                                          |
| `backend.md`            | Server Actions, Route Handlers, services, adapters, caching                                                 |
| `database.md`           | Migrations, RLS, grants, functions, storage policies, types, seeds                                          |
| `security.md`           | Authorization, secrets, abuse controls; security for AI-assisted development                                |
| `design-system.md`      | Tokens, shared components, UX conformance, duplicate prevention                                             |
| `testing.md`            | Test pyramid, data and fakes, per-slice checklist, done matrix                                              |
| `test-catalogue.md`     | Every named test (`UT-`, `DB-`, `IT-`, `E2E-`)                                                              |
| `workflow.md`           | Change classes, agent conduct, workflow, git, documentation and ADR policy                                  |
| `dependencies.md`       | Adding dependencies and new technology                                                                      |
| `quality-gates.md`      | Gates, local hooks, CI, branch protection, script specifications                                            |
| `definition-of-done.md` | What done means for a PR, a slice, a component, a migration, a stage                                        |
| `harness-evals.md`      | Canary prompts and seeded violations that prove the harness works                                           |
| `playbooks/`            | Step-by-step procedures: new-slice, new-migration, new-action, new-component, add-dependency, review-change |

Other places: `docs/adr/` (decisions and why), `docs/requirements/` (what to build), `docs/ux/` and `docs/ux-reference.md` (how it must look), `docs/runbooks/` (operations).
