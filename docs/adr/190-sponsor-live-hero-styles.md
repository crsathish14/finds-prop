# ADR-190 · Sponsor hero styles: live on the home page

- Status: Accepted (owner decisions of 23 Nov 2026 on the sponsor ads redesign; the owner said "Start" to this change on 24 Nov 2026 after being told the ad space stays empty until a sponsor is completed; the new words were approved by the owner on 24 Nov 2026 ("approved")).
- Date: 2026-11-25
- Related: ADR-182 (the data), ADR-187 (the parts), ADR-189 (the admin's choice and fields), ADR-045 and ADR-038 (the banner area)
- Class: C2 (a deviation from the approved UX: the hero ad was a picture strip). No migration, no dependency.

## Context

The admin can now choose the hero ad style and fill each sponsor's details (ADR-189), but the home page still showed the picture strip under the search bar. The owner decided that picture-only sponsors are hidden until completed, and that the Split layout keeps its picture panel.

## Decision

- **Under the search bar** (Search Desk and Conversational), the home page shows `SponsorStyledFrame` with the ads ready for the chosen style (`selectStyled`: active, meant for the hero, with the photo, the brand and the style's words), in the admin's order. The style is read from the cached site content (`getSponsorStyle`). With none ready there is no ad, no label and no gap, as before.
- **Split** keeps the picture panel (`SponsorSlot`), and its fallback to Search Desk without a banner when no sponsor has a panel.
- The Conversational hero no longer draws its white box round the ad when the ad brings its own frame (`sponsorBare`).
- **The admin's Hero page preview** draws a small picture of the first ready ad in the chosen style (the photo beside the project and price for the Showcase; the headline on the photo for the Cinematic banner) for Search Desk and Conversational, and says "No ad ready" when sponsors exist but none is complete. The warning under the layout cards counts the sponsors not ready for the style and says what to fill in. Split's preview and warning are unchanged.
- The results page keeps its picture strip until the Featured project card replaces it (sponsor ads plan, PR 6). The Design Lab's hero lab keeps the picture strip in its comparisons.

## Words (new, approved by the owner on 24 Nov 2026)

`admin.siteContent.sponsors.preview.noneReady` "No ad ready"; `layout.noneTextStyle`, `layout.someTitleStyle`, `layout.someTextStyle` (the warnings about a style's details).

## Consequences

- When this is merged, the home page shows no ad under the search bar until at least one sponsor has its photo, brand and the chosen style's words: the owner was told and chose to start.
- Tests: the home page (styled ads for Search Desk and Conversational, picture-only ads left out, no box, Split unchanged), the preview logic (the first ready ad, the count of missing ones, "No ad ready") and the Hero page warning.
- Rollback: revert this change; the stored data and the admin's screen keep working (ADR-182, ADR-189).
