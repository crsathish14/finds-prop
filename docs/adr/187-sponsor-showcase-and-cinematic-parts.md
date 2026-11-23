# ADR-187 · Sponsor hero styles: the Showcase card, the Cinematic banner and their frame

- Status: Accepted (owner decisions of 23 Nov 2026 on the sponsor ads redesign; the designs were approved on the concepts page, the new words await the owner's approval).
- Date: 2026-11-25
- Related: ADR-182 (the data these parts draw), ADR-038 (rotation), ADR-045 (the sponsored banner frame)
- Class: C2 (a deviation from the approved UX: the hero ad was a picture strip). No migration, no dependency.

## Context

ADR-182 stored what the admin types for the two hero ad styles. This change adds the parts that draw them, in the Design Lab only: the live hero and the admin's choice come in the next change.

## Decision

- **`SponsorShowcaseCard`** (domain, concept A): the photo beside the developer (with its initials), the project as a heading, the locality, chips for the homes, size and possession, the price, a "RERA registered" badge when a RERA number was typed, and two buttons: "View project" and, for one of our projects only, "Get price list", which opens the project page at its enquiry form (`#enquiry`). The photo is on top on phones and in the left column from 768 px.
- **`SponsorCinematicBanner`** (domain, concept B): a tall photo (300 px from 768 px, 400 px below) under a dark shade that keeps the words readable on any photo, the brand, an optional eyebrow, the headline as a heading, an optional line, one button with the admin's words, an "Up next" box naming the following sponsor (from 768 px), and a gold line drawn once around the frame.
- **`SponsorStyledFrame`** (layout, client): the platform's frame for either style, as the picture strip had it: "Sponsored", "About this ad", the previous and next buttons with "2 / 3", and new thin **progress bars**. The bars are the clock: when the bar of the ad on show is full (SPONSOR_ROTATION_MS, 5 seconds), the frame moves on, so the bars and the ads never drift apart. All ads sit in one grid cell, so the frame keeps the tallest ad's height and nothing below moves; they cross-fade. Only the ad on show can be reached (the others are inert); a move by hand is announced, an automatic one is not.
- **Motion** lives in `src/styles/sponsor-ads.css`: the slow photo drift, the bars, the gold line, all transform, opacity or stroke only. Pointer over the ads or focus inside them pauses the bar and the drift. With reduced motion nothing moves and the ads never turn by themselves.
- **Links:** one of our projects opens in the same tab; another site opens in a new tab with `rel="sponsored noopener"` and the new-tab notice read by screen readers.

## Words (new, awaiting the owner's approval)

`sponsor.viewProject` "View project", `sponsor.priceList` "Get price list", `sponsor.rera` "RERA registered", `sponsor.upNext` "Up next", `sponsor.adPosition` "Ad {current} of {total}".

## Consequences

- Design Lab "Ads" board: three new entries (Showcase card, Cinematic banner, Styled hero ads), with sample photos drawn as SVG in `public/design-lab/sponsor-photos` and sample ads `STYLED_AD_A` to `C` in `src/lib/sponsors.fixtures.ts`. Tests in `sponsor-styled.test.tsx`.
- Nothing changes for visitors yet.
- Rollback: delete the three parts, the stylesheet and its import, the Lab entries, the samples and the words.
