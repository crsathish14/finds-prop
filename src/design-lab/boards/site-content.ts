import type { LabEntry } from "../types";
import {
  LinkListFieldDemo,
  SiteContentFrameDemo,
  SiteFooterDemo,
} from "./admin-site-content-demos";
import { BlogBlockEditorDemo, BlogPostFormDemo, BlogPostRowsDemo } from "./admin-blog-demos";
import { BlogArticleCardDemo, BlogArticlePartsDemo, BlogListControlsDemo } from "./blog-demos";
import { ContentModuleBarDemo, ContentModulesCardDemo } from "./admin-content-modules-demos";
import { CategoryManagerDemo, FaqFormDemo, FaqManagerDemo } from "./admin-faq-demos";
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
      "The list of localities the home page features: for each a label, a place search box that fills the latitude and the longitude (which can still be typed), a radius of 2 to 6 km, the grip and the arrows to change the order, and Remove; Add locality (off at the limit of 8, with a notice) and a note when the list is empty. On a phone every box is on its own line; from 768 px the latitude, longitude and radius share a line. Shown with five localities, empty, with problems on three rows, at the limit, with a very long name and a distance that is not offered, and off while saving.",
    sources: ["domain/site-localities-editor.tsx", "patterns/sortable-list.tsx"],
    Demo: SiteLocalitiesDemo,
  },
  {
    id: "content-modules-card",
    name: "Content modules card",
    description:
      "The admin dashboard card that switches Blog, FAQ and Careers on and off (ADR-143): a row per module with its switch, a Live or Hidden label, the counts of published and draft items (a dash when not available yet) and one sentence of what turning it off does. Turning a module off asks first; turning it on does not. Shown with a try-it card, a hidden module that was just saved, a save in progress (every switch off until it ends), a failed save and counts not available yet. The Blog, FAQ and Careers tracks add their admin parts to this board (the Admin board is too tall for more).",
    sources: ["domain/content-modules-card.tsx"],
    Demo: ContentModulesCardDemo,
  },
  {
    id: "content-module-bar",
    name: "Content module switch bar",
    description:
      "The same switch as a bar at the top of each module's admin page (ADR-143), for the one module of the page: the switch with its label, Live or Hidden, the counts and the sentence about turning it off, and the question before hiding a module. Shown live, hidden and saved, counts not available, saving, a failed save and large counts on a narrow area. The module pages keep this bar at their top while their lists and editors are built under it.",
    sources: ["domain/content-module-bar.tsx", "patterns/confirm-dialog.tsx"],
    Demo: ContentModuleBarDemo,
  },
  {
    id: "faq-manager",
    name: "FAQ list",
    description:
      "The admin's FAQ list (ADR-143): the heading with Categories and Add question, the tabs All, Published, Drafts and Trash with their counts, a category filter and a search of the questions and answers, a table that becomes cards below 1024 px of room, and on each row Edit, Publish or Unpublish (Restore in the Trash), Move to Trash and, when one category is chosen, Move up and Move down (the first and last are off). A question in the Trash says so in words and has no Edit. Shown as a try-it list, with one category chosen, the Trash tab, nothing yet and no match.",
    sources: ["domain/faq-manager.tsx"],
    Demo: FaqManagerDemo,
  },
  {
    id: "faq-form-fields",
    name: "FAQ question form",
    description:
      "The admin's question page (ADR-143): a Question and answer card (the category, the question and the answer with a counter) and a Publishing card (Draft or Published), above the project form's save bar. Shown for a new question, a published one being edited, with problems on the boxes, while saving, and when the list has no category yet.",
    sources: ["domain/faq-form-fields.tsx", "domain/project-save-bar.tsx"],
    Demo: FaqFormDemo,
  },
  {
    id: "category-manager",
    name: "Category manager",
    description:
      "The inside of the drawer where the admin manages the categories of one list (ADR-143), shared by the FAQ, the Blog and the job departments: a row for each category with its address word and what uses it, a Hidden label, and the buttons Move up, Move down, Edit, Hide or Show and Delete (off while the category still holds items, with the reason beside it), and a form to add or rename one (name, address word, show on the site). Shown in its drawer, adding, editing with problems, saving and with no categories yet.",
    sources: ["domain/category-manager.tsx", "patterns/manager-drawer.tsx"],
    Demo: CategoryManagerDemo,
  },
  {
    id: "blog-article-card",
    name: "Blog article card",
    description:
      "One article in the Blog list, the Read next list and the search results (ADR-143): the cover with the category on it, the title as the card's one link, a short summary, the author, the date and the reading time. Missing facts are left out and a missing cover is the drawn tile. A search result shows a passage around the matched words with the matches marked. Shown with every fact, without a cover, as a search result, with only a title and an author, with a very long title and a word with no spaces, and loading.",
    sources: ["domain/blog-article-card.tsx"],
    Demo: BlogArticleCardDemo,
  },
  {
    id: "blog-article-parts",
    name: "Blog article parts",
    description:
      "The parts of an article page (ADR-143): the header (category link, the page's only level-1 title, the summary, the author, the date and the reading time, then the cover), the body drawn from its blocks (paragraphs, section headings and sub-headings, bulleted and numbered lists, a quote with its credit and a picture with its caption, all plain text so typed markup shows as typed) and the Read next list. Shown with a full header, with only a title and an author, a body of every block kind, and Read next with three articles and with one.",
    sources: [
      "domain/blog-article-header.tsx",
      "domain/blog-blocks.tsx",
      "domain/blog-related-posts.tsx",
    ],
    Demo: BlogArticlePartsDemo,
  },
  {
    id: "blog-list-controls",
    name: "Blog list controls",
    description:
      "What narrows the Blog list (ADR-143 section 4), each kept in the address so a filtered list can be linked: the search box (a search landmark with a hidden label and a Search button, keeping the chosen category), the category chips (All and one per category, the current one ticked and outlined), the tag chips with a way to clear the chosen tag, and the page bar (Previous, numbers with gaps, Next; on a phone Previous, Page 3 of 9 and Next). Shown empty and with words, with All and with a category chosen, with and without a tag chosen, and the page bar on the first, a middle and the last page, with three pages and with one page (nothing drawn).",
    sources: ["domain/blog-filters.tsx", "patterns/pagination-bar.tsx"],
    Demo: BlogListControlsDemo,
  },
  {
    id: "blog-block-editor",
    name: "Blog block editor",
    description:
      "The editor of an article's body (ADR-143, ADR-144): a card for each block with its kind, Move up, Move down and Delete, and the fields of the kind (a heading's size and text, a paragraph, a list's style and one item a line, a quote and who said it, a picture with a preview, Choose or Replace picture, a required description and an optional caption); and Add buttons for each kind with the count of blocks used. Shown with every kind (try it), empty, with problems on two blocks and a picture not chosen, full (the Add buttons are off and say why) and while saving.",
    sources: [
      "domain/blog-block-editor.tsx",
      "patterns/form-field.tsx",
      "ui/segmented-control.tsx",
    ],
    Demo: BlogBlockEditorDemo,
  },
  {
    id: "blog-admin-list",
    name: "Blog admin list",
    description:
      "The admin's list of articles (ADR-143 section 5): tabs by status with counts, a search box and a category filter (a form, so a filtered list has its own address) and a row for each article with its status as a word, its address, category, author and last change, and the buttons that fit: Edit, Publish or Unpublish, Archive and Move to Trash, or Restore in Trash. Shown with a try-it list (each button works for a moment), the Trash tab with a very long title, a search with no match, no articles yet and a failed action.",
    sources: ["domain/blog-post-rows.tsx", "ui/select.tsx", "patterns/empty-state.tsx"],
    Demo: BlogPostRowsDemo,
  },
  {
    id: "blog-post-form",
    name: "Blog post form",
    description:
      "The boxes of the Blog editor (ADR-143 section 5), in four sections: Basics (title, address with Make from title and a warning when the article is on the site, author, category, tags and the summary with its counter), the cover picture with Choose, Replace and Remove and its required description, the body (the block editor) and the search description with its counters and a preview of how it may read. Shown with a published article (try it), a new empty draft, with problems on the boxes and a block, and while saving.",
    sources: [
      "domain/blog-post-form.tsx",
      "patterns/form-section.tsx",
      "patterns/tag-list-field.tsx",
    ],
    Demo: BlogPostFormDemo,
  },
];
