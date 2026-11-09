import type { LabEntry } from "../types";
import { BuilderFormDemo, BuilderTableDemo, SignInAddressDemo } from "./admin-builders-demos";
import {
  SubmissionDetailDemo,
  SubmissionsFiltersDemo,
  SubmissionsTableDemo,
} from "./admin-submissions-demos";
import { InsightsPanelDemo } from "./admin-insights-demos";
import {
  ProjectFormDemo,
  ProjectSectionNavDemo,
  TagListFieldDemo,
} from "./admin-project-form-demos";
import {
  LinkListFieldDemo,
  SiteContentFrameDemo,
  SiteFooterDemo,
} from "./admin-site-content-demos";
import { LeadsTableDemo, UnitFormDemo, UnitsManagerDemo } from "./admin-units-leads-demos";
import {
  ManagerDrawerDemo,
  ProjectsManagerDemo,
  ResponsiveTableDemo,
} from "./admin-managers-demos";
import { ListingQueueDemo, ListingReviewDemo, RejectDialogDemo } from "./admin-demos";

/**
 * What the admin uses to review the listings owners post (S6-T04) and to invite and manage builders (S7-T05).
 * The board mirrors the admin listings screen (the queue with its tabs and filters, the review drawer and the
 * dialog that confirms a rejection) and the admin builders screen (the table, the invite and edit forms and the
 * address passed on after inviting), then the lists the admin and the builder share (S7-T01): the table that becomes
 * cards, the drawer for adding and editing a row, the Projects page in both modes, the Units page and its form, the Leads table, the form submissions (table, filters and details) and the Insights numbers.
 */
