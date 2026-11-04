import type { LabEntry } from "../types";
import { PropertyCardDemo, PropertyCardListDemo } from "./domain-demos";
import { DeveloperCardDemo, LocalityTileDemo, ProjectCardDemo } from "./domain-demos-places";
import { FilterRailDemo, FilterSheetDemo } from "./domain-demos-filters";
import { HomeCardSectionsDemo, HomeHeroDemo, HomeSectionsDemo } from "./domain-demos-home";
import { SearchCardDemo } from "./domain-demos-search";
import {
  CategoryCardDemo,
  CtaBandDemo,
  ScrollRowDemo,
  SectionHeadDemo,
  ValueCardDemo,
} from "./domain-demos-sections";

/**
 * The organisms that appear only inside the screens (S4-T01). The five approved boards do not show
 * them; their look is in the search, property, projects and home screens, which this board mirrors.
 */
export const DOMAIN: LabEntry[] = [
  {
    id: "property-card",
    name: "Property card, grid",
    description:
      "One home: picture, For sale or For rent and the label, price, title, place and facts, with the heart and Compare. Hover, saved, chosen, disabled, no picture, no details, long text and loading.",
    sources: ["domain/property-card.tsx", "domain/property-card-controls.client.tsx"],
    Demo: PropertyCardDemo,
  },
  {
    id: "property-card-list",
    name: "Property card, list",
    description:
      "The list layout puts the picture beside the text when the card's own box is wide enough (a container query) and stacks below that.",
    sources: [],
    Demo: PropertyCardListDemo,
  },
  {
    id: "project-card",
    name: "Project card",
    description:
      "One new-build project: picture with the Featured and status badges, developer in copper capitals, name, place, price range and BHK sizes. Hover, no picture, no details, long text and loading.",
    sources: ["domain/project-card.tsx"],
    Demo: ProjectCardDemo,
  },
  {
    id: "developer-card",
    name: "Developer card",
    description:
      "A developer's monogram in green, copper or sand, name, project count, introduction and two project thumbnails. Only a name, long text, a missing picture and loading.",
    sources: ["domain/developer-card.tsx"],
    Demo: DeveloperCardDemo,
  },
  {
    id: "locality-tile",
    name: "Locality tile",
    description:
      "A tinted tile linking to one locality, in the five tints of the UX, with an optional subtitle. Hover lift, no subtitle, a long name and loading. The tints use the nearest palette tokens.",
    sources: ["domain/locality-tile.tsx"],
    Demo: LocalityTileDemo,
  },
  {
    id: "search-card",
    name: "Search card",
    description:
      "The home page search box: Buy, Rent and New projects, a locality box with suggestions, property type, bedrooms, maximum budget and the copper Search button, with Popular and Quick-pick chips. Wide (one joined bar), stacked, with values, Rent, no AI link and no chips, and long text.",
    sources: ["domain/search-card.tsx"],
    Demo: SearchCardDemo,
  },
  {
    id: "filter-rail",
    name: "Filter rail",
    description:
      "The filter panel beside the results on a wide screen: Looking to, locality, property type, bedrooms (Any and 1 to 4), maximum budget and Clear all. Filled, nothing set, Rent and a locality that is not in the list.",
    sources: ["domain/filters.tsx"],
    Demo: FilterRailDemo,
  },
  {
    id: "filter-sheet",
    name: "Filter sheet",
    description:
      "On a phone, the Filters button (with the count of filters set) opens a bottom sheet with the same fields plus Sort by, Clear all and Show N homes. The button with and without a count, and the open sheet drawn for comparison.",
    sources: [],
    Demo: FilterSheetDemo,
  },
  {
    id: "section-head",
    name: "Section head",
    description:
      "The title row above a homepage section: the heading, an optional line under it and a link or buttons at the right. With a link, with a line, with an emphasised word and with a long title.",
    sources: ["domain/section-head.tsx"],
    Demo: SectionHeadDemo,
  },
  {
    id: "category-card",
    name: "Category card",
    description:
      "A tinted card with an icon, a title, a line and a copper arrow that leads to one way of browsing (Featured, Prime, Budget, By locality). The four tints, hover lift and a long text. The tints use the nearest palette tokens.",
    sources: ["domain/category-card.tsx"],
    Demo: CategoryCardDemo,
  },
  {
    id: "value-card",
    name: "Value card",
    description:
      "One reason to use Find Prop: a green icon square, a bold title and a sentence, on a white card. Three in a row, and a long text.",
    sources: ["domain/value-card.tsx"],
    Demo: ValueCardDemo,
  },
  {
    id: "cta-band",
    name: "Call to action band",
    description:
      "The green banner at the foot of the homepage with arches, a title, a line and the copper button that leads to Post property. With and without the line.",
    sources: ["domain/cta-band.tsx"],
    Demo: CtaBandDemo,
  },
  {
    id: "scroll-row",
    name: "Scrolling row",
    description:
      "A titled row of cards that scrolls sideways, with Previous and Next buttons from 768 px (disabled at the ends) and swiping on a phone. Six cards, and one card only.",
    sources: ["domain/scroll-row.tsx"],
    Demo: ScrollRowDemo,
  },
  {
    id: "home-hero",
    name: "Home hero",
    description:
      "The top of the homepage: the headline (the region's name in copper when the site content has one), the line under it and the search card, on faint green arches. With and without the copper word and the line, and a long headline.",
    sources: ["domain/home-hero.tsx"],
    Demo: HomeHeroDemo,
  },
  {
    id: "home-sections",
    name: "Homepage sections",
    description:
      "The static sections of the homepage as the page builds them: Explore by locality (the curated places as tinted tiles), Browse by what matters, Why Find Prop and the banner, each a labelled region with the page's spacing, and the darker band tone. The grid columns are 2, 3 and 5 for tiles, 1, 2 and 4 for category cards, and 1 and 3 for value cards.",
    sources: ["domain/home-section.tsx", "domain/section-grid.tsx"],
    Demo: HomeSectionsDemo,
  },
  {
    id: "home-card-sections",
    name: "Homepage card sections",
    description:
      "The two homepage sections that show cards in a grid: Featured homes (property cards, 1, 2 and 3 across, with View all) and New launches from developers (developer cards on the darker band, with the line under the title and See all projects). Newest on Find Prop is the Scrolling row.",
    sources: [],
    Demo: HomeCardSectionsDemo,
  },
];
