# ADR-144 · Blog articles: the block format, the addresses and the picture rules

- Status: Accepted. Decision D2 of ADR-143 (structured blocks, no new dependency, no raw HTML) was approved by the owner on 18 Nov 2026; this records the exact format built for phase 3.
- Date: 2026-11-20
- Related: ADR-143 (the Blog, FAQ and Careers programme), ADR-017 (public columns), ADR-105 and ADR-115 (the sponsor picture upload this reuses), ADR-124 (retention, untouched here), R-SEC-10 (never draw user text as HTML)
- Class: C2 (a migration, a policy, a storage path). No dependency, no new service.

## Decision

- **An article body is a JSON array of blocks** stored in `blog_posts.body` (jsonb), at most 100 blocks and 100,000 bytes. Each block has exactly the keys of its type; an unknown type or key is refused by the database check and by the Zod schema (`features/blog/schemas.ts`), which hold the same limits (a test reads the migration and fails when they drift).

  | Type        | Keys                                | Limits                                                       |
  | ----------- | ----------------------------------- | ------------------------------------------------------------ |
  | `heading`   | `level` (2 or 3), `text`            | text 1 to 160 characters (the article's own title is the h1) |
  | `paragraph` | `text`                              | 1 to 5,000 characters                                        |
  | `list`      | `ordered` (true or false), `items`  | 1 to 50 items, each 1 to 500 characters                      |
  | `quote`     | `text`, `cite` (optional)           | text 1 to 1,000, credit 1 to 120 characters                  |
  | `image`     | `path`, `alt`, `caption` (optional) | alt text 1 to 200 (required), caption 1 to 200               |

- **No markdown, no rich text, no HTML.** Every string is plain text, drawn as React text (R-SEC-10), so there is nothing to sanitise. Line breaks inside a paragraph are kept; nothing else is interpreted. The same plain text feeds the search vector, the reading time (200 words a minute, at least one minute), the search snippet and, later, the AI assistant's article tool (`blocksToPlainText` in code and `blog_body_text` in SQL are the same function).
- **Addresses.** A slug is lower case words joined by single hyphens, 2 to 120 characters, unique. It is made from the title (`slugFromTitle`) when the article is created and the admin may edit it. A made slug that is taken becomes `title-2` to `title-5`, then gets a short random tail; a slug the admin typed that is taken is refused. Renaming a published article changes its address (the old address answers 404); the editor says so. Tags use the same shape, at most ten per article, each 2 to 40 characters.
- **Pictures.** The cover and every image block are files of the existing public `site-assets` bucket under `blog/<article id>/<name>.<png|jpg|webp>` (the table's checks require exactly that path). The admin's browser uploads the file first, the way sponsor pictures are, and the save action reads it back from the bucket and decides: type from the file's own first bytes (no SVG), at most 500 KB (the bucket's own cap), at most 6,000 pixels on a side, and in this article's own folder, so an article cannot point at another's file. Every picture has a description (alt text); a cover without one is refused. A file nothing uses any more is removed after a successful save; a failure to remove is logged and never blocks the save.
- **Status and delete.** `draft`, `published` or `archived`, and a separate soft delete (`deleted_at`, shown as Trash). A published article is complete (a summary and at least one block) and has a publish date, stamped by a trigger the first time and kept after an unpublish. A trashed article cannot be published; Trash first sets a published article back to draft, and restore never publishes by itself. No client holds the DELETE privilege: a later shared change purges old Trash, and this change does not touch the retention function.
- **Who reads and writes.** A visitor (anon or a customer) reads only published articles that are not in Trash, through column grants that leave out the Trash date; the super admin reads and writes everything. Every change is recorded as `content.changed` (the article's id and the changed column names, never the text).
- **Search.** `search_blog_posts()` runs as the caller, so the row policy and the column grants decide what it can read. It uses `websearch_to_tsquery('simple', ...)` over title, excerpt, body text and tags (English stemming is not applied, like the home search), ranks with `ts_rank`, and returns a snippet around the matched words with the matches between `[[` and `]]` (the page draws them, never as HTML).

## Left out on purpose

Scheduled publishing, RSS, markdown import, embeds, tables, inline links and bold or italic inside text, comments, and a staff-profile author (ADR-143 section 9). Inline links and emphasis are the first things to add if the owner asks, as new block fields in a new migration.
