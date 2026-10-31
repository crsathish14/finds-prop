import type { LabEntry } from "../types";
import { AnatomyDemo, HeroDemo } from "./ads-demos";

export const ADS: LabEntry[] = [
  {
    id: "sponsor-slot",
    name: "Sponsor slot",
    description:
      "Anatomy, formats, several ads, About this ad, the near-miss fit and the empty case.",
    sources: ["layout/sponsor-slot.tsx", "layout/sponsor-frame.tsx"],
    Demo: AnatomyDemo,
  },
  {
    id: "hero-placements",
    name: "Hero placements",
    description: "Variation A, Variation B and the no-sponsor fallback at three widths.",
    sources: [],
    Demo: HeroDemo,
  },
];
