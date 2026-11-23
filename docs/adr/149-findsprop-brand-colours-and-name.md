# ADR-149 · The findsprop brand: new palette and the name in lowercase

- Status: Accepted (owner approved the plan and the defaults on 21 Nov 2026, "approve defaults")
- Date: 2026-11-21
- Supersedes: the Grove palette (ivory, forest, copper) of ADR-004's token set and of `docs/ux/final-ux/design-system.md`; the name "Find Prop"
- Related: ADR-004 (token architecture), ADR-127 (fonts), ADR-145 (no screenshot comparison), DEC-01, R-DS-01
- Class: C2 (it changes the approved UX tokens)
- Built in: PR #299 (colours) and PR #300 (name)

## Decision

- **Colours changed, nothing else.** No layout, spacing, size, type, radius, animation, structure or behaviour changed. The logo files, favicon and app icons were not touched. Token names, file names, routes, URLs, API names, database fields, environment variables and package names were not renamed.
- **The palette** (values in `src/styles/tokens.css`; the Tailwind names in `src/styles/theme.css` are unchanged apart from the new ones below):

  | Role                    | Value                                                                                                                                                 |
  | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Action teal             | `#0B7A6C` (primary and accent fills, links, text buttons); hover `#08665A`                                                                            |
  | Brand teal              | `#16B9A4`, **only on ink surfaces** (accent on dark, focus ring on dark, the share card). Never as text on white or behind white text (about 2.5 : 1) |
  | Ink                     | `#0F1A19` (text, the dark surface); on-dark secondary `#B9C6C4`                                                                                       |
  | Amber                   | `#F2A93B`, the Featured and New badges, with ink text                                                                                                 |
  | Page and surfaces       | white page; alternate canvas `#F6F8F8`; teal tint `#E8F7F4`                                                                                           |
  | Text                    | secondary `#5B6B69`; tertiary `#8A9997` for disabled only                                                                                             |
  | Lines                   | border `#DDE4E3`; strong border `#C9D3D1`; divider `#EEF2F1`; input border `#7D8C8A`                                                                  |
  | Status                  | success `#15803D` on `#ECFDF3`; warning `#B45309` on `#FFF7E6`; error `#DC2626` on `#FEF2F2`, with error **text** on the tint `#B91C1C`               |
  | Focus ring, placeholder | ring `#0B7A6C` on light and `#16B9A4` on dark; placeholder `#5B6B69`                                                                                  |

- **The old names stay as token names.** `accent`, `primary`, `canvas`, `ink` and the rest keep their names, so about 940 class uses did not change. "Copper" in older documents now means the **action teal**; "forest" now also means the action teal (the two merged); "ivory" and "parchment" mean white and `#F6F8F8`. The one-`accent`-button-per-view rule (R-FE-08) is unchanged and now reads "one action-teal button per view".
- **New tokens:** `--c-amber` and `--c-on-amber`, `--c-disabled`, `--c-danger-text`, `--c-divider`, each with a Tailwind bridge entry.
- **Small class edits (17 files)** where one token could not serve two roles: amber badges (`badge`, `dropdown-menu`), the secondary button (ink text, strong border), `text-danger-text` on tinted backgrounds, `text-disabled` on disabled controls, `bg-divider` on separators and table rows, and `bg-canvas-sunken` on the portal column, the results page and the dashboard (so white cards stand out on the alternate canvas). The homepage banner (`cta-band`) moved to the ink surface, because white text on the brand teal failed axe.
- **Accessibility.** Every text pair in `scripts/__tests__/token-contrast.test.mjs` is at least 4.5 : 1 and every border and focus pair at least 3 : 1; white on action teal is about 5.2 : 1. The test gained pairs for the new tokens and a check that brand teal is not used on white.
- **The name is "findsprop"**: always lowercase, one word. It was changed in `src/i18n/messages/en.json` (so page titles, meta, Open Graph, Twitter and structured data follow), the terms heading, the CRM test text, Design Lab sample copy and the tests that assert them. The terms anchor id `using-find-prop` is kept so links still work.

## Decisions taken by default (owner approved)

- Three colours are derived because the palette does not name them: teal 100 `#DDECEA` (the second tint), ink 800 `#3A4342` (the active dark item), and the info and neutral status pairs (teal and grey).
- The four chart series colours are **unchanged**, because the palette names no categorical colours. The old rust is kept as `--p-series-rust`.
- The `Logo` and `ArchMark` components read `--c-primary`, so they turn teal until the real logo is swapped in. Their files were not edited.
- `docs/ux/final-ux/assets/tokens.css` (the UX token snapshot) was updated so `check-token-parity` passes; `scripts/policy/token-parity.json` was not edited.

## Left as it was, on purpose

- **The UX package** (`docs/ux/**`: the HTML mock-ups, CSS, scripts, renders and the hand-off texts) still shows the Grove palette and "Find Prop". It is the record of what the owner approved in October and November. Notes at the top of the design-system and README files say so. Redrawing it is a separate piece of work.
- **Earlier ADRs** keep their wording; they describe what was decided then.
- **`AGENTS.md` and `README.md`** still say "Find Prop" and "copper". Both are C2 files (`Gate-change:` line), so the owner decides when to edit them.
- Code comments, placeholder domains (`findprop.example`), test fixtures, and the `tokens.css` header comment.

## Outside the repository (owner to do)

- **SMS code text.** The DLT template registered with Ping4SMS may still say "Find Prop". The template must match the registered text exactly (`docs/runbooks/send-sms-hook.md`), so it changes only after a new registration.
- **Site name in the database.** Any site name saved in admin Site content is data and may still say "Find Prop".
- **Sender names** at Supabase and Resend.
- **The real logo** (and favicon and app icons), when the owner is ready.

## Consequences you should know

- The Design Lab no longer compares screenshots (ADR-145), so there were no baselines to replace; axe, the scroll check and the keyboard tests still gate every board.
- Nobody had looked at the result in a browser when this was written. Worth a look: the logo (now teal), the homepage banner on ink, the sign-in tag (reads "findsprop", not capitals), amber badges, disabled buttons, error alerts, charts, and white cards on the grey results, dashboard and portal pages.
- A visitor sees a new name and colours with the same layout, so no requirement, route or acceptance criterion changes.
