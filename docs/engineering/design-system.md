# Design system and UX standards

> Source: distilled from the approved implementation plan and AI harness design (30 Oct 2026). References such as `plan 07 §4.2`, `03` §10 or `ADR-009` point to the archived plan, the harness design documents, or `docs/adr/`. From Stage 1 (S1-T12) this repository is authoritative (HD-11).

The approved UX package is in `docs/ux/` (text, HTML and CSS; renders are not copied) and is indexed by `docs/ux-reference.md`. Tokens live in `src/styles/tokens.css`.

## Rules

| ID      | Rule                                                                                                                                                                                                   | Enforced by                               | Source                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ------------------------ |
| R-DS-01 | `src/styles/tokens.css` is the single source of tokens and stays in parity with the approved UX tokens (allow-file for intentional differences). shadcn `--accent` is a hover surface; copper is `cta` | G-04                                      | ADR-004, plan 04 §2.12   |
| R-DS-02 | Shared UI lives only in `components/{ui,patterns,layout,domain,charts}`. Search it and the Design Lab before creating a component. Promote to a shared layer on the second use, in the same PR         | G-02 (R-FE-06); G-18, G-19; PR template   | plan 04 §9               |
| R-DS-03 | A shared component ships with a specification header, a Design Lab entry, a registry test, an axe pass and baselines at 390, 820 and 1440                                                              | G-05 (registry test), G-10                | plan 04 §7.1             |
| R-DS-04 | Dialog, menu, popover, combobox, tabs and tooltip come from Radix or shadcn, not custom code                                                                                                           | Review                                    | plan 13 §3               |
| R-DS-05 | The approved UX (`docs/ux/`) is the visual source of truth. Baselines come from the implementation and are reviewed against the UX renders; a deviation needs approval                                 | Review (PR field)                         | plan 04 §8               |
| R-DS-06 | A proposed or unapproved UX item is not built, not even hidden                                                                                                                                         | Review (PR field)                         | plan 13 §2, §9           |
| R-DS-07 | Responsive checks use the UX widths 390, 820, 1024, 1280, 1440. No Tailwind default breakpoints (`sm` to `2xl`)                                                                                        | G-04, G-10 (`scrollWidth <= clientWidth`) | plan 04 §2.7, plan 08 §6 |
| R-DS-08 | The sponsor slot renders nothing when no sponsor fits: no frame, label or gap. Image errors remove the slot                                                                                            | G-05 (`UT-sponsors`), G-10 (E2E-09)       | plan 04 §5.2             |
| R-DS-09 | Status colour always comes with a word; icons never carry meaning alone                                                                                                                                | G-10 (axe); Review                        | UX design system         |

## Principles and build order

1. **Tokens first, then atoms, molecules, organisms, templates.** A layer may only depend on layers beneath it.
2. **One implementation per concept.** If two screens show a price, they render the same `PriceDisplay`.
3. **Adopt before building.** Use shadcn/ui (Radix) for complex accessible behaviour; hand-build only what the UX needs that it does not provide.
4. **Every shared component has a Design Lab page** (§8) showing all variants and states before it is used on a real page.
5. **No hard-coded colours, spacing or type** in features or pages (§2.13).
6. **Proposed UX items are marked in code review, not shipped as decoration.** The dashed "Proposed" tags and review notes in the prototypes are review aids and never ship.

**Stage 2 gate (see `10`):** tokens + primitives + molecules + layout organisms (header, footer, mobile drawer, bottom bar, portal shell, sponsor slot) exist in the Design Lab, pass axe, and match the five UX boards at 390 / 820 / 1440. Domain organisms (PropertyCard, SearchCard, …) are built at the **start of the stage that first needs them** (S4 onward) but under the same rules and with Design Lab entries.

## Parity with the approved UX

`scripts/check-token-parity.mjs` loads the approved `final-ux/assets/tokens.css` (snapshot kept in `docs/ux-reference/tokens.ux.css`) and the production `tokens.css`, resolves every shared variable, and fails on any difference. Intentional differences (additions in §10, the focus-on-dark token) are listed in an allow-file with a reason. Run in CI.

## Enforcement against hard-coded values

