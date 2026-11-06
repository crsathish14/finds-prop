import type { LabEntry } from "../types";
import { DashboardPageDemo } from "./dashboard-demos";
import { CompareBarDemo, ComparePageDemo } from "./discovery-demos";
import { LegalPagesDemo } from "./legal-demos";
import { ProjectPageDemo } from "./project-demos";
import { ProjectsPageDemo } from "./projects-demos";

/**
 * The parts of finding and choosing homes and projects that sit across the screens: the compare bar and the
 * comparison (S4-T02), the projects page and the project page (S4-T09), and the signed-in person's dashboard
 * (S5-T04). They mirror the compare, projects and dashboard screens; the search, property and project cards
 * are on the Domain board.
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
    sources: [
      "patterns/empty-state.tsx",
      "patterns/breadcrumb.tsx",
      "patterns/spec-tile.tsx",
      "patterns/scroll-fade.client.tsx",
    ],
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
  {
    id: "dashboard-page",
    name: "Dashboard page",
    description:
      "The signed-in person's dashboard below the header: the heading with a line that names them (or leaves the name out), Post a property, and four tabs (Saved, My listings, Enquiries received, My enquiries) that live in the address; the tabs can be chosen here and move with the arrow keys. Each tab with nothing to list shows its own empty state and one next step. The email prompt for someone with no address (a field, Send link and Later) with a wrong address, an address that cannot be used (no reason given), sending and a failure; and the reminder once a link was sent (Email not verified, with Send the link again, on a wait or ready, and a failure). Loading. Nothing here navigates.",
    sources: [
      "patterns/tabs.tsx",
      "patterns/empty-state.tsx",
      "patterns/alert.tsx",
      "ui/badge.tsx",
      "ui/skeleton.tsx",
    ],
    Demo: DashboardPageDemo,
  },
  {
    id: "project-page",
    name: "Project page",
    description:
      "The project page below the header: the breadcrumb, the developer's monogram and name, the title with the locality and RERA tags, the gallery, Call, WhatsApp and Brochure, then Project overview, About, Amenities, Specifications, the units table (status as a word with a dot; it scrolls sideways on a phone with a soft fade), Floor plans (each opens full size in a new tab), the price per sq.ft trend with a View as table, Location advantages and Nearby places, and Videos. Beside them the price card with the sizes and possession. A project with little given leaves the empty sections out. The enquiry card (\"Interested in this project?\": Enquire or Site visit, name and phone, email, the date for a visit, message; Send is switched off with a line saying why, because sending is a later task) in its states: Enquire, Site visit, missing fields marked, too many requests this hour, and sent. The phone's bar with Call, WhatsApp and Enquire, which leads to the card, and with no number. Not found and loading. Nothing here navigates.",
    sources: [
      "domain/property-gallery.tsx",
      "domain/property-card-controls.client.tsx",
      "patterns/spec-tile.tsx",
      "patterns/status-badge.tsx",
      "patterns/scroll-fade.client.tsx",
      "ui/avatar.tsx",
      "ui/price.tsx",
      "ui/segmented-control.tsx",
      "ui/icon-button.tsx",
      "patterns/form-field.tsx",
    ],
    Demo: ProjectPageDemo,
  },
  {
    id: "legal-pages",
    name: "Legal pages",
    description:
      "The Privacy Policy, Terms of Use and Cookie information in one reading layout: the breadcrumb, a switch between the three pages, the title with the Legal tag, a draft notice (the text is a placeholder until the owner's text is in, and the page is kept out of search results), a summary and numbered sections beside an On this page list (a column from 1024 px, a list that opens on a phone), with a table for the data collected and for what the site stores in the browser. Nothing here navigates.",
    sources: ["patterns/alert.tsx", "patterns/breadcrumb.tsx"],
    Demo: LegalPagesDemo,
  },
];
