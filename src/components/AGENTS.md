# Components (design system)

Read `docs/engineering/design-system.md` and the matching screen in `docs/ux-reference.md` first.
Layers, importing downward only: ui (atoms) → patterns (molecules) → layout, domain, charts (organisms). Features consume these; they never define shared UI.

1. Search this folder and the Design Lab registry before creating a component. When a second feature needs one, move it here in the same PR. (R-DS-02)
2. Style only through tokens (src/styles/tokens.css, used through the theme classes in theme.css; `npm run policy` runs check-tokens and check-token-parity). No hex, rgb or hsl; no `p-[13px]`; no `bg-gray-*`; no spacing step outside the scale; no Tailwind default breakpoints. (R-FE-07, R-DS-07)
3. Type props. Variants through `cva`. Forward `className` with `cn`. No `style` pass-through.
4. A shared component ships with: header comment (purpose, props, responsive, accessibility, states, dependencies, tests, UX reference), Design Lab entry, registry test, axe pass, baselines at 390, 820 and 1440. (R-DS-03)
5. States belong to the component: default, hover, focus, pressed, disabled, loading (width held), error, empty where relevant.
6. Dialog, menu, popover, combobox, tabs, tooltip come from Radix or shadcn. Do not hand-roll them. (R-DS-04)
7. shadcn `--accent` is a hover surface; copper is `cta`. Re-theme generated shadcn files; leave no default styles. (R-DS-01)
8. One `accent` button per view; portals use `primary`. (R-FE-08)
9. No `dangerouslySetInnerHTML`. External links `rel="noopener"`; sponsor links `rel="sponsored noopener"`, https only. (R-FE-14, R-FE-15)
10. Images through `next/image` with `sizes` and a fixed aspect ratio, and a fallback tile. (R-FE-12)
11. Status colour always comes with a word. (R-DS-09)

Proposed UX items are not built. A missing screen or state: stop and ask.
