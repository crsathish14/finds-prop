# ADR-176 · Conversational homepage hero as a third admin layout

- Status: Accepted (the owner approved the plan on 23 Nov 2026 with the proposed defaults). The admin label and hint for the new choice, "Ask in your own words", the sample requests and "Try" are the owner's approved wording for production.
- Date: 2026-11-23
- Amends: ADR-099 and ADR-102 (the Hero page), ADR-045 (sponsored banners: which format each hero layout needs), FR-ADM-11 (hero layout choice), FR-PUB-02 (homepage arrangements)
- Related: ADR-150 (one home search bar), the hero lab (PR #342)
- Class: C2 (a layout that is not in the approved UX). No migration, no dependency.

## Context

PR #342 added a preview-only hero lab with a "Conversational" layout (C): a centred joined search pill with a running teal light, a typed hint with sample requests, "Try" chips, three trust lines and the sponsored strip rising in last. The owner tested it on the Vercel preview and wants the super admin to be able to choose it, so that every visitor sees it, production included.

## Decision

1. **A third value, `conversational`, of the hero layout setting.** The setting lives in the `hero` JSON of `site_settings`; the only validation is zod (`src/features/site/schemas.ts`), and the table has no constraint on the layout. **No migration.** Existing rows stay valid, the default stays `search_desk`, and an unknown stored value is still ignored with the default used (as today).
2. **A shared component, `ConversationalHero`** (`src/components/domain/conversational-hero.tsx`), takes the words, the search bar and the strip from the page. `ConversationalLive` (`src/features/hero-lab/conversational-live.tsx`) builds the joined search (the AI search while FLAG_AI_SEARCH is on, the keyword search otherwise, exactly as every hero), the typed sample requests from the curated localities, the three chips and the trust lines, and wraps it in `PauseWhenHidden`. The live page and the hero lab's C render the same `ConversationalLive`, so they cannot drift. `HomeHero` (A and B) is not changed.
3. **Sponsor rules.** Conversational uses the strip format, like Search Desk (`formatFor`). `resolveHero` keeps `conversational` and never falls back to Search Desk (only Split falls back, because it needs a panel). A panel-only sponsor shows no ad in this layout, and the admin's coverage warning ("no sponsor can be shown", "N sponsors don't have the format") already says so. No strip ad means no ad and no gap.
4. **Admin.** The Hero page's layout choice has a third card (a small drawing with a pill-shaped bar and chips), the preview draws the pill-shaped search, and the sponsor preview and coverage know the new layout. The note above the cards ("All layouts use the same text, search and header") replaces "Both layouts".
5. **The admin's eyebrow is not shown** in Conversational; the prompt pill ("Ask in your own words") leads instead. The eyebrow stays a Split-only line.
6. **Motion** stays in `src/styles/hero-lab.css`, which `globals.css` already loads: transform and opacity only; with `prefers-reduced-motion` everything is shown in place and the running light stops; the loops pause while the tab is hidden (`PauseWhenHidden`, a small client island, sets `data-hl-paused`; the hero lab's switch uses the same hook).
7. **D (Layered) stays a lab-only experiment**: it needs a pointer and scroll parallax island and nobody has chosen it. Adding it later is the same pattern (a value, a card, a rule in `formatFor`).
8. **The hero lab keeps working** (`?layout=a|b|c|d` where the Design Lab is on). When the saved layout is `conversational`, the lab's live layout is C.

## Consequences

- Visitors on a site set to Conversational get the running light (one CSS animation on the search border) on the homepage; it is CSS only, paused in a background tab and absent under reduced motion. The homepage stays part of the static shell: the hero reads no cookie.
- The Design Lab has a "Conversational hero" entry (R-DS-03), a Conversational specimen in the as-built hero board, the admin layout board and the sponsor preview board. Their screenshot baselines come from CI.
- Existing homepage baselines do not move (the default layout is unchanged).

## Alternatives not taken

- **Put C into `HomeHero` as a third `layout`.** It has a different structure (prompt pill, trust lines under the bar, strip card) and would double the component. A sibling component reads better.
- **Give the hero its own admin setting for the eyebrow.** Not asked for.
- **Offer D too.** See point 7.
