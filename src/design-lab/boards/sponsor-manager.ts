import type { LabEntry } from "../types";
import {
  HeroSponsorsPageDemo,
  SponsorHeroPreviewDemo,
  SponsorsManagerDemo,
} from "./sponsor-manager-demos";

/**
 * What the admin uses to manage the sponsors of the Hero page (S7-T11, FR-ADM-11): the list of sponsors with its order
 * arrows, the preview of the hero with the banner in it, and the whole Hero page with both. It has its own board
 * because the Sponsors board (the picture slot and the form) was already very tall. It mirrors the admin Hero and
 * sponsors screen.
 */
export const SPONSOR_MANAGER: LabEntry[] = [
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
