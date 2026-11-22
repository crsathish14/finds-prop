import type { LabEntry } from "../types";
import { BlogBlockEditorDemo, BlogPostFormDemo, BlogPostRowsDemo } from "./admin-blog-demos";
import { BlogArticleCardDemo, BlogArticlePartsDemo, BlogListControlsDemo } from "./blog-demos";

/**
 * What the Blog is drawn with (ADR-143 phase 3): the public parts (the article card, the article's header, body and Read
 * next list, and the controls above the list: search, category and tag chips and the page bar) and the admin parts (the
 * block editor, the list of articles and the post form). It has its own board because the Site content board had grown too
 * tall to photograph in one go (the screenshot of a very tall page does not finish in time). It mirrors the admin Site
 * content screen, the nearest approved design, until the owner approves a Blog design.
 */
export const BLOG: LabEntry[] = [
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
      "The editor of an article's body (ADR-143, ADR-144): a card for each block with its kind, Move up, Move down and Delete, and the fields of the kind (a heading's size and text, a paragraph, a list's style and one item a line, a quote and who said it, a picture with a preview, Choose or Replace picture, a required description and an optional caption); and Add buttons for each kind with the count of blocks used. An 'Add link' control under a paragraph, a list and a quote opens a small form (the words, the address) with its errors (ADR-169), and a heading says the article title is the page heading. Shown with every kind (try it), empty, with problems on two blocks and a picture not chosen, full (the Add buttons are off and say why) and while saving.",
    sources: [
      "domain/blog-block-editor.tsx",
      "domain/blog-link-text-field.tsx",
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
