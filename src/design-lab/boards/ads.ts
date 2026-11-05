import type { LabEntry } from "../types";
import { AnatomyDemo, HeroDemo } from "./ads-demos";
import { HeroAsBuiltDemo, ResultsBannerDemo } from "./ads-demos-placements";

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
  {
    id: "hero-as-built",
    name: "Home hero, as built",
    description:
      "The real homepage hero with its banner area: Search Desk with the strip directly under the search card, Split with the headline, stacked card and trust lines on the left and the panel on the right, and Split without a panel banner, which becomes Search Desk with nothing in the banner position and no gap.",
    sources: ["domain/home-hero.tsx"],
    Demo: HeroAsBuiltDemo,
  },
  {
    id: "results-banner",
    name: "Banner in the results",
    description:
      "One sponsored banner across the whole row after the sixth home of the results, as the UX draws it. With no banner that qualifies there is no row and no gap.",
    sources: ["domain/results-list.tsx"],
    Demo: ResultsBannerDemo,
  },
];
