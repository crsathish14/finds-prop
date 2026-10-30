# Homepage advertising variations

Two interchangeable homepage layouts, plus the no-sponsor fallback. All three share one header, one search component, one headline, one palette and one set of buttons: **they differ in layout, not in brand**. Numbers below were **measured in Chrome** from the rendered pages (not typed), at the viewport named.

| Open the prototype | Rendered images (desktop · tablet · mobile) |
|---|---|
| [Variation A · Search Desk](screens/home-a.html) | [D](renders/home-a--default--d.webp) · [T](renders/home-a--default--t.webp) · [M](renders/home-a--default--m.webp) |
| [Variation B · Split](screens/home-b.html) | [D](renders/home-b--default--d.webp) · [T](renders/home-b--default--t.webp) · [M](renders/home-b--default--m.webp) |
| [No-sponsor fallback](screens/home-none.html) | [D](renders/home-none--default--d.webp) · [T](renders/home-none--default--t.webp) · [M](renders/home-none--default--m.webp) |
| Specification overlay (dimensions, fold lines) | add `#spec` to any of the three: [A](screens/home-a.html#spec) · [B](screens/home-b.html#spec) · [fallback](screens/home-none.html#spec) |
| The container itself | [Sponsored banner container board](screens/ds-ads.html) |

---

## 1. What is shared (identical in A, B and the fallback)

| | |
|---|---|
| **Header** | Concept 1's ivory header (logo, Buy, Rent, Projects, ✦ AI Search, Contact, Post property pill, Sign in). The recommended preview used a dark-green header; both layouts here use Concept 1's, as specified. |
| **Hero copy** | One CMS-driven set: headline, subtitle, optional eyebrow. “Find the place that fits your life in *Chennai*.” and “Shortlist, compare and enquire directly.” The layouts never change the words, which is what makes them interchangeable. |
| **Search card** | One component: Buy / Rent / New projects, Locality, Property type, Bedrooms, Max budget, copper Search, “Describe it in words”, Popular and Quick-pick chips. Same labels, order and behaviour. |
| **Palette, type, buttons** | Grove. Fraunces for the headline, Figtree for the interface. The copper Search button is the only copper fill in the hero. |
| **Below the hero** | Explore by locality · Featured homes · New launches from developers · Browse by what matters · Newest on Find Prop · Why Find Prop · Post-property banner · footer. |

The only things that differ: **how the search card is arranged** (one joined bar vs stacked) and **where the sponsored image sits**.

---

## 2. Variation A · Search Desk

Concept 1 as approved: centred headline, centred search card, and the sponsored strip **directly under the search card**.

**Desktop, 1440 × 900 (measured)**

| Element | Position and size |
|---|---|
| Headline | Fraunces 58 / 62, two lines, centred, y 88 to 212 |
| Search card | **970 × 210**, x 235 to 1205, y 274 to 484, 24 px radius, the only element with a shadow |
| “Sponsored” row | 970 × 24, y 496 to 520 (label left, “About this ad” and pager right) |
| **Ad slot (frame)** | **970 × 90**, y 525 to 615 |
| Next section | “Explore by locality” starts y 623, tiles peek at y 757 |

- **Above the fold:** the whole strip ends at y 615, so it is fully visible on a 1366 × 768 laptop (fold about 630) and on 1440 × 900 (about 780). Search stays the largest, highest and only shadowed object.
- **Why attached:** the strip is the same width as the search card and 12 px below it, so it reads as part of the search block, not as page content.
- **Laptop 1024:** the strip scales to 944 × 88 (ends y 613).
- **Tablet 820:** search card full width (two rows, 756 × 310); the strip switches to the **compact creative** at 560 × 175 (3.2 : 1), centred, ending y 768.
- **Mobile 390:** headline, subtitle, search card (358 × 316), then the strip at **358 × 112** (3.2 : 1), y 540 to 652. The search card, the Search button and the **whole ad are above a typical 660 px phone fold**; on a small phone (about 560) the ad starts just above the fold.

| Pros | Cons |
|---|---|
| Search is unmistakably the main job | The slot is small: about 7 % of the first screen |
| Familiar, calm, quick to scan | Advertisers who want impact get a strip, not a statement |
| The ad cannot weaken search; there is no competing column | A strip is a hard format for creative teams (970 × 90) |
| Very cheap to fall back to: remove the strip and nothing else moves | |
| Same structure on every screen size | |

---

## 3. Variation B · Split search and ad

The recommended preview's composition, in the Grove system: **search on the left, a larger sponsored image on the right**.

**Desktop, 1440 × 900 (measured)**

| Element | Position and size |
|---|---|
| Eyebrow pill | Optional CMS text, above the headline |
| Headline | Fraunces about 54 / 58, left aligned, two lines |
| Left column | 732 wide |
| Search card | **732 × 266**, y 335 to 601: Buy / Rent / New projects tabs, then Locality with Search, then Type, Bedrooms, Budget, then the chips |
| Trust row | Approved listings only · Enquire directly · Compare up to 3 homes |
| Right column | 540 wide, 56 px gutter |
| **Ad slot (frame)** | **540 × 510** including an 8 px neutral border; the advertiser's image is shown at **524 × 494**; y 146 to 656 |
| “Sponsored” row | 540 × 24, y 116 to 140, above the frame |

- **Level with search:** the panel starts level with the eyebrow and ends below the search card, so neither reads as “above” the other. Search keeps the left, first-read column.
- **Fold:** the frame's bottom edge is about 26 px below a 1366 × 768 fold (and fully above a 1440 × 900 fold), but a banner's button is normally inside the image, well above that line.
- **Laptop 1024:** columns become 514 and 389 (the frame 389 × 367), search stays at 514 wide.
- **Tablet 820 and mobile 390:** stacked. Headline, search card, then the panel as the **compact 2 : 1 creative**: 756 × 378 on tablet and **358 × 179 on mobile** (y 548 to 727). On a phone the search card and Search button are above the fold and the top half of the ad is visible below them, which invites a scroll.

| Pros | Cons |
|---|---|
| About 3 times the area of A's strip: room for a real message | Search is a column, not the whole stage |
| Advertiser's image can be a poster, not a leaderboard | An unsold panel leaves a hole, so it relies on the fallback |
| Ad and search are visible together on desktop | On phones it is only a taller strip, so the gain is desktop-only |
| Feels premium, closest to the preview | Needs two creative sizes of a more unusual shape |

---

## 4. No-sponsor fallback

**The approved fallback is Concept 1's normal search-first layout (Variation A) with nothing in the banner position.**

- **Nothing is rendered**: no empty frame, no “Sponsored” label on its own, no “Your ad here”, no broken image, no skeleton.
- **No gap**: measured at 1440, the next section starts at y 508 (with A's strip it starts at y 623); on mobile at y 520 (A: 660). The page simply continues, and the search card stays centred and dominant.
- **Balanced**: Popular and Quick-pick chips are already inside the search card, so the card keeps its full height; the “Explore by locality” tiles come into the first screen (y 642, against 757 with the strip), which makes the page feel complete rather than missing something.
- **When it applies** (design rules; the campaign logic itself is out of scope):
  - no sponsor is booked;
  - the booked creative has no image for the live layout's format;
  - the image fails to load or fails the ratio check: the slot is removed and the page behaves as the fallback;
  - the visitor's browser blocks the image.
- **Variation B has no separate fallback**: if B is live and no sponsor is available, the page renders the A layout without a banner (the hero component renders either arrangement from the same content).

---

## 5. The sponsored banner container

Full anatomy, sizes and rules are on the [container board](screens/ds-ads.html). In short:

| | |
|---|---|
| **Content** | A **finished banner image** supplied by the advertiser, plus alt text and a destination. Not assembled from fields. |
| **Platform owns** | The “Sponsored” label (outside the image), “About this ad”, the optional pager, the neutral frame, spacing, position, link behaviour (new tab, `rel="sponsored noopener"`). |
| **Advertiser owns** | Everything inside the image. |
| **Formats** | Strip 970 × 90 and compact 320 × 100 (A); panel 524 × 494 and compact 640 × 320 (B). Supply at 2×. A campaign needs the pair for the live layout. |
| **Fitting** | Never stretched. Within about 8 % of the slot's ratio: fills the frame. Within about 30 %: shown whole on a neutral ground. Further: rejected when supplied. |
| **Reserved space** | The slot has a fixed aspect ratio so the page does not jump when the image loads. |
| **Several ads** | The container accepts a list of any length with a manual pager. Whether they rotate, in what order and for how long is a **campaign decision, not assumed**. |
| **Different budgets, different placements** | Hero strip, hero panel, in-results banner and between-sections banner are separate slots. Which a budget buys is out of scope. |
| **Not organic** | Labelled, in a neutral frame, never styled like a property card, never between filters and the first result, never beside an enquiry form. Copper “Featured” badges belong to listings only. |
| **Sample content** | All banners here are **fictional placeholders** with generic text. They contain no real advertiser, price, regulatory number or statistic. The dashed “Sample ad” tag is removed in production. |

States designed for each layout: default · three ads with pager · near-miss image (letterboxed) · “About this ad” open · specification overlay.

---

## 6. Switching layouts

The layout is a setting, not a rebuild. A *proposed* “Hero layout” control in the admin Hero editor chooses Search Desk or Split (see [admin-cms](screens/admin-cms.html#hero)). Switching changes only the arrangement; copy, search behaviour, colours and header stay identical. A campaign is tied to the format of the layout that is live; if the live layout needs a format the campaign did not supply, the page shows the fallback.

## 7. Recommendation, briefly

Both are production-ready designs. **A** is the safer default: search is unmistakable and it falls back with no change. **B** gives advertisers about three times the space on desktop and is the one to use when a sponsor is booked and wants impact. Because they share everything but the arrangement, the product can start with A, switch to B per campaign, and fall back to A without a visual seam. Validate with a first-click test (what can you do here, what is the large image?) before committing to B as the default.

## 8. Not decided here (see `design-handoff.md`)

Whether banners rotate and how; image weight and file types; who approves creatives and the legal wording of “About this ad”; whether advertisers must show a registration number inside the image; alt-text ownership; reporting; booking and billing; whether the hero layout is a CMS setting at all.
