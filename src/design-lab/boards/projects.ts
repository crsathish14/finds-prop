import type { LabEntry } from "../types";
import { ProjectsPageDemo } from "./projects-demos";

/**
 * The projects screens (S4-T09): the list now, the project page with the next change. They mirror the
 * projects and project screens; the project card itself is on the Domain board.
 */
export const PROJECTS: LabEntry[] = [
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
