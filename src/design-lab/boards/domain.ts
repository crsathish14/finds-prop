import type { LabEntry } from "../types";
import { PropertyCardDemo, PropertyCardListDemo } from "./domain-demos";
import { DeveloperCardDemo, LocalityTileDemo, ProjectCardDemo } from "./domain-demos-places";
import { FilterRailDemo, FilterSheetDemo } from "./domain-demos-filters";
import { SearchCardDemo } from "./domain-demos-search";

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
];
