# Playbook: new vertical slice

Read `AGENTS.md` and the nested file for the folder first.

1. List requirement IDs and acceptance statements; list UX screen keys with every state; check flags.
2. Decide dependencies: a migration (go to `new-migration`, class C2), a shared component (`new-component`), an action (`new-action`).
3. Plan in five lines; get approval if any step is C2.
4. Add the slice's text to `src/i18n/messages/en.json` first, under its own area, and read it with `t('key')` (R-FE-21, R-FE-22).
5. Build in this order: schema and pgTAP → `schemas.ts` → `queries.ts` and `service.ts` → `actions.ts` → components → page composition → every designed state → tests → Design Lab or E2E → docs and traceability.
6. Tests from plan 08 §9: unit, pgTAP, integration matrix, one E2E main plus one error path, axe, baselines.
7. Done: Done-matrix commands, `review-change`.
