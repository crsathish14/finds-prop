# ADR-038 · Sponsored banners rotate as a carousel

- Status: Accepted
- Date: 2026-10-31
- Related: ADR-004, plan 04 section 5.2, UX `homepage-ad-variations.md`, R-DS-05, R-DS-06

## Context

The approved UX and plan 04 section 5.2 showed several sponsored banners with a manual pager and said "no autoplay, no timers". On 31 Oct 2026 the owner asked for a carousel that rotates by itself, with the design unchanged, and no Play/Pause button.

## Decision

- **Library:** Embla Carousel (`embla-carousel-react` and `embla-carousel-autoplay`, both 8.6.0, MIT, no install scripts). It has no styles of its own, so the approved frame, label, "About this ad" and pager look the same; it is also the library plan 04 already names for the property gallery. Swiper (3.8 MB, its own styles) and keen-slider (no release since 2023) were not chosen.
- **Behaviour:** with two or more qualifying banners they slide sideways in turn, **2 seconds** each (`SPONSOR_ROTATION_MS`), looping. The previous and next buttons and a swipe still move them by hand. One banner stays still with no pager.
- **Unchanged:** selection and fallback rules (`src/lib/sponsors.ts`), fixed aspect ratios, no gap when nothing qualifies, removal of a picture that fails to load, the Sponsored label outside the picture.
- **Accessibility safeguards, because there is no Play/Pause button:** rotation waits while the pointer is over the banner area and while focus is on anything in it (the buttons included); it never starts for a reader who prefers reduced motion; only the banner on show can be reached by Tab or a screen reader (the others are `inert`); the new position is announced only when the reader moves it by hand, never on each automatic turn. All pictures load straight away (low priority except the first), so a banner is never empty when it slides in.

## Consequences and risks

- **WCAG 2.2.2 (Pause, Stop, Hide)** asks for a way to pause anything that moves for more than 5 seconds, normally a visible control. The owner chose not to add one. The safeguards above reduce the effect (pause on hover and focus, no motion on request) but do not fully meet the criterion for a visitor who neither hovers nor focuses and cannot or does not set reduced motion. Revisit if an accessibility review or a legal requirement asks for the control; it is a small addition next to the pager.
- **A 2-second turn is fast.** Advertisers get about 2 seconds of each banner on screen, and it is hard to read a full message in that time. The time is one constant to change.
- **Source of the design:** the approved UX documents (`docs/ux/final-ux`, a read-only copy) and the plan still say "no autoplay". Per R-DS-05 the UX package at its source and this copy are to be updated together, which is for the owner to do; this ADR is the record until then.
