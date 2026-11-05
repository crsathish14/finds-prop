# ADR-045 · Sponsored banners on the pages (S4-T07)

- Status: Accepted
- Date: 2026-11-05
- Related: FR-PUB-01 to FR-PUB-04, ADR-038 (the rotating carousel), ADR-039 (the hero), ADR-042 (results), `docs/ux/final-ux/screens/home-a.html`, `home-b.html`, `home-none.html`, `search.html`
- Plan approved by the owner on 5 Nov 2026 ("All recommended"), together with compare (ADR-044), in one change.

## Context

The banner container, its selection and fitting rules (`src/lib/sponsors.ts`) and the rotating frame were built and approved earlier (S2, ADR-038), and the Design Lab shows them with fixtures. What was missing was the data (there is no sponsor table; the administrator's editor is Stage 8, ADD-11) and the places on the pages.

## Decision

- **The data is the site content's `sponsors` key** (`site_settings`, which visitors can already read and only the super administrator can write): `{ ads: [...] }`, empty by default. No migration. The Stage 8 editor will write the same key. Nothing stored means no banner anywhere and no gap (FR-PUB-03): **there is no visible change until banners are added.**
- **Each banner is checked on its own** (`toSponsorAds`), so one unusable banner never takes the others down: an id (the first of two with the same id wins), an **https** destination with no credentials, a description (it is also the link's name), at least one placement (`hero`, `results`), and for each of the two formats (`strip`, `panel`) a desktop and a compact picture. A banner that does not fit is dropped and counted in the log, never named. Whether a banner qualifies for a slot (active, the format, the shape) stays the selection's job (`selectSponsors`), as before.
- **A picture is a path, never an address.** The administrator's pictures are files in the public `site-assets` bucket (500 KB at most, webp, jpeg or png, never SVG, DEC-15); the setting stores the path and the size, and the address is built on the server from our own storage (`lib/storage-url.ts`, moved from the home feature). A stored value can therefore not point a visitor's browser at another site's picture. A path with `..` or `//`, an extension that is not an allowed image type, or a size of nothing is refused.
- **Where they appear** (the three placements of FR-PUB-04 that the UX draws; the between-sections slot is not drawn on the homepage, so it is not built):
  - **Homepage, Search Desk:** one strip directly under the search card, as wide as the card.
  - **Homepage, Split:** the panel on the right of the headline and the stacked card (`HomeHero layout="split"`: the eyebrow from the site content's hero setting, from 768 px; the three trust lines "Approved listings only", "Enquire directly" and "Compare up to 3 homes", from 768 px; the arches at the right only). The Split layout needs a panel banner: without one `resolveHero` makes the page Search Desk with nothing in the banner position, as the UX says.
  - **Results:** one strip across the whole row after the sixth home, only when there are at least six and a banner qualifies (`RESULTS_SPONSOR_AFTER`), so no empty row is left. "Show more" still moves focus to the first new home: the focus lookup counts cards, not children, because a banner sits among them.
- **No new Design Lab board:** two entries on the Ads board, "Home hero, as built" (the real hero in Search Desk with the strip, Split with the panel, and Split falling back) and "Banner in the results". The existing hero previews (24 pictures) are not changed.
- **Not built:** the administrator's editor and the sponsor table (Stage 8, ADD-11), the between-sections slot, click or view counting.

## Words (new, for the owner's approval; `home.hero.trust` in `en.json`)

The UX's own words for the Split layout's trust lines: "Approved listings only", "Enquire directly", "Compare up to 3 homes". The eyebrow is content (the site setting), not a message.

## Consequences

- Not tried against a real banner: there is none to read and the hosted dev database needs secrets. The mapping is tested with sample settings, and the three placements are drawn with the Design Lab's sample banners.
- The shape of the stored value is now a contract the Stage 8 editor must write; `sponsors.ts` is its definition.