| Check                                                                                    | Tool                                                                     | Fails on                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Hex/rgb/hsl colours, `bg-[#…]`, `text-[…px]`, `p-[…px]`, inline `style={{ color … }}`    | `scripts/check-tokens.mjs` (regex over `src/**` excluding `src/styles/`) | any match outside the allow-list                          |
| Disallowed spacing steps                                                                 | same script                                                              | `p-7`, `gap-9`, `mt-12`…                                  |
| Default Tailwind palette classes                                                         | reset in `theme.css` + script                                            | `bg-gray-*`, `text-red-*`…                                |
| Raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<a>` in `features/**` and `app/**` | ESLint `no-restricted-syntax`                                            | use `Button`, `Input`, `NativeSelect`, `Textarea`, `Link` |
| Token parity                                                                             | script above                                                             | drift from approved UX                                    |

## Component standards

### 7.1 Required specification for every shared component

Recorded in the component's Design Lab page and in a short header comment:

1. **Purpose and owner** (design-system owner vs feature).
2. **Props and variants** (typed; no free-form `style`).
3. **Responsive behaviour** (by breakpoint token).
4. **Accessibility** (roles, keyboard, labels, live regions, target size).
5. **States:** default, hover, focus, pressed/selected, disabled, loading, error, empty (where applicable).
6. **Dependencies** (atoms/molecules it composes; libraries).
7. **Tests:** RTL behaviour, axe in the Design Lab, visual baseline.
8. **Design reference:** UX board/screen key and render file.

### 7.2 Key component notes (beyond the tables)

- **Button.** Exactly **one `accent` (copper) button per view** (UX rule); portals use `primary`. Dev-mode warning if two `accent` buttons mount in one `main` (cheap `data-attr` count check in the Design Lab and E2E, not production).
- **FormField.** Error messages are linked via `aria-describedby`; long forms render an error summary and move focus to the first error; never lose typed values on failure.
- **SearchCard.** Fields in fixed order (Locality, Property type, Bedrooms, Max budget); Bedrooms single value; Max budget only (BR rules); sale vs rent budget steps swap on Buy/Rent; "New projects" is a link-tab; "Describe it in words" only when `FLAG_AI_SEARCH` is on; Search always enabled (empty search allowed).
- **PropertyCard.** The whole card is one link target (title link stretched) with separate focusable heart and Compare controls; compare toggles disable at 3 with the "You can compare up to 3 homes" message; image uses `next/image` with `sizes` per grid column.
- **PropertyGallery.** Thumbnails are buttons named "Photo 3: Kitchen" (uses `alt_text`); missing image falls back to the illustrated placeholder tile; single photo hides strip and arrows.
- **ResponsiveTable.** One data definition renders both table and card layouts; row menus portal above scroll containers; actions always have text labels or `aria-label`.
- **Toast.** Toasts never carry the only copy of an error (inline alert persists).
- **Charts.** Series colours pinned to entities; legend for ≥2 series; text in ink; table view for every chart (`S7-SPK-01`).

## Documentation and visual review workflow

**Design Lab** (ADR-020, `DEC-22`): dev-only routes under `/design-system/` that reproduce the five UX boards using the real components.

| Page                         | Mirrors          | Contents                                                                                                                         |
| ---------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/design-system/foundations` | `ds-foundations` | Colour (with measured contrast ratios), type scale, spacing, shape, layout, focus, icons                                         |
| `/design-system/components`  | `ds-components`  | Buttons, fields, badges, cards, gallery, tables, wizard, search card — every variant and state, long-text and missing-data cases |
| `/design-system/navigation`  | `ds-navigation`  | Header per role, avatar menus, portal shell, drawer, bottom bar                                                                  |
| `/design-system/feedback`    | `ds-feedback`    | Alerts, toasts, dialogs, sheets, empty/loading states, validation                                                                |
| `/design-system/ads`         | `ds-ads`         | Sponsor slot anatomy, formats, fitting, multi-ad, placements, fallback                                                           |

Each section renders from a typed registry so adding a component without a lab entry fails a unit test.

**Review workflow**

1. A change under `components/**` must update its lab page and Playwright baselines in the same PR.
2. CI runs axe on every lab page and Playwright screenshots at 390 / 820 / 1440; diffs fail the PR unless the baseline is intentionally updated.
3. The reviewer compares the lab render with the matching UX render in `final-ux/renders/` (side by side) and ticks the checklist: token usage, states, keyboard, responsive, long text.
4. **Stage 2 sign-off:** you review the five lab pages against the UX boards. Approval is recorded before S4 starts.
5. Baselines are taken from the _implementation_ (fonts and real icons differ slightly from the prototypes), not pixel-matched to the prototype PNG/WEBP.

## Preventing duplicated components

1. **Folder rule.** Shared UI exists only in `components/{ui,patterns,layout,domain,charts}`; `features/*/components` holds feature-specific compositions that _consume_ them.
2. **Promote on second use.** A component needed by two features moves to `components/*` in the PR that introduces the second use.
3. **Lint.** Raw interactive elements are banned in `features/**` and `app/**` (§2.13).
4. **CODEOWNERS.** `components/**`, `styles/**` require design-system owner review.
5. **Duplicate-code scan.** `jscpd` (warn) in CI over `src/` to flag copy-pasted JSX.
6. **PR template.** "Searched `components/` and the Design Lab for an existing component" is a required checkbox.
7. **Unused-export scan.** `knip` flags dead shared components monthly.
8. **Single maps.** Status, label and vocabulary maps exist once (`StatusBadge`, `config/vocab.ts`).
