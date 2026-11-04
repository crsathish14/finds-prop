import type { LabEntry } from "../types";
import { PropertyCardDemo, PropertyCardListDemo } from "./domain-demos";

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
];
