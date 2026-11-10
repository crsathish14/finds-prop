import type { LabEntry } from "../types";
import {
  HeroSponsorsPageDemo,
  SponsorHeroPreviewDemo,
  SponsorsManagerDemo,
} from "./sponsor-manager-demos";
import { SponsorFormDemo, SponsorSlotDemo } from "./sponsors-demos";

/**
 * What the admin uses to manage the sponsored banners (S7-T11, FR-ADM-11): the picture slot with every state a chosen
 * file can end in, the Add and Edit sponsor form with its four slots, the list of sponsors with its order arrows, the
 * hero preview with the banner in it, and the whole Hero page with both. It mirrors the admin Hero and sponsors screen.
 * The first two were built in part B1 and the other three in part B2; a board of their own for B2 would have added a
 * thirteenth link to the row of boards and made every board's picture taller at 390 px (ADR-109).
 */
export const SPONSORS: LabEntry[] = [
  {
    id: "sponsor-image-slot",
    name: "Sponsor image slot",
    description:
      "One of the four picture slots of a sponsor (strip or panel, desktop or phone): its name and the size it is shown at, a preview at the slot's true shape, what happened to the chosen file and the actions that fit. The empty preview is the file picker (a file can be dropped on it). Shown empty, filled in each of the four slots, a near miss shown whole on a plain background, refused for its shape, its type (the file name shows), its size and its weight, while checking, off while saving, and one that takes a real file from your computer.",
    sources: ["domain/sponsor-image-slot.tsx"],
    Demo: SponsorSlotDemo,
  },
  {
    id: "sponsor-form",
    name: "Sponsor form",
    description:
      "The body of the Add sponsor and Edit sponsor drawer: the advertiser's name (shown to staff only), the alt text, the destination link, the Active switch and the four picture slots with their notes. Shown empty for a new sponsor, filled with all four pictures ready, with a near-miss phone picture, with problems on the boxes and refused pictures, and while saving.",
    sources: ["domain/sponsor-fields.tsx", "domain/sponsor-image-slot.tsx"],
    Demo: SponsorFormDemo,
  },
  {
    id: "sponsors-manager",
    name: "Sponsors manager",
    description:
      "The Sponsors section of the Hero page: the heading with Add sponsor, the sponsors in the order visitors see them (name, status, whether the Strip and Panel formats are ready, the up and down arrows, Edit and Delete) as a table from 1024 px of room and as cards below, and the count line. The first sponsor's Up and the last one's Down are off. Delete asks first. Shown with three sponsors (active, a strip only, one that needs images), an inactive one, a very long name, one saved without a name, a single sponsor, nothing yet, and while saving.",
    sources: [
      "domain/sponsors-manager.tsx",
      "patterns/responsive-table.tsx",
      "patterns/confirm-dialog.tsx",
    ],
    Demo: SponsorsManagerDemo,
  },
  {
    id: "sponsor-hero-preview",
    name: "Sponsor hero preview",
    description:
      "The live preview on the Hero page with the first sponsor's banner in it: a switch between Desktop and Phone, the layout's name with the sponsor that is showing, and the drawing of the hero (the banner under the search in Search Desk, beside it in Split on a desktop and under it on a phone, at the slot's true shape). When no sponsor can be shown it says so and draws the search card alone. Shown for Search Desk and Split on a desktop and a phone, with Split but no panel, and with no sponsors.",
    sources: ["domain/sponsor-hero-preview.tsx", "domain/site-hero-preview.tsx"],
    Demo: SponsorHeroPreviewDemo,
  },
  {
    id: "hero-sponsors-page",
    name: "Hero page with sponsors",
    description:
      "The whole Hero page as the admin sees it: the text and layout boxes, a note under the layout cards saying which layout is live and warning when sponsors cannot show in it, the preview beside them and the Sponsors section below, full width, above the save bar. Shown with three sponsors on Search Desk (choose Split and the warning and the preview change), with Split and no sponsor that has a panel, and with no sponsors.",
    sources: [
      "domain/site-content-layout.tsx",
      "domain/site-hero-fields.tsx",
      "domain/sponsors-manager.tsx",
      "domain/sponsor-hero-preview.tsx",
    ],
    Demo: HeroSponsorsPageDemo,
  },
];