export const ADMIN: LabEntry[] = [
  {
    id: "listing-queue",
    name: "Listing queue",
    description:
      "The rows of the admin's listings page: a table from 1024 px of room and cards below that, each with the picture, title, owner, price, when it was submitted, its state and its buttons. Shown under the tabs and filters it sits in, with Show more, with featured, rejected (with its reason), sold, a very long title, a working button, and nothing to review.",
    sources: ["domain/listing-queue.tsx"],
    Demo: ListingQueueDemo,
  },
  {
    id: "listing-review",
    name: "Listing review",
    description:
      "The drawer where an admin reads one listing before deciding: every photo, the state, title, price and facts, the description, address and owner, and Approve and Reject fixed in the footer. A pending and a rejected listing, on a phone and on a desktop.",
    sources: ["domain/listing-review.tsx"],
    Demo: ListingReviewDemo,
  },
  {
    id: "reject-listing-dialog",
    name: "Reject listing dialog",
    description:
      "The one dialog that confirms a rejection and asks why, because the owner reads the reason. Empty, with an error, too long, and while rejecting; Cancel is read first and focus goes to the reason box.",
    sources: ["domain/reject-listing-dialog.tsx"],
    Demo: RejectDialogDemo,
  },
  {
    id: "builder-table",
    name: "Builder table",
    description:
      "The rows of the admin's Builders page: a table from 1024 px of room and cards below that, each with the company and its login email, the state (Active, Invited, Inactive), projects, leads, the last sign-in and its buttons, the Edit button and a menu (Edit details, Resend invitation for an invited builder, Deactivate or Activate). Shown with the page heading and New builder, an agent, a builder who has not signed in, a very long name and email, nothing yet, and the confirmation before deactivating.",
    sources: [
      "domain/builder-table.tsx",
      "patterns/dropdown-menu.tsx",
      "patterns/confirm-dialog.tsx",
    ],
    Demo: BuilderTableDemo,
  },
  {
    id: "builder-form",
    name: "Builder form",
    description:
      "The fields of the New builder and Edit details drawers: company, login email, type (builder or agent), contact person, phone, logo link, website and about. Empty, with an email that cannot be used, in edit mode (the login email cannot be changed) and while sending; the drawer opens from its button and, after Invite builder, shows the address to pass on.",
    sources: ["domain/builder-form.tsx", "patterns/sheet.tsx"],
    Demo: BuilderFormDemo,
  },
  {
    id: "sign-in-address",
    name: "Sign-in address",
    description:
      "The address an invited builder signs in at, with a Copy address button that says Copied for a few seconds. Nothing is emailed in v1, so the admin passes this on. A normal address and a very long one on a narrow card.",
    sources: ["domain/sign-in-address.tsx"],
    Demo: SignInAddressDemo,
  },
  {
    id: "responsive-table",
    name: "Responsive table",
    description:
      "The base of the lists in the admin and builder portals: one definition of the columns and rows draws a table from 1024 px of room and cards below that, each value under its word and the buttons at the foot. Shown wide, in a narrow area, and with a very long name.",
    sources: ["patterns/responsive-table.tsx"],
    Demo: ResponsiveTableDemo,
  },
  {
    id: "manager-drawer",
    name: "Manager drawer",
    description:
      "The side drawer where a row is added or edited: a title and a line, the form, and a footer with Cancel and the main button that stay in view while the form scrolls. The main button works for a moment when sending; a drawer that only shows something has one Close button.",
    sources: ["patterns/manager-drawer.tsx"],
    Demo: ManagerDrawerDemo,
  },
  {
    id: "projects-manager",
    name: "Projects manager",
    description:
      "The Projects page of the admin and of a builder in one component: the heading and Add project, the status tabs with counts, the search box, the list (a table, or cards on a phone) with a menu on each row, and the line under it. The admin sees the Builder column, a filter for builders and the moderation buttons (Approve, Reject, Publish, Unpublish, Feature); a builder sees a warning that edits go back for approval, and Edit and View live. Shown with every state of a project, a refused delete, a working button, a very long name, nothing yet, and the question before rejecting.",
    sources: ["domain/projects-manager.tsx"],
    Demo: ProjectsManagerDemo,
  },
  {
    id: "unit-form",
    name: "Unit form",
    description:
      "The fields of the Add unit and Edit unit drawer: unit number, floor, bedrooms, area, facing, price, state, the date it is available from and a link to its floor plan. Empty, with errors on three boxes, filled in, and while saving (every box off).",
    sources: ["domain/unit-form.tsx"],
    Demo: UnitFormDemo,
  },
  {
    id: "units-manager",
    name: "Units manager",
    description:
      "The Units page of a project, the same for the admin and for a builder: the heading and Add unit, the choice of project, a search for a unit number, the state chips, the list (a table, or cards on a phone) with Edit and Delete on each row, and the line under it. Shown with six units, a unit with nothing but a number and an area, a very long unit number, a unit being deleted, nothing yet, the drawer that opens from Add unit, and the question before deleting.",
    sources: ["domain/units-manager.tsx"],
    Demo: UnitsManagerDemo,
  },
  {
    id: "leads-table",
    name: "Leads table",
    description:
      "The people who enquired about projects, for the admin and for a builder: when, which project, what they asked for, name, phone (a call link), email, message and a box to change the lead's state, which is the only thing that can be changed. A table from 1024 px of room and cards below that. Shown with four leads (one saving, some with no email or message), the builder's line under the table, and a very long name, email and message.",
    sources: ["domain/leads-table.tsx"],
    Demo: LeadsTableDemo,
  },
  {
    id: "insights-panel",
    name: "Insights panel",
    description:
      "The numbers of the builder's Dashboard and Insights pages, and of the admin's overview: a choice of dates (7 days, 30 days, This month, Custom, which shows two dates), a choice of project on the full page, and the numbers in groups (Portfolio, Activity, Actions), two to a line on a phone and four or five from 1024 px of room. Charts are not part of it: they come with the chart spike. Shown as the dashboard with a notice above it, as the Insights page, and with a custom range, very large numbers and a long note.",
    sources: ["domain/insights-panel.tsx"],
    Demo: InsightsPanelDemo,
  },
  {
    id: "submissions-table",
    name: "Submissions table",
    description:
      "The forms people filled in, for the admin's Form submissions tab: when, name, mobile (a call link), project, source, form, whether the CRM got it (Delivered with its own id, Failed, Retrying, Not sent) and a Details button. A table from 1024 px of room and cards below that. Shown with five submissions (a dash for what was not given) and a very long name, project and form.",
    sources: ["domain/submissions-table.tsx"],
    Demo: SubmissionsTableDemo,
  },
  {
    id: "submissions-filters",
    name: "Submissions filters",
    description:
      "The boxes above the form submissions: date range (7, 30, 90 days or all time), form, project, source, CRM status and a Reset button. One box to a line on a phone, two on a tablet, all five and Reset on one line on a wide area. Shown with nothing chosen but the last 30 days, and with some chosen.",
    sources: ["domain/submissions-filters.tsx"],
    Demo: SubmissionsFiltersDemo,
  },
  {
    id: "submission-detail",
    name: "Submission details",
    description:
      "Everything one form submission holds, for the drawer that opens from the list: when, name, mobile, email, form, project and source, the answers with the form's own questions, and how the CRM stands, with the reason and the next retry when the delivery failed. Shown as a failed delivery, a delivered one with a very long answer, one with almost nothing in it, and in its drawer.",
    sources: ["domain/submission-detail.tsx"],
    Demo: SubmissionDetailDemo,
  },
  {
    id: "project-form",
    name: "Project form",
    description:
      "The sectioned form where the admin and a builder describe a project: Basics (name, builder for the admin, types, status, price range, BHK options, land area, units, possession, phone), Location (locality, address, latitude and longitude, advantages and nearby places as lists), RERA (a switch that turns the number box on and off), Details (description, specifications, amenities with suggestions) and SEO (page title, slug, meta description), in cards with the section list beside them, the Enquiry form box for the admin only and the save bar. Shown filled for the admin, empty with errors, for a builder (the approval warning, no Builder box, the page address of an approved project locked) and while saving. The media section and the price trends come next.",
    sources: [
      "domain/project-fields.tsx",
      "domain/project-form-layout.tsx",
      "domain/project-save-bar.tsx",
      "patterns/form-section.tsx",
    ],
    Demo: ProjectFormDemo,
  },
  {
    id: "project-section-nav",
    name: "Project section list",
    description:
      "The list of the form's sections (Basics, Location, RERA, Details, Media, SEO) with the current one marked and a tick or a warning on a section that is done or needs work, in words for a screen reader too. A row that scrolls sideways on phones and tablets and a column from 1100 px of screen. Shown with nothing done, some done and two needing attention.",
    sources: ["domain/project-section-nav.tsx"],
    Demo: ProjectSectionNavDemo,
  },
  {
    id: "tag-list-field",
    name: "Tag list field",
    description:
      "A list of short phrases typed in one at a time and removed with the x, for amenities, location advantages and nearby places: a box with Add (Enter works too), the count (3 / 30), chips that wrap, and suggestions to tap. Shown empty with suggestions, with a hint and a very long phrase, full, with an error and off while saving.",
    sources: ["patterns/tag-list-field.tsx"],
    Demo: TagListFieldDemo,
  },
  {
    id: "site-content-page",
    name: "Site content page",
    description:
      "The frame of the admin's Header, Hero, Homepage and Footer pages: the heading, the four page tabs (the current one marked), the form beside a live preview (under the form below 1100 px of screen, in a column on the right and in view while the form scrolls from 1100 px), an alert for problems and the save bar (Discard, Save changes). Shown as the Header page filled, with nothing saved (the preview shows the standard name), with problems marked on the boxes and in the alert, and while saving.",
    sources: [
      "domain/site-content-layout.tsx",
      "domain/site-header-fields.tsx",
      "domain/site-header-preview.tsx",
      "domain/project-save-bar.tsx",
    ],
    Demo: SiteContentFrameDemo,
  },
  {
    id: "link-list-field",
    name: "Link list field",
    description:
      "A list of links, each a label and where it goes, for the header and the footer: rows that are dragged or moved with the up and down arrows, a box for each part, a button to remove the row, Add link (off when the list is full) and the count (3 / 12). On a phone a row stacks its boxes; from 768 px they sit side by side. Shown empty, with three links, with problems on two rows, full, with a very long name and address, and off while saving.",
    sources: ["patterns/link-list-field.tsx", "patterns/sortable-list.tsx"],
    Demo: LinkListFieldDemo,
  },
  {
    id: "site-footer-page",
    name: "Site footer page",
    description:
      "The Footer page of the admin's Site content and the two previews: the boxes (about text, phone, email, address, the links and the copyright line) beside the dark footer preview, and the header and footer previews alone in the width of their column. Shown filled, with nothing saved (only the standard copyright line), with a bad email and a link without a name, and the previews with a long name and many links.",
    sources: [
      "domain/site-footer-fields.tsx",
      "domain/site-footer-preview.tsx",
      "domain/site-header-preview.tsx",
      "domain/site-content-layout.tsx",
    ],
    Demo: SiteFooterDemo,
  },
];
