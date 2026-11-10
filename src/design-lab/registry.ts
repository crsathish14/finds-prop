import { ADMIN } from "./boards/admin";
import { ADS } from "./boards/ads";
import { COMPONENTS } from "./boards/components";
import { CHARTS } from "./boards/charts";
import { CRM } from "./boards/crm";
import { DISCOVERY } from "./boards/discovery";
import { DOMAIN } from "./boards/domain";
import { FEEDBACK } from "./boards/feedback";
import { FORMS } from "./boards/forms";
import { FOUNDATIONS } from "./boards/foundations";
import { NAVIGATION } from "./boards/navigation";
import { SELLER } from "./boards/seller";
import { SITE_CONTENT } from "./boards/site-content";
import { SPONSORS } from "./boards/sponsors";
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
      "What spans the screens when choosing homes and projects: the compare bar and the comparison, the projects page and the project page. It mirrors the compare, projects and project screens.",
    entries: DISCOVERY,
  },
  {
    id: "seller",
    title: "Seller",
    uxBoard: "post-property",
    summary:
      "What an owner uses to post a property: the wizard's frame and footer, the choice cards, the amenity chips, the review list, the gate and the drafts list. It mirrors the post-property screen.",
    entries: SELLER,
  },
  {
    id: "admin",
    title: "Admin",
    uxBoard: "admin-listings",
    summary:
      "What the admin uses to review the listings owners post: the queue with its tabs and filters, the review drawer and the reject dialog. It mirrors the admin listings screen.",
    entries: ADMIN,
  },
  {
    id: "site-content",
    title: "Site content",
    uxBoard: "admin-cms",
    summary:
      "What the admin uses to edit the header, hero, homepage and footer of the public site: the page frame with its tabs, live preview and save bar, the list of links, the Header, Footer, Hero and Homepage boxes with their previews, and the localities list. It mirrors the admin Site content screen.",
    entries: SITE_CONTENT,
  },
  {
    id: "sponsors",
    title: "Sponsors",
    uxBoard: "admin-sponsors",
    summary:
      "What the admin uses to manage the sponsored banners on the home page and in the results: the picture slot with every state a chosen file can end in, the Add and Edit sponsor form, the list of sponsors with its order arrows, the hero preview with the banner in it, and the whole Hero page with both. It mirrors the admin Hero and sponsors screen.",
    entries: SPONSORS,
  },
  {
    id: "forms",
    title: "Forms",
    uxBoard: "admin-forms",
    summary:
      "What the admin uses to build the forms shown on project pages and the contact page: the list of forms with its Active switches, the editor's Settings box, and the Fields editor with its live preview. It mirrors the admin Forms screen.",
    entries: FORMS,
  },
  {
    id: "crm",
    title: "CRM",
    uxBoard: "admin-crm",
    summary:
      "What the admin uses to connect the site to a CRM: the connection cards, the API logs, the editor's Connection, Credentials and Headers and body boxes, and the Agent column and Retry delivery now on the Leads page. It mirrors the admin CRM screen.",
    entries: CRM,
  },
  {
    id: "charts",
    title: "Charts",
    uxBoard: "admin-overview",
    summary:
      "What the admin's Overview page is drawn with: the line chart with its crosshair and tooltip, the Chart / Table card, the part-to-whole bar, the horizontal bars, the recent leads, and the whole page with its error and reloading states. It mirrors the admin Overview screen.",
    entries: CHARTS,
  },
];

export function getBoard(id: LabBoardId): LabBoard {
  const board = LAB_BOARDS.find((candidate) => candidate.id === id);
  if (!board) throw new Error(`Unknown Design Lab board: ${id}`);
  return board;
}
