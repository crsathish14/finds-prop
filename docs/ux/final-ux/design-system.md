# Design system

The system is **Concept 1 (Search Desk) with the Grove palette**, Fraunces for display and Figtree for the interface. Brand values are carried over unchanged from `design-exploration-v2/assets/palettes.css`. Everything below is implemented in `assets/` and shown live on four boards:

| Board | What it shows |
|---|---|
| [Foundations](screens/ds-foundations.html) | colour, measured contrast, type, spacing, shape, layout, focus, icons |
| [Components](screens/ds-components.html) | buttons, fields, badges, cards, gallery, tables, flows, search card |
| [Navigation](screens/ds-navigation.html) | header per role, avatar menus, portal shell, mobile drawer and bottom bar |
| [Feedback and states](screens/ds-feedback.html) | alerts, toasts, dialogs, sheets, empty and loading states, validation |
| [Sponsored banner container](screens/ds-ads.html) | anatomy, formats, fitting, placements |

**Source files.** Tokens: `assets/tokens.css`. Components: `assets/c-core.css`, `c-nav.css`, `c-cards.css`, `c-data.css`. Shared markup: `assets/js/fp-ui.js` (header, footer, search, cards, sponsor), `fp-pages.js`, `fp-charts.js`, `fp-portal.js`, `fp-portal2.js`.

---

## 1. What was kept, what was added

**Kept from Concept 1, unchanged:** the ivory canvas, forest green, muted copper, Fraunces plus Figtree, the arch mark and arch decoration, the 24 px card radius, the pill-shaped “Post property” button, the segmented intent tabs, the copper Search button, and the italic-copper emphasis in headlines.

**Added because 33 routes need more than a homepage.** These are marked **New** in `tokens.css`:

| Addition | Why |
|---|---|
| Status colours: success, warning, danger, info, neutral (each with a tint) | Listing, moderation, enquiry, unit and delivery states need words **and** colour. |
| A dark surface (`--c-dark`) for the footer and portal sidebar | Gives the admin and builder areas a clear identity without changing the palette. |
| Four chart series colours | Validated for colour-blind separation (section 9). |
| A single focus ring, spacing, radius and elevation scales, breakpoints | Concept 1 only showed one screen. |

**Refined for accessibility (minor):** small copper text uses `#9A4A20`, not the brand copper `#B4592A`, which is 4.42 : 1 on ivory and fails for small text. The brand copper stays for button fills and display-size text only. Field-label micro text is 11 px, up from 10.5 px.

---

## 2. Colour

### Brand and neutrals

| Token | Value | Role |
|---|---|---|
| `--c-bg` | `#FAF6EE` | Page canvas (ivory) |
| `--c-bg-sunken` | `#F1EADB` | Secondary canvas, segmented-control track |
| `--c-surface` | `#FFFFFF` | Cards, inputs, dialogs |
| `--c-primary` / `-hover` | `#1F4A38` / `#163829` | Identity, selected, primary action in portals |
| `--c-primary-tint` | `#E2ECE5` | Selected fills, soft chips |
| `--c-accent` / `-hover` | `#B4592A` / `#9A4A20` | **The conversion action**; selected highlight. Fill only. |
| `--c-accent-text` | `#9A4A20` | Small copper text |
| `--c-accent-tint` | `#F7E6D8` | Featured badge, AI hint |
| `--c-ink` / `--c-muted` / `--c-subtle` | `#1C2A23` / `#55635A` / `#626F67` | Body, secondary, placeholder text |
| `--c-border` / `-strong` / `-input` | `#E2D9C7` / `#CBBFA6` / `#829086` | Dividers, chip edges, field outlines |

### Status **New**

| Status | Text | Tint | Used for |
|---|---|---|---|
| Success | `#1E6B47` | `#E1F1E7` | Live, approved, available, delivered, active |
| Warning | `#7A4F00` | `#FBEBC8` | Pending, on hold, retrying, invited |
| Danger | `#A62A1B` | `#FBE2DD` | Rejected, failed, errors, destructive actions |
| Info | `#24566F` | `#E0EEF4` | New enquiry, blocked unit |
| Neutral | `#3D4A43` | `#E9E2D0` | Sold, rented, closed, inactive, draft |

