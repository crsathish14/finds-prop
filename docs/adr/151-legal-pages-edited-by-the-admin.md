# ADR-151 · The Privacy Policy and Terms of Use are edited by the admin

- Status: Accepted for part A (server). Parts B (Lab parts), C (the admin screen) and D (public pages read the saved text) follow in their own pull requests. Plan approved by the owner on 22 Nov 2026 ("approve the plan").
- Date: 2026-11-22
- Related: ADR-053 (legal page shells, text in typed files), ADR-089 and ADR-090 (site content settings), DEC-25 (the owner writes the final text), FR-SYS-09, FR-ADM-10
- Class: C2 (legal text, a new saved shape)

## Decision

- **Who edits:** only a super admin, with the same limits as the other site content (`admin_edit`). The page text is public once published, so it follows the rule that `site_settings` holds nothing private.
- **Where it is stored:** two rows of the existing `site_settings` table, `legal_privacy` and `legal_terms`. No migration: the key rule already allows these names, and the existing policies and the audit trigger (`cms.changed`: which page, who, never its text) apply unchanged.
- **Two copies per page, one row:** `{ published, working }`. Visitors read `published`. The editor opens on `working`, or on `published` when there is no working copy. **Save draft** writes `working` and never changes what visitors read. **Publish** writes `published` with `draft: false`, today's date in India as "Last updated" and the next version (1, 2, 3 …), and removes the working copy.
- **The text in code stays as the fallback.** A page with no published row shows the placeholder from `content/privacy.ts` or `content/terms.ts` with its draft notice and `noindex`, exactly as ADR-053 describes. A row that does not match its shape is ignored (and for the editor counts as empty), so a page can never come up empty.
- **The Cookie information page stays in code.** Its table must list what the code really stores (ADR-053), so an editor could make it say something untrue. It can be added later if the owner wants it.
- **Shape and limits:** the same blocks the pages already use (paragraph, list, table), plain text only (no markup, no control characters), at most 30 sections of 40 blocks, unique section anchors, table rows as wide as their header. Limits are in `src/features/legal/constants.ts`.
- **Public reads of site settings** now ask only for the keys the site knows (`.in("key", …)`), so a long legal row is not fetched with the header and footer on every page.

## Consequences

- Part A has no visible change: the pages still read the text in code until part D.
- Publishing is a deliberate act that raises the version; the screen (part C) disables the button while a save is pending, because a repeated publish would raise the version twice.
- **All words of the editor are unapproved** until the owner reviews them (part C). The legal text itself is still the owner's or counsel's (DEC-25): this tool does not write or check it.
- There is no version history: only the live version and one working copy are kept.

## Part B: the editor's boxes (Lab parts)

- `LegalDocumentFields` and `LegalTableEditor` (`src/components/domain`) are the summary box and the sections editor: a heading and paragraphs, lists and tables for each section. They hold no state and take their words as props; they are shown on the Site content board of the Design Lab (entry `legal-document-fields`), in the states filled, empty, with problems, at the limits and saving.
- **No approved UX exists for this screen.** The parts reuse the Site content patterns (form sections, sortable rows, the link list's buttons) and nothing new is invented in the look. Every word in the entry is unapproved.
- **A list block is one box with one item per line**, and a table is a grid with Add and Remove for rows and columns, because the Privacy Policy already holds a list and a table (a table needs a header, rows as wide as the header, and at least one row and one column).
- **The anchor of a section is never typed:** part C makes it from the heading (lower case words joined by hyphens, made unique) when it builds the save.
- The save bar for this page needs two buttons (Save draft and Publish); it comes with part C.

Words to confirm (part B): Summary; Sections; Heading; Add section; Remove section; Paragraph; List ("One item on each line."); Table; Add paragraph, Add list, Add table; Table caption; Column; Cell; Add row, Remove row; Add column, Remove column; "No sections yet. Add one to start the page."; "The page is full."; "This section is full."
