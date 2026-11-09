import type { LabEntry } from "../types";
import {
  LinkListFieldDemo,
  SiteContentFrameDemo,
  SiteFooterDemo,
} from "./admin-site-content-demos";
import {
  SiteHeroDemo,
  SiteHomepageDemo,
  SiteLocalitiesDemo,
} from "./admin-site-hero-homepage-demos";

/**
 * What the admin uses to edit the site's own content (S7-T10, FR-ADM-10): the frame of the four Site content pages with
 * its tabs, live preview and save bar, the list of links, the Header, Footer, Hero and Homepage boxes with their previews, and the localities list. It has
 * its own board because the Admin board had grown too tall to photograph in one go. It mirrors the admin Site content
 * screen.
 */
export const SITE_CONTENT: LabEntry[] = [
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
  {
    id: "site-hero-page",
    name: "Site hero page",
    description:
      "The Hero page of the admin's Site content: the eyebrow, headline and subtitle boxes, the choice between the Search Desk and Split layouts (two cards with a small drawing each, one tab stop with the arrow keys choosing) and a preview that follows what is typed and chosen (the eyebrow shows in Split only). Shown filled with Split chosen, with the optional boxes empty on Search Desk, with the headline missing, and while saving.",
    sources: [
      "domain/site-hero-fields.tsx",
      "domain/site-hero-preview.tsx",
      "domain/choice-cards.tsx",
      "domain/site-content-layout.tsx",
    ],
    Demo: SiteHeroDemo,
  },
  {
    id: "site-homepage-page",
    name: "Site homepage page",
    description:
      "The Homepage page of the admin's Site content: a switch for each section below the hero (the whole row is the click target), the list of curated localities and a preview of the home page with each section On or Off, the Popular chips and the locality tiles. Shown with every section on and five localities, with two sections off and no localities (the preview says the section is hidden), and while saving.",
    sources: [
      "domain/site-homepage-fields.tsx",
      "domain/site-homepage-preview.tsx",
      "domain/site-localities-editor.tsx",
      "domain/site-content-layout.tsx",
    ],
    Demo: SiteHomepageDemo,
  },
  {
    id: "site-localities-editor",
    name: "Localities editor",
    description:
      "The list of localities the home page features: for each a label, a latitude and a longitude (typed until the place search is built), a radius of 2 to 6 km, the grip and the arrows to change the order, and Remove; Add locality (off at the limit of 8, with a notice) and a note when the list is empty. On a phone every box is on its own line; from 768 px the latitude, longitude and radius share a line. Shown with five localities, empty, with problems on three rows, at the limit, with a very long name and a distance that is not offered, and off while saving.",
    sources: ["domain/site-localities-editor.tsx", "patterns/sortable-list.tsx"],
    Demo: SiteLocalitiesDemo,
  },
];
