# ADR-182 · Sponsor hero styles: the data (Showcase and Cinematic)

- Status: Accepted (owner decisions of 23 Nov 2026 on the sponsor ads redesign; the new words await the owner's approval).
- Date: 2026-11-25
- Related: ADR-045 and ADR-105 (the stored sponsors and their save), ADR-038 (rotation), ADR-179 (builder spotlight fields)
- Class: C2. No migration (the sponsors live in the `site_settings.sponsors` JSON), no dependency, no environment change.

## Context

The owner chose two designs for the hero ad under the search bar: a **Showcase** card (A: photo, developer, project, locality, homes, price, possession, RERA, two buttons) and a **Cinematic** banner (B: a tall photo with a headline, one line and a button laid on it). The admin chooses A or B for the whole site; the words and the photo are typed and uploaded in the Sponsors form; and for each sponsor the admin chooses whether a click goes to one of our project pages or to another site. The Split hero layout keeps today's picture panel. Sponsors saved before this, with pictures only, stay saved but are not shown in A or B until the admin completes them.

This change is the data only: what is stored, what the save accepts and checks, and what the public side reads. Nothing changes for visitors or on the admin screen yet; the parts (PR 3) and the admin screen with the live hero (PR 4) follow.

## Decision

- **The style** is a new optional `style` in the `sponsors` setting, `showcase` or `cinematic`. Read tolerantly (`toSponsorStyle`): anything else, or nothing, is the Showcase. The save writes it; a save that sends no style keeps the stored one, so a save from today's screen never resets the admin's choice.
- **New optional fields on a sponsor**, all stored in the same JSON: `brand` (the developer or brand name shown, up to 60 characters), `photo` (one landscape picture both styles crop from), `link` (`url` or `project`), `projectSlug`, `showcase` (`project`, `locality`, `homes`, `price` up to 60 or 40 characters; optional `size`, `possession`, `rera`) and `cinematic` (`headline` up to 40, `button` up to 24; optional `eyebrow` up to 30 and `line` up to 90). Every line is optional when saved, so the admin can fill one style before the other; a blank box is no value.
- **The photo** is uploaded like the banner pictures, to the sponsor's own folder of `site-assets`, and read back and measured by the server: JPG, PNG or WEBP, at most 480 KB (under the bucket's 500 KB cap), at least 1600 × 900, between 4:3 and 21:9 (`photoProblem`). A refusal reuses the four picture messages, with the photo's own limits. A replaced or removed photo is taken out of the bucket after the save, as the banner pictures are.
- **A project link** stores the slug instead of an address. The save refuses a slug that is not a live project (approved and published) with a new message. The public side builds `/projects/<slug>` (the projects feature's own address; a test holds the two together) and marks the ad as not external; an address link is marked external, as every ad was before. A sponsor's address is needed only for an address link.
- **What the public side reads:** `toSponsorAds` takes the new fields, builds the photo's address from our own bucket, and gives a style's words only when the ones it needs are all there. `readyFor(ad, style)` says whether an ad has the photo, the brand and the style's words; `selectStyled(ads, style)` gives the active hero ads that are ready, in order (picture-only ads are left out). `getSponsorStyle()` reads the style.
- **The editor's read side** (`sponsorEditViewsOf`) reads the new fields too, so a sponsor that links to a project (and has no address) is not dropped from the admin screen.

## Words (new, awaiting the owner's approval)

`validation.sponsorProjectMissing`: "Choose a project that buyers can see on the site."

## Consequences

- Tests: the input rules (link and slug, style, blank boxes, photo folder), the photo rule, the save (photo measured, refused photos named, project links, the style kept or written, the replaced photo removed), the public reader (project address, external marking, partial words, style) and the readiness rules; the integration test also checks the stored style and the refusal of a hidden project.
- Today's admin screen does not send the new fields yet, so saving from it keeps a sponsor's pictures, words and address but drops a brand, a photo, a project link or style words; none can exist before the next admin change, which sends them.
- Rollback: remove the fields from the code; the stored JSON keeps them harmlessly (the readers ignore what they do not know).