### Rules for using copper and green

1. **One copper button per view**, and it is the page's conversion action: Search, Send enquiry, Submit listing, Sign in, Post your property. A second action in the same view is forest or outlined.
2. **Forest is the primary action in the portals** (admin and builder). Copper is not used for portal actions.
3. Copper also marks selection in two small places only: the underline on the current tab or nav link, and the “new” count on enquiries.
4. Status colours are never used for decoration.

### Measured contrast (WCAG 2.1)

Measured from the real token values. Full table with swatches is on the Foundations board.

| Pair | Ratio |
|---|---|
| Ink on ivory | 13.87 |
| Muted on ivory / on white | 5.87 / 6.33 |
| Subtle (placeholder) on white | 5.26 |
| Forest on ivory | 9.30 |
| White on forest (primary button) | 10.02 |
| White on copper (accent button) | 4.77 |
| Copper text `#9A4A20` on ivory | 5.77 |
| Success / warning / danger / info / neutral text on their tints | 5.52 / 6.05 / 5.74 / 6.72 / 7.20 |
| Ivory on dark green (footer, sidebar) | 11.94 |
| Muted ivory on dark green | 7.58 |
| Input border on white (non-text, needs 3 : 1) | 3.34 |

Brand copper `#B4592A` as **small text** on ivory is 4.42 : 1 and is **not allowed**.

---

## 3. Typography

| Role | Face | Size / line height (mobile · tablet · laptop and up) | Use |
|---|---|---|---|
| Display | Fraunces 500, tracking −0.02 em | 30/34 · 46/50 · 58/62 | Hero headline only |
| Heading 1 | Fraunces 500 | 28/33 · 36/42 · 40/46 | Page titles |
| Heading 2 | Fraunces 500 | 23/29 · 28/34 · 30/36 | Section titles |
| Heading 3 | Fraunces 500 | 19/25 · 21/27 · 22/28 | Card group and dialog titles |
| Title | Figtree 700 | 17/22 | Card and panel titles |
| Lead | Figtree 400 | 18/28 | Intro under a page title |
| Body | Figtree 400 | 16/25 | Running text |
| Small | Figtree 400 | 14/20 | Hints, table text |
| Caption | Figtree 400 | 12.5/17 | Smallest sentence-case text |
| Overline | Figtree 700, caps, +0.07 em | 11.5 | Labels above values |
| Price | Figtree 700 20 · Fraunces 600 34 on detail pages | | Prices |

- **Italic copper** (Fraunces 400 italic in `--c-accent`) emphasises one word in a headline. Display size only.
- **Numerals** are lining. Tables and prices use tabular numerals so columns align. Dashboard figures are Figtree 700, not serif.
- **Minimum sizes:** 12.5 px for sentence-case text, **11 px** for uppercase micro-labels and for text inside an advertiser's image.
- **Tamil** falls back to Noto Sans Tamil (loaded only when Tamil text appears). A Tamil reader should review it before launch.
- **₹ glyph** is present in both Fraunces and Figtree.

---

## 4. Space, shape, elevation

| | Values |
|---|---|
| Spacing (4 px base) | 4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96 |
| Radius | 6 tags · 10 small buttons and menu items · 14 buttons and inputs · 18 grouped fields · 24 cards, search card, dialogs · pill |
| Elevation | card (resting), hover (lifted), **float (the hero search card only)**, pop (menus), modal (dialogs, drawers) |
| Motion | 120 ms for hover and press, 200 ms for panels, ease-out. Removed under `prefers-reduced-motion`. |
| Stacking | sticky 40 · header 50 · menu 60 · drawer 80 · dialog 100 · toast 110 |

---

## 5. Layout and breakpoints

| Mode | Width | Gutter | Header | Notes |
|---|---|---|---|---|
| Mobile | < 768 | 16 | 56 | Bottom bar, single column, tables become cards |
| Tablet | 768–1023 | 32 | 64 | Portals use an icon rail; 2 columns |
| Laptop | 1024–1279 | 40 | 72 | Full header, filter rail |
| Desktop | ≥ 1280 | 56 | 72 | Content max 1328 px |

