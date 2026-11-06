import type { LabEntry } from "../types";
import { DashboardPageDemo } from "./dashboard-demos";
import { CompareBarDemo, ComparePageDemo } from "./discovery-demos";
import { ContactPageDemo } from "./contact-demos";
import { LegalPagesDemo } from "./legal-demos";
import { ProjectPageDemo } from "./project-demos";
import { ProjectsPageDemo } from "./projects-demos";
import { SessionEndedDemo } from "./session-ended-demos";

/**
 * The parts of finding and choosing homes and projects that sit across the screens: the compare bar and the
 * comparison (S4-T02), the projects page and the project page (S4-T09), and the signed-in person's dashboard
 * (S5-T04), and the warning a form shows when the session ended (S5-T07). They mirror the compare, projects and dashboard screens; the search, property and project cards
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
      "The signed-in person's dashboard below the header: the heading with a line that names them (or leaves the name out), Post a property, and four tabs (Saved, My listings, Enquiries received, My enquiries) that live in the address; the tabs can be chosen here and move with the arrow keys. Each tab with nothing to list shows its own empty state and one next step; My enquiries with enquiries sent lists each with its home, time, reply status and message. The email prompt for someone with no address (a field, Send link and Later) with a wrong address, an address that cannot be used (no reason given), sending and a failure; and the reminder once a link was sent (Email not verified, with Send the link again, on a wait or ready, and a failure). Loading. Nothing here navigates.",
    sources: [
      "patterns/tabs.tsx",
      "patterns/status-badge.tsx",
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
      "The project page below the header: the breadcrumb, the developer's monogram and name, the title with the locality and RERA tags, the gallery, Call, WhatsApp and Brochure, then Project overview, About, Amenities, Specifications, the units table (status as a word with a dot; it scrolls sideways on a phone with a soft fade), Floor plans (each opens full size in a new tab), the price per sq.ft trend with a View as table, Location advantages and Nearby places, and Videos. Beside them the price card with the sizes and possession. A project with little given leaves the empty sections out. The enquiry card (\"Interested in this project?\": Enquire or Site visit, name and phone, email, the date for a visit, message; Send is switched off with a line saying why, because sending is a later task) in its states: Enquire, Site visit, missing fields marked, too many requests this hour, and sent. The same card with a project's own form, set by the admin (its fields, the locked phone, missing fields marked, too many requests, could not be sent, and sent with the form's own words). The phone's bar with Call, WhatsApp and Enquire, which leads to the card, and with no number. Not found and loading. Nothing here navigates.",
    sources: [
      "domain/dynamic-form.tsx",
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
  {
    id: "contact-page",
    name: "Contact page",
    description:
      'The contact page below the header: the breadcrumb, "Talk to us" and the form in a card with "Reach us directly" beside it (below it on a phone). The form is the default contact form drawn by the form renderer: name and mobile needed, email, "I\'m interested in" and a message optional, then Send message and the consent line with the Privacy Policy link. States: wrong answers (each message beside its field, what was typed kept), too many messages this hour, could not be sent, sending, sent, the form could not be loaded (with Refresh), no contact details set (the column is left out) and loading. Also the renderer with one of every kind of field: text, number, email, dropdown, date, radio buttons, checkboxes, a single checkbox and a long answer with a counter. Nothing here sends or navigates.',
    sources: [
      "domain/dynamic-form.tsx",
      "patterns/form-field.tsx",
      "patterns/alert.tsx",
      "patterns/breadcrumb.tsx",
      "ui/native-select.tsx",
      "ui/checkbox.tsx",
      "ui/radio-group.tsx",
      "ui/textarea.tsx",
    ],
    Demo: ContactPageDemo,
  },
  {
    id: "session-ended",
    name: "Session ended",
    description:
      "The warning a form shows when the visitor's session ended before they could send it (S5-T07): \"Your session has ended\", that what they typed will be kept, and a Sign in again link. On its own, and inside the property enquiry card, the phone's enquiry sheet, the project's enquiry card and a project's own form, with what was typed still in the form. Nothing here signs in or navigates. The words are not approved yet.",
    sources: ["domain/session-ended-alert.tsx", "domain/enquiry-card.tsx", "patterns/alert.tsx"],
    Demo: SessionEndedDemo,
  },
];
