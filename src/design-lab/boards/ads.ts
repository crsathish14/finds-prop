import type { LabEntry } from "../types";
import { AnatomyDemo, HeroDemo } from "./ads-demos";
import { HeroAsBuiltDemo, ResultsBannerDemo } from "./ads-demos-placements";
import { CinematicBannerDemo, ShowcaseCardDemo, StyledFrameDemo } from "./ads-demos-styled";
import { FeaturedProjectCardDemo } from "./ads-demos-featured";
import { DeveloperSpotlightDemo } from "./ads-demos-spotlight";

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
      "The real homepage hero with its banner area: Search Desk with the strip directly under the search bar, Split with the headline, search bar and trust lines on the left and the panel on the right, and Split without a panel banner, which becomes Search Desk with nothing in the banner position and no gap.",
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
  {
    id: "sponsor-showcase-card",
    name: "Showcase card",
    description:
      "The Showcase style of the hero ad (A, ADR-187): the sponsor's photo beside the developer, project, area, homes, size, possession and price the admin typed, with View project and, for one of our projects, Get price list. Shown for one of our projects with a RERA number, for another site (one button that opens a new tab), and with a very long name.",
    sources: ["domain/sponsor-showcase-card.tsx"],
    Demo: ShowcaseCardDemo,
  },
  {
    id: "sponsor-cinematic-banner",
    name: "Cinematic banner",
    description:
      "The Cinematic style of the hero ad (B, ADR-187): a tall photo with a shade, the brand, an eyebrow, the headline, one line and the button the admin typed, and an Up next box naming the following sponsor. Shown with every line and with only the headline and the button.",
    sources: ["domain/sponsor-cinematic-banner.tsx"],
    Demo: CinematicBannerDemo,
  },
  {
    id: "sponsor-styled-frame",
    name: "Styled hero ads",
    description:
      "The hero ads in the style the admin chose, in the platform's frame: Sponsored, About this ad, the progress bars and the previous and next buttons. The ads turn when the bar is full and wait while the pointer or focus is on them. Shown for the Showcase and the Cinematic style with three ads, and one ad with About this ad open.",
    sources: ["layout/sponsor-styled-frame.tsx"],
    Demo: StyledFrameDemo,
  },
  {
    id: "featured-project-card",
    name: "Featured project card",
    description:
      "The Featured project card (C, ADR-192): a project of a builder or agent the admin picked, after the sixth result in the homes and projects lists, across the whole row. A big photo with two more and a count, the developer's logo or initials, Sponsored, the project, the homes, the size range, the status, RERA, three highlights and the price, with Request a call back and View project. An amber ring and a Featured project ribbon set it apart. Shown with every detail and with little given.",
    sources: ["domain/featured-project-card.tsx"],
    Demo: FeaturedProjectCardDemo,
  },
  {
    id: "developer-spotlight",
    name: "Developer spotlight",
    description:
      "The Developer spotlight (D, ADR-193): a builder or agent the admin picked, as a dark band on the home page, one per visit. Their logo or initials, name, tagline, years, projects delivered, projects listed and launching, their website, and up to three live projects as cards that scroll sideways on phones. Shown with every detail and with little given.",
    sources: ["domain/developer-spotlight.tsx"],
    Demo: DeveloperSpotlightDemo,
  },
];
