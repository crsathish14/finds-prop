# ADR-090 · Site content: the frame, the link list and the Header and Footer parts (S7-T10, part B1)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-089 (the server side), ADR-087 (the project form parts, whose save bar and section card are reused), ADR-078 (the shared manager parts), FR-ADM-10, BR-81, BR-83
- Plan approved by the owner on 9 Nov 2026 ("approved"). The Site content work is split into the server side (ADR-089), Design Lab parts in two changes (this one: frame, links, Header and Footer; the next: Hero, Homepage and the localities editor) and the connected pages in two changes.

## Decision

- **Parts first, in the Design Lab "Admin" board, three entries.** No page is connected here; the pages are the next changes. The parts hold no state of their own (the page keeps the values, the errors and the words, already translated), as the project form parts do.
  - **`SiteContentLayout`** (domain): the frame of the four pages: heading and line, the four page tabs as links (the current one marked `aria-current="page"`), an alert slot, the form, the preview and the save bar. One column up to 1100 px; from 1100 px the preview takes a column on the right and stays in view while the form scrolls.
  - **`LinkListField`** (patterns): a list of links (label and address) that are edited, removed, added and reordered. It is built on `SortableList`, so a row can be dragged or moved with the up and down arrows, and the first row cannot go up nor the last down.
  - **`SiteHeaderFields`** and **`SiteFooterFields`** (domain): the boxes of the Header page (site name, navigation links, call to action) and of the Footer page (about text, phone, email, address, links, copyright line), in the project form's section cards.
  - **`SiteHeaderPreview`** and **`SiteFooterPreview`** (domain): small pictures of the header and the footer, hidden from screen readers (the boxes say the same things). They take already-worked-out labels; the pages will work them out with the same builders the public header and footer use (`buildHeader`, `buildFooter`), so the picture and the real thing cannot drift apart.
- **Reused, not copied:** the save bar is `ProjectSaveBar` with its words set to Discard, Save changes and Saving (its name is project-specific but it holds nothing of a project); the section card is `FormSection`.
- **The tabs are links to four routes** (`/admin/header`, `/hero`, `/homepage`, `/footer`), not a switch inside one page, because the approved navigation gives each its own address.
- **Departures from the approved admin-cms screen** (all agreed in the plan):
  - **Reordering links.** The screen shows a plain row (label, link, remove). The order of the links is the order on the site, so each row also has the grip and the two arrows of the shared sortable row.
  - **"Logo link" is left out** of the Brand card: the screen itself says it is "kept but not shown" (BR-83), and the server side does not store it.
  - **The "Proposed setting" and "To decide" chips** of the prototype are review notes and are not part of the product.
- **Not in this change:** Hero and Homepage boxes and previews, and the localities editor (next change); any page, action call or toast (the pages).

## Wording to confirm

From the approved screen and used as written: "Header", "The navigation across the top of every public page.", "Footer", "The text, contact details and links at the bottom of every public page.", the tabs "Header", "Hero", "Homepage" and "Footer", "Brand", "Site name", "Navigation links", "Add link", "Call to action", "Button label", "Button link", "About and contact", "About text", "Phone", "Email", "Address", "Links", "Copyright line", "Preview", "Saved changes appear on the public site straight away.", "Discard", "Save changes" and "Saving". New, for your confirmation:

- The Brand card's line: "Leave the name empty to use Find Prop." (the standard name is the one in the message catalogue)
- The Navigation links card's line: "Shown across the top of every page. Leave the list empty to use the standard links."
- The Call to action card's line: "A button at the right end of the header. Leave both boxes empty for no button."
- The Footer cards' lines: "Shown at the bottom of every page. An empty box is left out." and "Shown in the footer, in this order."
- "(optional)" beside the boxes that may stay empty.
- In the link list: "No links yet.", "The list is full.", the count "3 / 12", and the accessible names "Link 2" (a row), "Label 2", "Link address 2", "Remove: Buy", "Drag: Buy", "Move up: Buy" and "Move down: Buy".
- The navigation's name "Site content".

## Consequences

- No migration, package, gate, environment or server change. Three Design Lab entries (so the Admin board's pictures change: three new ones, taken in CI at 390, 820 and 1440 px and committed as baselines after your approval).
- Rollback: delete the six parts, the demos, the three entries, the tests and this ADR. Nothing else uses them yet.
