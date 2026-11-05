import type { LabEntry } from "../types";
import { CompareBarDemo, ComparePageDemo } from "./discovery-demos";
import { ProjectsPageDemo } from "./projects-demos";

/**
 * The parts of finding and choosing homes and projects that sit across the screens: the compare bar and the
 * comparison (S4-T02) and the projects page (S4-T09). They mirror the compare and projects screens; the
 * search, property and project cards are on the Domain board.
 */
export const DISCOVERY: LabEntry[] = [
  {
    id: "compare-bar",
    name: "Compare bar",
    description:
      "The bar that appears after the first home is chosen for comparing: three slots with the chosen homes' pictures and a remove button each, N of 3 selected with what to do next, Clear all, and Compare now, which stays off until two are chosen. One, two and three homes. The real bar is pinned to the bottom of the screen (above the phone's bottom bar); here it sits in the page.",
    sources: ["domain/property-card-controls.client.tsx", "ui/icon-button.tsx"],
    Demo: CompareBarDemo,
  },
  {
    id: "compare-page",
    name: "Compare page",
    description:
      "The comparison below the header: the breadcrumb, the heading and line, and one table with a label column and a column for each home (picture, tags, title, price, View home and Remove), then Overview, Facts and a row for every amenity any home has, with Yes or Not listed. On a phone the table scrolls sideways and the label column stays. Three homes (a sale, a rent and a plot with details missing), fewer than two homes, and loading. Nothing here navigates.",
    sources: ["patterns/empty-state.tsx", "patterns/breadcrumb.tsx", "patterns/spec-tile.tsx"],
    Demo: ComparePageDemo,
  },
  {
    id: "projects-page",
    name: "Projects page",
    description:
      "The projects page below the header: the breadcrumb, New launches, the heading (Projects in the region from the site content, or New projects without one) with its line, and the grid of project cards, three across on a wide screen. A project without a picture, price or status leaves those out. No projects (coming soon, with Browse homes), the projects could not be loaded (Try again) and loading. Nothing here navigates.",
    sources: [
      "domain/project-card.tsx",
      "domain/section-grid.tsx",
      "patterns/alert.tsx",
      "patterns/breadcrumb.tsx",
      "patterns/empty-state.tsx",
    ],
    Demo: ProjectsPageDemo,
  },
];
