# Find Prop · Final UX package (Phase 2)

**Status: complete, waiting for your review and explicit approval.** No production code has been written.

The approved direction, **Concept 1 (Search Desk) in the Grove palette** with IBM Plex Serif and IBM Plex Sans, applied to every route in the Phase 1 inventory: **33 routes → 38 designed screens → 180 states → 265 rendered images**, with a documented design system, navigation model, interaction rules, the two homepage advertising layouts with the no-sponsor fallback, and a list of open decisions.

## Start here

1. **Open [index.html](index.html)** in a desktop browser. It is a gallery of every screen with thumbnails, route labels and state chips.
2. Click a screen to open its **working prototype**. It is a real page that reflows at any window width: drag the window narrower to see tablet and phone layouts.
3. Use the **state chips** (or add `#state` to the address, for example `screens/search.html#empty`) to see loading, empty, error, success, confirmation and sign-in-required states.
4. The `renders/` folder has the same screens as images at **desktop 1440**, **tablet 820** and **mobile 390** (`<screen>--<state>--<d|t|m>.webp`).

## Suggested review order

| # | Look at | Why first |
|---|---|---|
| 1 | [homepage-ad-variations.md](homepage-ad-variations.md) with [Variation A](screens/home-a.html), [Variation B](screens/home-b.html) and the [fallback](screens/home-none.html) (add `#spec` to see dimensions and fold lines) | Your highest-priority question |
| 2 | [Search results](screens/search.html) → [Property](screens/property.html) → [Compare](screens/compare.html) | The core buyer journey |
| 3 | [Sign in](screens/auth.html), [Dashboard](screens/dashboard.html), [Post a property](screens/post-property.html) | Owner journey and authentication states |
| 4 | [Admin overview](screens/admin-overview.html), [Projects](screens/admin-projects.html), [Builder dashboard](screens/builder-dashboard.html) | The portals |
| 5 | [Design system boards](screens/ds-foundations.html) | The reusable rules |
| 6 | [design-handoff.md](design-handoff.md) | The decisions I need from you |

## Documents

| File | What it covers |
|---|---|
| [design-system.md](design-system.md) | Tokens, type, spacing, layout, every component, accessibility rules, chart rules |
| [navigation-and-information-architecture.md](navigation-and-information-architecture.md) | Site map, roles, header, account menu, mobile drawer and bottom bar, portal shell, guards |
| [screen-inventory.md](screen-inventory.md) | All 33 routes mapped to designs; every screen and state (generated from the manifest) |
| [interaction-specifications.md](interaction-specifications.md) | How search, filters, enquiries, compare, auth, dashboard, wizard, moderation and charts behave; responsive and keyboard rules |
| [homepage-ad-variations.md](homepage-ad-variations.md) | Variation A, Variation B, the no-sponsor fallback, and the banner container |
| [design-handoff.md](design-handoff.md) | Open decisions, proposals, assumptions, what was and wasn't checked |

## Folder map

```
final-ux/
├── index.html                  review gallery (open this first)
├── README.md and the six documents above
├── screens/                    38 prototype pages (HTML) + design-system boards (ds-*.html)
├── renders/                    265 images: <screen>--<state>--<d|t|m>.webp
├── assets/
│   ├── fp.css                  single stylesheet entry (imports the files below)
│   ├── tokens.css              design tokens
│   ├── base.css                reset, type, layout, focus, review aids
│   ├── c-core.css  c-nav.css  c-cards.css  c-data.css   components
│   ├── s-home.css  s-browse.css  s-account.css  s-portal.css  s-system.css   per-area layouts
│   ├── fp.js                   built from assets/js/ (do not edit)
│   ├── js/                     icons, illustrated placeholders, sample data, components, charts, portal pages
│   ├── ads/                    14 fictional sample banner images (SVG)
│   └── manifest.js             every screen, state, route and viewport
└── tools/                      render, check, build, inventory, sample-banner generators
```

## Direction and boundaries

- **Direction:** Concept 1, Palette A (Grove), IBM Plex Serif and IBM Plex Sans, Concept 1's navigation approach. The colour values are the exploration's, unchanged. Additions (status colours, dark surface, chart colours, scales) are marked *New* in `tokens.css` and explained in `design-system.md`.
- **Source of truth:** Phase 1 documents for functionality and the 33 routes; `design-exploration-v2/concept-1/`, `recommended-preview/`, `palette-comparison` and `recommendation.md` for the visual direction. The brief also named `design-direction.md`; the exploration folder has none, and the only file of that name is the rejected Step 1 (indigo and saffron) one, which was deliberately **not** used.
- **Not touched** (checked: no file outside `final-ux/` has changed since this phase began): the React + Vite project, `property-platform-analysis/`, `design-exploration-v2/`, the Step 1 files and their backup, and Supabase. Nothing here connects to Supabase or implements business logic.
- **Reading existing code:** I read the existing app's constants (the 12 localities, property types, amenities, label thresholds, price format) to use the **real filter options**. I did not use its visual design.
- **Proposed, not assumed:** anything not in Phase 1 is tagged **Proposed** or **To confirm** in the mockups and listed in `design-handoff.md`.

## How it was built (and what you need to view it)

**Tooling check first, as you asked.** The machine already had Node 24, Python 3.12 with PIL and Chrome, and no global npm packages. That was enough for a static prototype with real screenshots, so **nothing was installed** and no dependency approval was needed.

Plain **HTML, CSS and JavaScript**; no framework, no dependencies. Shared pieces (header, footer, search card, cards, sponsor container, portal shell, charts) are defined once in `assets/js/` and used on every page through tags such as `<fp-header>` and `<fp-cards>`, so they cannot drift between screens. **You need:** a desktop browser and an internet connection for the Google Fonts (otherwise system fonts are used and spacing shifts slightly).

To regenerate anything (needs Node 22+ and Chrome or Edge; no installs):

```
node tools/build-js.mjs            # after editing assets/js: rebuild assets/fp.js
node tools/render.mjs              # render every screen and state to renders/   (--only home-a,search  --vp d,m)
node tools/check.mjs               # QA: console errors, overflow at 5 widths, images, text size, links  (--quick)
node tools/make-inventory.mjs      # rewrite screen-inventory.md and re-check route coverage
python tools/make-ads.py           # regenerate the fictional sample banners
```

## What to keep in mind

- **Imagery is illustrated placeholder art** and all people, developers, projects, prices and contact details are **fictional**. Banners are fictional samples with generic text.
- The prototypes are **static**: search does not filter, forms do not submit. States are selected with the URL hash.
- **Checked in desktop Chrome only** (including phone and tablet widths). Not tested in Safari or Firefox, on real devices, with a screen reader, or with users. See `design-handoff.md` section 7 for exactly what was and wasn't checked.

## What happens next

Nothing, until you decide. Please review, then tell me what to change and which of the decisions in `design-handoff.md` you want to settle. **I will not start production implementation until you approve it explicitly.**
