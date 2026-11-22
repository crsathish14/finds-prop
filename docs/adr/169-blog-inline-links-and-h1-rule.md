# ADR-169 · Blog articles: one inline link, and the one `<h1>` rule

- Status: Accepted (the owner asked for inline links and an H1 rule on 22 Nov 2026; the draft wording of the editor is waiting for approval).
- Date: 2026-11-22
- Related: ADR-144 (the block format, amended here), ADR-143 (the Blog, FAQ and Careers programme), R-SEC-10 (never draw user text as HTML), R-FE-14 and R-FE-15 (external links)
- Class: C2 (a migration, a change to a rule the database checks). No dependency, no new service, no new table or column.

## Context

ADR-144 left inline links out on purpose and called them "the first thing to add if the owner asks". The owner asked, and said the block editor is not friendly to people who write for the web, who also wonder what happens with a first-level heading.

## Decision

- **One inline syntax: `[label](address)`**, in the text of a **paragraph**, each **list item** and a **quote**. Nothing else is read as markup: no bold, no italic, no HTML. Every stored string is still plain text, and a body is still the same JSON blocks (no new key, no new block type), so every existing article is valid and draws as before.
- **What an address may be.** `https://` followed by a host with at least one dot (and an optional port, path, query and fragment), or a path of this site that starts with a single `/` (never `//`). The address is plain ASCII with no spaces or control characters and none of `" ' ( ) < > [ ] { } \ ^ |` or the backtick, at most **2,000** characters (a character outside ASCII or a bracket is written as `%xx`). Refused: `http:`, `mailto:`, `javascript:`, `data:`, a relative address like `below`, a protocol-relative `//host`, a host with no dot, an upper case `HTTPS`. The **label** is 1 to 160 characters, does not start with a space, and has no `[`, `]`, `(` or `)`.
- **What is drawn.** The parser is our own and small (`src/lib/inline-links.ts`, pure, no dependency). `BlogBlocks` builds React anchors from its output and never sets HTML (R-SEC-10). An address of this site is drawn with the site's own `Link`. An external one opens in a new tab with `rel="noopener noreferrer nofollow ugc"` (a link an author typed is user-generated content and gets no search credit) and a screen-reader notice "(opens in a new tab)". **Anything that looks like a link but is not an allowed one is drawn as the text it is**, so old data and data written outside the app are safe. **Headings, a quote's credit, captions and picture descriptions are never read as links.**
- **Saving.** The editor and the Zod schema refuse to **save** link-shaped text that is not an allowed link (including `[note](below)`), with words that say whether the label or the address is the problem. The database check (`blog_block_is_valid`) refuses the same text, so no route can store a link the page would not draw. Reading a stored body back uses a schema that does not apply this rule, so an article saved before links existed that happens to hold such text still opens, draws as plain text and can be corrected.
- **Search, reading time, snippets and the AI read labels only.** `blocksToPlainText` (code) and `blog_body_text` (SQL) turn each link into its label with the same pattern and stay one function: an address is never searched, never counted as words, never put in a snippet, and never sent to the AI assistant's article tool. The rule that an AI answer never draws a link the model wrote is unchanged. Two tests keep the functions the same: one reads the migration and compares the pattern, and the same test vectors run in code and in pgTAP.
- **The one `<h1>`.** The article's own title is the page's single `<h1>`. Body headings stay **level 2 and 3**. There is no `h1` block type, and the editor says so beside each heading. A pasted article's own `# Title` line is handled by the Markdown flow that follows, not here.
- **The editor.** Each paragraph, list and quote has an "Add link" control: a small form (the words to show, and the address) that checks with the same rules, then puts `[label](address)` at the cursor, or in place of the words that were selected. The preview already draws the article with `BlogBlocks`, so it shows the link as readers will see it.

## The migration

`20261124180000_blog_inline_links.sql` replaces two functions (`create or replace`, same signatures, so no grant or type changes): `blog_body_text` and `blog_block_is_valid`. It then writes again, in place and without touching `updated_at`, the stored articles that hold the characters `](`, so the generated search vector and reading time come from the new function. Rows without those characters are identical under the old and new function. A stored row that holds link-shaped text from before is not refused (a body is checked when written); it is refused the next time it is saved, until the author fixes it.

## Alternatives not taken

- **A rich-text editor or Markdown inside every block**: rejected again; it needs a dependency or a sanitiser, and ADR-144's "nothing to sanitise" is the point.
- **Allowing `http:` and `mailto:`**: `mailto` is a spam and phishing vector, and `http` is a downgrade. The owner can ask for either later with a new ADR.
- **A link field on its own (a block with `href`)**: a link in the middle of a sentence cannot be a block.

## Consequences

- Authors can link inside a sentence with no markup to learn beyond the "Add link" form, but a plain `[word](thing)` they type by hand must be a real link or the article will not save.
- A very long address cannot be stored (2,000 characters).
- Draft wording (labels, hints and error texts under `admin.blog.editor` and `validation.blogLink*` in `en.json`) is flagged in the PR and waits for approval.
- A future Markdown paste flow can convert `[label](url)` straight to this syntax with the same rules (`isAllowedLinkUrl`, `isAllowedLinkLabel`).
