# Playbook: new shared component

Read `AGENTS.md` and the nested file for the folder first.

1. Search `components/`, the Design Lab registry and the UX board; extend before creating.
2. Choose the layer; use Radix or shadcn for accessible primitives and re-theme any generated file.
3. Implement with `cva`, tokens, all states, a specification header. Every visible word, `aria-label` and `alt` comes from `en.json` through `translate('key')` (R-FE-21); the component takes keys or already-translated text as props, never literals.
4. Add the Design Lab entry and registry record; write behaviour tests and an axe check; take baselines at 390, 820, 1440; compare against the UX render.
5. Update docs if a rule or token changed.

## Adding a shadcn component

`components.json` points shadcn at `src/styles/globals.css` and `@/lib/cn`. Run `npx shadcn@latest add <name>` on a clean tree, then:

1. **Check `git diff package.json package-lock.json` before anything else.** The CLI installs what it thinks a missing import is. With our `@/lib/cn` alias it once added an unrelated npm package named `cn` and wrote `from "cn"` in every file. Remove any package you did not choose (`npm uninstall`), and point the imports at `@/lib/cn`.
2. Re-theme the file to Grove tokens: no `foreground`, `ring`, `destructive`, `dark:` or default text sizes. `src/components/__tests__/no-default-styles.test.ts` fails on them.
3. The CLI may add `tw-animate-css` for open and close animations. That is a new dependency (R-DEP-01): ask first, or write the few keyframes in `globals.css`.
4. Then follow the steps above (header, tests, Design Lab entry).
