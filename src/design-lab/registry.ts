import { ADS } from "./boards/ads";
import { COMPONENTS } from "./boards/components";
import { DISCOVERY } from "./boards/discovery";
import { DOMAIN } from "./boards/domain";
import { FEEDBACK } from "./boards/feedback";
import { FOUNDATIONS } from "./boards/foundations";
import { NAVIGATION } from "./boards/navigation";
import type { LabBoard, LabBoardId } from "./types";

/**
 * Every board and every entry on it (ADR-020). A shared component must appear in `sources` of an
 * entry; the registry test fails if a file in src/components has none (R-DS-03).
 */
export const LAB_BOARDS: LabBoard[] = [
  {
    id: "foundations",
    title: "Foundations",
    uxBoard: "ds-foundations",
    summary:
      "Colour with measured contrast, type, spacing, shape, focus, icons and layout helpers.",
    entries: FOUNDATIONS,
  },
  {
    id: "components",
    title: "Components",
    uxBoard: "ds-components",
    summary:
      "Buttons, fields, chips, badges, card parts and the other building blocks, in every state.",
    entries: COMPONENTS,
  },
  {
    id: "navigation",
    title: "Navigation",
    uxBoard: "ds-navigation",
    summary:
      "Header, drawer, bottom bar, footer, portal shell, tabs, menus, breadcrumb and stepper.",
    entries: NAVIGATION,
  },
  {
    id: "feedback",
    title: "Feedback",
    uxBoard: "ds-feedback",
    summary: "Alerts, toasts, dialogs, sheets, popovers, empty states and loading.",
    entries: FEEDBACK,
  },
  {
    id: "ads",
    title: "Ads",
    uxBoard: "ds-ads",
    summary:
      "The sponsored banner container: anatomy, formats, several ads, fitting and the fallback.",
    entries: ADS,
  },
  {
    id: "domain",
    title: "Domain",
    uxBoard: "search",
    summary:
      "The organisms that appear only inside the screens: property, project and developer cards, search, filters, gallery and enquiry. They mirror the search, property, projects and home screens.",
    entries: DOMAIN,
  },
  {
    id: "discovery",
    title: "Discovery",
    uxBoard: "compare",
    summary:
      "What spans the screens when choosing homes: the compare bar and the comparison. It mirrors the compare screen.",
    entries: DISCOVERY,
  },
];

export function getBoard(id: LabBoardId): LabBoard {
  const board = LAB_BOARDS.find((candidate) => candidate.id === id);
  if (!board) throw new Error(`Unknown Design Lab board: ${id}`);
  return board;
}
