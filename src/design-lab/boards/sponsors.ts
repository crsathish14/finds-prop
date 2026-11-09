import type { LabEntry } from "../types";
import { SponsorFormDemo, SponsorSlotDemo } from "./sponsors-demos";

/**
 * What the admin uses to manage the sponsored banners (S7-T11, FR-ADM-11): the picture slot with every state a chosen
 * file can end in, and the Add and Edit sponsor form with its four slots. It has its own board because the Site content
 * board had grown too tall to photograph comfortably. It mirrors the admin Hero and sponsors screen.
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
];