Layouts **reflow**; nothing relies on a fixed width below 1024 px. Pages were checked at 390, 820, 1024, 1280 and 1440 px for horizontal overflow.

---

## 6. Components

### Actions

| Component | Spec |
|---|---|
| **Button** | 48 px high (54 large; 40 small on touch, 36 on desktop portals), 14 px radius, Figtree 700 16. Variants: accent (copper), primary (forest), secondary (outline), ghost, danger, danger outline. States: hover, focus, pressed, disabled, loading (spinner replaces the label, width held). |
| **Pill button** | Only “Post property” in the header. |
| **Icon button** | 44 px circle for close, menu, and arrows. |
| **Link** | Forest, 1.5 px underline in a stone tint that darkens on hover; “link with arrow” moves 3 px right on hover. |

### Forms

| Component | Spec |
|---|---|
| **Field** | Label above (14 px 600), control, hint or error below. Required fields show a red asterisk and `aria-required`; optional ones say “(optional)”. |
| **Input / select / textarea** | 52 px min height, 14 px radius, 1.5 px `--c-border-input` outline. Hover darkens the outline. Focus: forest border plus a 2 px outline. Error: 2 px red border, icon and message below. Disabled and read-only use a parchment fill. |
| **Checkbox, radio, switch** | 22 px boxes, 48 × 28 switch, forest when on. |
| **Chip** | 40 px pill (34 on laptop and up when small). Selected: tint fill, forest border **and a check**. |
| **Segmented control** | Parchment track, forest selected pill. Used for Buy / Rent / New projects, All / Buy / Rent, enquiry type, date presets. |
| **Tabs** | 52 px high, copper 3 px underline on the current tab, optional count (forest when current, copper for “new”). |
| **Search card** | One component in two layouts: **wide** (one joined bar, ≥ 1024) and **stacked** (location + Search, then three selects). Fields in fixed order: Locality, Property type, Bedrooms (single value), Max budget. |

### Status and content

| Component | Spec |
|---|---|
| **Badge** | 26 px pill, 12.5 px 700. Status badges have a dot **and** a word. Listing labels: *For sale / For rent* (outlined), *Featured* (copper tint), *Prime* (ink), *Budget* (forest tint). |
| **Property card** | 24 px radius, 4 : 3 image, badges top-left, save heart 44 px top-right, price, two-line title, locality, up to three specs, Compare toggle, property type. Hover lifts and zooms the image 4 %; keyboard focus rings the whole card. Optional details that are missing are omitted, never shown as blanks. |
| **Project card** | 16 : 10 image, status and featured badges, developer name in copper caps, project name in Fraunces, price range, BHK tags. |
| **Locality tile** | Gradient tile with the arch icon; five tints cycle. |
| **Developer card** | Monogram, name, project count, short text, two project thumbnails. |
| **Stat tile** | Label, optional icon disc, value (Figtree 700 30), optional note. “Needs attention” tint for waiting-for-approval. |
| **Spec tile** | Icon disc, uppercase label, value. |
| **Gallery** | 16 : 10 main image with arrows and counter, six thumbnails below; on phones a full-bleed 4 : 3 swipe with dots. |
| **Compare bar** | Floating card with three slots, count, Clear all, Compare now (disabled below two). Sits above the bottom bar on phones. |
| **Table** | Parchment header row, 14.5 px text, right-aligned tabular numbers. Below 768 px rows become labelled cards. |
| **Listing row** | Thumbnail, title, price and locality, type chip, status badge, actions. |
| **Enquiry card** | Name and contact, status badge, “About {property}” link, quoted message, status buttons. |
| **Wizard stepper** | Numbered steps with done, current and error states; a five-segment progress bar on phones. |
| **Upload** | Dashed drop zone, thumbnails with Cover tag, per-file progress and error states. |
| **Sortable list** | Grip, summary row, expandable body, plus Move up and Move down buttons as the keyboard alternative. |

### Feedback and overlays

