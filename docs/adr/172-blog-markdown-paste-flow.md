# ADR-172 · Blog: a second way to start an article, by pasting Markdown

- Status: Accepted (the owner asked on 22 Nov 2026 for a second way to create a Blog article, kept beside the block editor so both can be tried and one removed; the draft wording is waiting for approval).
- Date: 2026-11-22
- Amended by: ADR-173 (an AI prompt, an Add link button, and places for pictures; a picture line is no longer turned into words).
- Related: ADR-143 (the Blog), ADR-144 (the block format), ADR-169 (inline links and the one `<h1>`), R-SEC-10 (never draw user text as HTML)
- Class: C2 (a new server action). No dependency, no migration, no new table, column or type.

## Context

The block editor is the right tool for building an article from nothing, but admins often have an article written elsewhere (a document, a chat with an assistant) and find rebuilding it block by block slow. Markdown is what such text usually is.

## Decision

- **Two ways to start.** `/admin/blog/new` asks first: **Block editor** (`?method=blocks`, the existing form, unchanged) or **Paste Markdown** (`?method=markdown`). The category the list was narrowed to travels with both choices. Both stay while the owner tries them; one will be removed.
- **The paste flow.** A large paste box (with the supported syntax listed beside it), the title, address, summary, author and category, a **live preview drawn by the same `BlogBlocks`** readers see, a list of every change the conversion made (each names its line) and a list of problems that stop a draft. **Create draft** makes a draft and opens it in the normal block editor, where pictures, the cover, tags and the search description are added. The pasted Markdown is **not stored**: only the blocks it made.
- **Our own converter, no dependency.** `src/features/blog/markdown/convert.ts` is pure and small (a line-based parser). It produces only blocks the article format already has, so there is nothing new to sanitise and no HTML is read or written. It supports:
  - `# Title` (the **first** one becomes the article's **title**, not a block; a later `#` becomes a level 2 heading with a warning), `##` level 2, `###` to `######` level 3 (a warning when deeper than 3). A heading **needs a space after the hashes**: `#realestate` is text.
  - paragraphs (the lines of one run on), `-` `*` `+` bullet lists and `1.` `1)` numbered lists (a list inside a list is flattened, with a warning), `>` quotes (a last `— Name` line, `–` or `--`, becomes the credit).
  - `[label](address)` links under **ADR-169's rules**, by calling the same `isAllowedLinkUrl` and `isAllowedLinkLabel`: an address that is not allowed leaves only the label, with a warning that names the address. A link in a heading or a credit leaves its label.
  - Horizontal rules are dropped (counted in one note). Bold, italic, strike-through and code marks are taken off the words with **one** summary note and a count. Fenced code, tables and raw HTML become plain paragraphs (a table row becomes one paragraph of its cells), an image becomes its description as words, and each says what was lost.
  - **Limits.** A paragraph over 5,000 characters, a quote over 1,000 and a list item over 500 are split at sentence ends (never inside a link); a list over 50 items becomes lists of at most 50. A heading over 160 characters, more than 100 blocks, more than 100,000 bytes of blocks or more than 400,000 characters of pasted text is an **error** that names the line or the count and stops the draft.
  - **Suggestions.** The address is `slugFromTitle` of the title; the summary is the first paragraph without link syntax, cut at a word to 320 characters.
- **Converted twice, checked once by the existing schema.** The browser converts for the preview. When the admin presses Create draft, the **server converts the pasted text again** (`createBlogPostFromMarkdown`, a super-admin action with the `admin_edit` limit) and never takes blocks from the browser: an extra `body` key is dropped by the schema. Before anything is made, the blocks and the typed boxes pass `updateBlogPostSchema`, the schema every saved article passes, so a converter that is wrong cannot store a body the database or the page would refuse. A refusal makes nothing, so no empty draft is left behind. Then the same two steps the editor uses run (`createPost`, `savePost`), so the address rules (a typed address that is taken is refused, a made one gets a number), the author and the category checks apply unchanged.
- **Debounced preview.** The preview waits 250 ms after typing stops, so a 50,000-character paste is converted once.
- **Easy to remove.** The flow is in its own files: `src/features/blog/markdown/` (the converter, its tests and `blog-markdown-screen.client.tsx`, the flow's single entry point `BlogMarkdownScreen`), `src/components/domain/blog-markdown-flow.tsx` and `blog-markdown-flow-chooser.tsx`, the two Design Lab entries in `blog.ts` and `blog-markdown-demos.tsx`, the action (`createBlogPostFromMarkdown`, its config, schema and `createPostFromMarkdown`), the `admin.blog.chooser` and `admin.blog.markdown` words and `validation.blogMarkdownRefused`. Removing the flow means deleting these and making `?method=blocks` the page again (the page's choice is the only edit outside them). If the block editor is the one removed, the chooser, the `method` choice and the block editor files go instead.

## Alternatives not taken

- **A Markdown library** (`marked`, `remark`): a dependency and a sanitiser for output we do not want (HTML). The subset above is a few hundred lines and every output is already a valid block.
- **Sending the converted blocks from the browser to the existing save actions**: simpler, but then the server never sees the text and the preview is what is trusted. Converting on the server keeps one rule for what the text means.
- **Storing the Markdown** so it can be edited again: a second source of truth beside the blocks. The draft opens in the block editor instead.
- **Reading `#hashtags` as tags**: the owner's example ends with a hashtag line; it stays a paragraph (a hash with no space is text). Tags can be added in the editor.

## Consequences

- Admins can bring in an article written elsewhere in seconds; what the format cannot hold is named, line by line, before anything is saved.
- A table, code, an image or HTML is flattened to words, and a pasted picture must be added again in the block editor.
- Wording under `admin.blog.chooser`, `admin.blog.markdown` and `validation.blogMarkdownRefused` in `en.json` is **draft** and is flagged in the PR for approval.