| Component | Spec |
|---|---|
| **Alert** | Icon, bold title, text, optional action. Five kinds. Errors use `role="alert"`. |
| **Toast** | Dark ink, 6 s, pauses on hover and focus, bottom centre (above the bottom bar on phones). |
| **Dialog** | 480 px, 24 px radius. Icon disc, title naming the thing, consequence, two buttons. Used for confirmations only. |
| **Bottom sheet** | Phones: filters and the enquiry form. Grabber, title, close, sticky actions. |
| **Side drawer** | Portals: add and edit forms. Header, scrolling body, sticky footer. |
| **Menu, list box, popover, tooltip** | White card, 18 px radius, pop shadow. |
| **Skeleton** | Matches the final layout; shimmer stops under reduced motion. |
| **Empty state** | Arch illustration, a title that says what is missing, one sentence, one next step. |

### Navigation (details in `navigation-and-information-architecture.md`)

Public header, avatar menu, mobile drawer, bottom bar, breadcrumbs, portal sidebar (full, rail, drawer), tabs.

### Sponsored banner containers (details in `homepage-ad-variations.md`)

A neutral frame, the “Sponsored” label, “About this ad”, an optional pager, and the advertiser's image. Strip, panel and in-results formats.

---

## 7. Imagery

There is no photography yet. Property and project images are **original illustrated placeholders** in Grove colours (apartment, low-rise, twin towers, villa, house, plot, commercial, living room, bedroom, kitchen, balcony view, floor plan). They crop with `object-fit: cover`. Real photography will change contrast and mood; the layouts do not depend on the illustrations.

---

## 8. Accessibility rules built in

- **Focus:** one visible ring everywhere (3 px forest, 2 px offset; 2 px inside fields). It is an outline, so it survives high-contrast mode. On dark surfaces it is light copper.
- **Targets:** buttons, chips and menu items are at least 40 to 44 px on touch; the only smaller controls are 36 px dense buttons on desktop portals.
- **Colour is never the only signal:** selection adds a check or fill; status adds a word; errors add an icon and text; charts add direct labels, a legend and a table view.
- **Forms:** labels are always visible; errors are linked with `aria-describedby`; long forms add a summary and move focus to the first error.
- **Motion:** respects `prefers-reduced-motion`; nothing auto-rotates by default.
- **Text:** nothing below 11 px; body 16 px; line length capped near 68 characters in prose.
- **Semantics to implement:** landmarks (header, nav, main, footer), a skip link, `aria-current="page"` on the current link, `aria-pressed` on toggles, `role="tablist"` for segmented controls, `role="alertdialog"` for confirmations with focus trap and return.

---

## 9. Charts

Charts follow the dataviz method: 2 px lines, ringed 8 px end dots, hairline grid, 4 px rounded bar ends, text in ink (never in series colour), a legend for two or more series, a crosshair with **one tooltip listing every series**, keyboard focus on the chart (arrow keys move the crosshair), and a **table view** alternative.

**Series colours** are fixed in order and pinned to the entity they mean, so “Leads” is the same colour on every screen:

| Slot | Colour | Entity |
|---|---|---|
| 1 | `#1F7A55` green | Shortlists, views |
| 2 | `#B7791F` ochre | Leads |
| 3 | `#2F7FB0` blue | Enquiries |
| 4 | `#B4592A` copper | Visitors |
| Other | `#7A857E` | Folded tail |

**Validation (run with the dataviz validator against a white surface):** lightness band pass, chroma floor pass, worst adjacent colour-blind-simulated ΔE **8.6** (target ≥ 8), worst normal-vision ΔE **19.6** (floor 15), all four ≥ 3 : 1 on white. The first draft palette failed four of these and was replaced; the final values above pass.

**Form changes from Phase 1, for confirmation:** “Leads by source” was a pie chart; it is a **single stacked bar with a legend table**, which reads better for four parts. Single-value-per-category data uses horizontal bars. Both are presentation only.

---

## 10. How the pages are built

Plain HTML, CSS and a small script; no framework. Pages use custom tags (`<fp-header>`, `<fp-search>`, `<fp-cards>`, `<fp-sponsor>`, `<fp-portal>`…) that are expanded from one definition each, so a component cannot differ between screens. States are selected with the URL hash (for example `search.html#empty`), so any state can be opened, shared and rendered. This is a design artifact; production components will be written in Next.js from these specifications.
